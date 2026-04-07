import isElectron from 'is-electron';
import { IpcRendererEvent } from 'electron';
import { useEffect, useRef } from 'react';

import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import { SPOTIFY_CLIENT_ID, getValidSpotifyToken } from '/@/renderer/features/spotify/api/spotify-auth';
import { useSpotifyIsAuthenticated, useSpotifyIsPremium } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { useSpotifyPlaybackStore, useSpotifyDeviceId, useSpotifyIsReady } from '/@/renderer/features/spotify/store/spotify-playback.store';
import { useSpotifyPcmPlayer } from '/@/renderer/features/spotify/player/use-spotify-pcm-player';
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

    // Web Audio PCM playback (Electron — librespot streams PCM via IPC)
    // Pass currentSong?.id so the PCM buffer is flushed on every track change.
    useSpotifyPcmPlayer(isElectron() && isAuthenticated && isPremium, currentSong?.id);

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
                usePlayerStoreBase.getState().mediaNext();
            }
            if (data.type === 'playing') {
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
        });

        const removeError = window.api.utils.librespotOnError((_e: IpcRendererEvent, msg: string) => {
            console.error('[SpotifyPlayer] librespot error:', msg);
        });

        return () => {
            removed = true;
            removeReady();
            removeEvent();
            removeError();
            window.api.utils.librespotStop();
            useSpotifyPlaybackStore.getState().actions.reset();
        };
    }, [isAuthenticated, isPremium]);

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
    }, [currentSong?.id]);

    useEffect(() => {
        if (!isSpotifySong || !currentSong) return;
        if (playerStatus !== PlayerStatus.PLAYING) return;
        if (!isReady || !deviceId) return;

        const uri = `spotify:track:${currentSong.id}`;
        hasIssuedPlayRef.current = true;
        spotifyApiClient
            .play(deviceId, [uri])
            .catch((err) => console.error('[SpotifyPlayer] play error:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSong?.id, currentSong?._serverType, isReady, deviceId]);

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



