import isElectron from 'is-electron';
import { IpcRendererEvent } from 'electron';
import { useEffect, useRef } from 'react';

import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import { SPOTIFY_CLIENT_ID, getValidSpotifyToken } from '/@/renderer/features/spotify/api/spotify-auth';
import { useSpotifyIsAuthenticated, useSpotifyIsPremium } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { useSpotifyPlaybackStore, useSpotifyDeviceId, useSpotifyIsReady } from '/@/renderer/features/spotify/store/spotify-playback.store';import { useSpotifyPcmPlayer } from '/@/renderer/features/spotify/player/use-spotify-pcm-player';
import {
    usePlayerStatus,
    usePlayerSong,
    usePlayerVolume,
    usePlayerStoreBase,
} from '/@/renderer/store';
import { setTimestamp } from '/@/renderer/store/timestamp.store';
import { ServerType } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

const POSITION_POLL_MS = 1000;

/**
 * Retries `fn` once after `delayMs` if it throws. Useful for transient Spotify
 * API errors such as 404 (device transitioning) or 202 (retry requested).
 */
async function withRetry<T>(fn: () => Promise<T>, delayMs = 400): Promise<T> {
    try {
        return await fn();
    } catch {
        await new Promise<void>((r) => setTimeout(r, delayMs));
        return fn();
    }
}

/**
 * SpotifyPlayer — headless component that manages Spotify playback.
 *
 * In Electron: uses @lox-audioserver/node-librespot running in the main process
 * (via IPC) to create a Spotify Connect device and stream PCM to MPV.
 *
 * In web: falls back to the Spotify Web Playback SDK (if Widevine is available).
 */
export function SpotifyPlayer() {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const isPremium = useSpotifyIsPremium();

    const currentSong = usePlayerSong();
    const playerStatus = usePlayerStatus();
    const volume = usePlayerVolume();

    const isSpotifySong = currentSong?._serverType === ServerType.SPOTIFY;
    const positionRef = useRef(0);
    const positionIntervalRef = useRef<null | ReturnType<typeof setInterval>>(null);
    // Refs kept current so the librespot event handler always reads fresh values.
    const currentSongRef = useRef(currentSong);
    currentSongRef.current = currentSong;
    const playerStatusRef = useRef(playerStatus);
    playerStatusRef.current = playerStatus;
    // How many times we have auto-retried play() for the current song after a
    // 'stopped' event.  Reset when the song changes.
    const stoppedRetryCountRef = useRef(0);
    const stoppedRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Web Audio PCM playback (Electron — librespot streams PCM via IPC).
    // Only active when the current song is a Spotify track; deactivating on
    // music-server songs stops the PCM listener and disconnects the intermediate
    // gain node so gains[0] is exclusively owned by the music-server player.
    useSpotifyPcmPlayer(isElectron() && isAuthenticated && isPremium && isSpotifySong, currentSong?.id);

    // -----------------------------------------------------------------------
    // Init / teardown librespot Connect device (Electron only)
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!isElectron() || !isAuthenticated || !isPremium) return;

        let removed = false;

        const start = async () => {
            const token = await getValidSpotifyToken();
            const result = await window.api.utils.librespotInit(token, SPOTIFY_CLIENT_ID);
            if (result?.error) {
                console.error('[SpotifyPlayer] librespot init error:', result.error);
            }
        };

        start();

        const removeReady = window.api.utils.librespotOnReady((_e: IpcRendererEvent, deviceId: string) => {
            if (removed) return;
            useSpotifyPlaybackStore.getState().actions.setDeviceReady(deviceId);
        });

        const removeEvent = window.api.utils.librespotOnEvent((_e: IpcRendererEvent, data: Record<string, unknown>) => {
            if (removed) return;
            if (data.type === 'end_of_track') {
                useSpotifyPlaybackStore.getState().actions.setBuffering(false);
                usePlayerStoreBase.getState().mediaNext();
            }
            if (data.type === 'unavailable') {
                // Track is not playable in this region/market — skip to next.
                useSpotifyPlaybackStore.getState().actions.setBuffering(false);
                usePlayerStoreBase.getState().mediaNext();
            }
            if (data.type === 'loading') {
                // librespot is downloading / decoding the track.
                const trackLabel = (data.uri ?? data.trackId ?? '') as string;
                console.log('[SpotifyPlayer] buffering: loading', trackLabel);
                useSpotifyPlaybackStore.getState().actions.setBuffering(true);
                // Reset the displayed position to 0 — the track hasn't started
                // yet and any stale timestamp would be misleading.
                positionRef.current = 0;
                setTimestamp(0);
            }
            if (data.type === 'playing') {
                useSpotifyPlaybackStore.getState().actions.setBuffering(false);
                useSpotifyPlaybackStore.getState().actions.setIsActive(true);
                if (typeof data.positionMs === 'number') {
                    positionRef.current = data.positionMs / 1000;
                    setTimestamp(positionRef.current);
                }
            }
            if (data.type === 'paused') {
                if (typeof data.positionMs === 'number') {
                    positionRef.current = data.positionMs / 1000;
                }
            }
            if (data.type === 'stopped') {
                console.warn('[SpotifyPlayer] librespot stopped event');
                useSpotifyPlaybackStore.getState().actions.setBuffering(false);
                // If Feishin expects to be playing a Spotify track, auto-retry
                // play() — librespot sometimes stops due to a transient stall or
                // timeout during long buffering rather than an actual user action.
                const song = currentSongRef.current;
                const status = playerStatusRef.current;
                const { deviceId } = useSpotifyPlaybackStore.getState();
                const MAX_RETRIES = 3;
                if (
                    song?._serverType === ServerType.SPOTIFY &&
                    status === PlayerStatus.PLAYING &&
                    deviceId &&
                    stoppedRetryCountRef.current < MAX_RETRIES
                ) {
                    const attempt = ++stoppedRetryCountRef.current;
                    const delayMs = attempt * 1500; // 1.5s, 3s, 4.5s
                    console.log(`[SpotifyPlayer] retrying play in ${delayMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
                    if (stoppedRetryTimerRef.current) clearTimeout(stoppedRetryTimerRef.current);
                    stoppedRetryTimerRef.current = setTimeout(() => {
                        stoppedRetryTimerRef.current = null;
                        const currentDeviceId = useSpotifyPlaybackStore.getState().deviceId;
                        const currentSongNow = currentSongRef.current;
                        const currentStatus = playerStatusRef.current;
                        if (
                            currentDeviceId &&
                            currentSongNow?._serverType === ServerType.SPOTIFY &&
                            currentStatus === PlayerStatus.PLAYING
                        ) {
                            const uri = `spotify:track:${currentSongNow.id}`;
                            console.log('[SpotifyPlayer] retrying play:', uri);
                            useSpotifyPlaybackStore.getState().actions.setBuffering(true);
                            spotifyApiClient
                                .play(currentDeviceId, [uri])
                                .catch((err) => console.error('[SpotifyPlayer] retry play error:', err));
                        }
                    }, delayMs);
                }
            }
            if (data.type === 'error') {
                const code = data.errorCode as string | undefined;
                if (code === 'pcm_stalled') {
                    console.warn('[SpotifyPlayer] PCM stream stalled — buffering');
                    useSpotifyPlaybackStore.getState().actions.setBuffering(true);
                } else if (code === 'pcm_ok') {
                    console.log('[SpotifyPlayer] PCM stream flowing again');
                    useSpotifyPlaybackStore.getState().actions.setBuffering(false);
                }
            }
        });

        const removeError = window.api.utils.librespotOnError((_e: IpcRendererEvent, msg: string) => {
            console.error('[SpotifyPlayer] librespot error:', msg);
        });

        return () => {
            removed = true;
            removeReady();
            removeEvent();
            removeError();
            if (stoppedRetryTimerRef.current) {
                clearTimeout(stoppedRetryTimerRef.current);
                stoppedRetryTimerRef.current = null;
            }
            window.api.utils.librespotStop();
            useSpotifyPlaybackStore.getState().actions.reset();
        };    }, [isAuthenticated, isPremium]);

    // -----------------------------------------------------------------------
    // Play track via Spotify Web API → librespot Connect device
    // -----------------------------------------------------------------------
    const deviceId = useSpotifyDeviceId();
    const isReady = useSpotifyIsReady();
    // True once play(uri) has been sent for the current song — prevents
    // resumePlayback from firing before the track is loaded on the device.
    const hasIssuedPlayRef = useRef(false);
    // Queues a pause/resume command that arrived before the device was ready.
    const pendingControlRef = useRef<'pause' | 'resume' | null>(null);

    // Reset when song changes
    useEffect(() => {
        hasIssuedPlayRef.current = false;
        stoppedRetryCountRef.current = 0;
        if (stoppedRetryTimerRef.current) {
            clearTimeout(stoppedRetryTimerRef.current);
            stoppedRetryTimerRef.current = null;
        }
    }, [currentSong?.id]);

    useEffect(() => {
        if (!isSpotifySong || !currentSong) return;
        if (playerStatus !== PlayerStatus.PLAYING) return;
        if (!isReady || !deviceId) return;
        // Guard: only issue play() once per song. When the song changes, the
        // reset effect above sets this to false before this effect runs again.
        if (hasIssuedPlayRef.current) return;

        const uri = `spotify:track:${currentSong.id}`;
        hasIssuedPlayRef.current = true;
        spotifyApiClient
            .play(deviceId, [uri])
            .catch((err) => console.error('[SpotifyPlayer] play error:', err));
    // playerStatus is intentionally included: if the song changes while the
    // player is paused, this effect fires but returns early. When the status
    // switches to PLAYING, this effect re-fires and issues the play command.
    }, [currentSong?.id, currentSong?._serverType, isReady, deviceId, playerStatus, isSpotifySong]);

    // -----------------------------------------------------------------------
    // Sync play/pause → Spotify Web API
    // Only fires on playerStatus changes — isReady/deviceId are accessed via
    // ref so we don't re-trigger this when the device first registers.
    // Only calls resumePlayback after the initial play(uri) has been issued.
    // -----------------------------------------------------------------------
    const deviceIdRef = useRef(deviceId);
    deviceIdRef.current = deviceId;
    const isReadyRef = useRef(isReady);
    isReadyRef.current = isReady;

    useEffect(() => {
        if (!isSpotifySong) return;

        if (!isReadyRef.current || !deviceIdRef.current) {
            // Queue the command so it fires once the device becomes ready.
            if (playerStatus === PlayerStatus.PAUSED) pendingControlRef.current = 'pause';
            else if (playerStatus === PlayerStatus.PLAYING && hasIssuedPlayRef.current) pendingControlRef.current = 'resume';
            return;
        }

        if (playerStatus === PlayerStatus.PLAYING) {
            if (!hasIssuedPlayRef.current) return;
            withRetry(() => spotifyApiClient.resumePlayback(deviceIdRef.current!))
                .catch((err) => console.error('[SpotifyPlayer] resumePlayback error:', err));
        } else if (playerStatus === PlayerStatus.PAUSED) {
            withRetry(() => spotifyApiClient.pausePlayback(deviceIdRef.current!))
                .catch((err) => console.error('[SpotifyPlayer] pausePlayback error:', err));
        }
    }, [playerStatus, isSpotifySong]);

    // Execute any command that was queued while the device was still initialising.
    useEffect(() => {
        if (!isReady || !deviceId) return;
        const cmd = pendingControlRef.current;
        if (!cmd) return;
        pendingControlRef.current = null;
        if (cmd === 'pause') {
            withRetry(() => spotifyApiClient.pausePlayback(deviceId))
                .catch((err) => console.error('[SpotifyPlayer] delayed pausePlayback error:', err));
        } else if (cmd === 'resume' && hasIssuedPlayRef.current) {
            withRetry(() => spotifyApiClient.resumePlayback(deviceId))
                .catch((err) => console.error('[SpotifyPlayer] delayed resumePlayback error:', err));
        }
    }, [isReady, deviceId]);

    // When the current song switches away from Spotify, explicitly pause the
    // Spotify device.  This stops librespot from continuing to stream PCM in
    // the background and keeps Spotify Connect state consistent so that the
    // next Spotify song starts from position 0 rather than mid-track.
    const wasSpotifySongRef = useRef(false);
    useEffect(() => {
        if (isSpotifySong) {
            wasSpotifySongRef.current = true;
            return;
        }
        // Only pause if we were previously playing a Spotify track.
        if (!wasSpotifySongRef.current) return;
        wasSpotifySongRef.current = false;
        if (deviceIdRef.current) {
            spotifyApiClient.pausePlayback(deviceIdRef.current)
                .catch(() => { /* best-effort */ });
        }
    }, [isSpotifySong]);

    // -----------------------------------------------------------------------
    // Volume sync → librespot
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!isElectron()) return;
        window.api.utils.librespotVolume(volume);
    }, [volume]);

    // -----------------------------------------------------------------------
    // Position polling — poll Web API for current position
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!isSpotifySong || playerStatus !== PlayerStatus.PLAYING) {
            if (positionIntervalRef.current) {
                clearInterval(positionIntervalRef.current);
                positionIntervalRef.current = null;
            }
            return;
        }

        positionIntervalRef.current = setInterval(async () => {
            try {
                const state = await spotifyApiClient.getPlaybackState();
                if (state && !state.is_playing === false && typeof state.progress_ms === 'number') {
                    setTimestamp(state.progress_ms / 1000);
                }
            } catch (_) { /* ignore */ }
        }, POSITION_POLL_MS);

        return () => {
            if (positionIntervalRef.current) {
                clearInterval(positionIntervalRef.current);
                positionIntervalRef.current = null;
            }
        };
    }, [isSpotifySong, playerStatus]);

    // -----------------------------------------------------------------------
    // Seek events
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!isSpotifySong) return;

        const unsub = usePlayerStoreBase.subscribe(
            (state) => state.player.seekToTimestamp,
            (seekToTimestamp) => {
                if (!seekToTimestamp) return;
                const { deviceId } = useSpotifyPlaybackStore.getState();
                if (!deviceId) return;
                const positionMs = Math.round(parseFloat(seekToTimestamp) * 1000);
                spotifyApiClient.seekToPosition(deviceId, positionMs).catch(console.error);
            },
        );

        return () => unsub();
    }, [isSpotifySong]);

    return null;
}



