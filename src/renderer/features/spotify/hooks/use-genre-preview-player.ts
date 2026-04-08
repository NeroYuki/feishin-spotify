import { useCallback, useEffect, useRef, useState } from 'react';

import type { GenreArtist } from '/@/renderer/features/spotify/api/everynoise-types';

export type PreviewStatus = 'idle' | 'loading' | 'paused' | 'playing';

export interface PreviewPlayerState {
    currentArtistIndex: null | number;
    currentPreviewUrl: null | string;
    progress: number; // 0-1
    status: PreviewStatus;
}

const INITIAL_STATE: PreviewPlayerState = {
    currentArtistIndex: null,
    currentPreviewUrl: null,
    progress: 0,
    status: 'idle',
};

// Single shared audio element across hook instances
let sharedAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
    if (!sharedAudio) {
        sharedAudio = new Audio();
        sharedAudio.preload = 'auto';
    }
    return sharedAudio;
}

// Select a random index from artists that have a preview_url, avoiding the current one
function pickRandomIndex(artists: GenreArtist[], exclude: null | number): number | null {
    const eligible = artists
        .map((a, i) => (a.preview_url ? i : -1))
        .filter((i) => i !== -1 && i !== exclude);
    if (eligible.length === 0) return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
}

export function useGenrePreviewPlayer(
    artists: GenreArtist[] | null,
    volume: number = 1,
    onSongEnd?: () => void,
    maxDuration = 0, // seconds; 0 = play full preview
) {
    const [state, setState] = useState<PreviewPlayerState>(INITIAL_STATE);
    const stateRef = useRef<PreviewPlayerState>(INITIAL_STATE);
    const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onSongEndRef = useRef(onSongEnd);
    onSongEndRef.current = onSongEnd;
    const maxDurationRef = useRef(maxDuration);
    maxDurationRef.current = maxDuration;

    const setAndSync = useCallback((updater: (prev: PreviewPlayerState) => PreviewPlayerState) => {
        setState((prev) => {
            const next = updater(prev);
            stateRef.current = next;
            return next;
        });
    }, []);

    // Sync volume
    useEffect(() => {
        getAudio().volume = Math.max(0, Math.min(1, volume));
    }, [volume]);

    const playIndex = useCallback(
        (index: number, artistList: GenreArtist[]) => {
            const url = artistList[index]?.preview_url;
            if (!url) return;

            // Clear any pending maxDuration timer
            if (maxDurationTimerRef.current !== null) {
                clearTimeout(maxDurationTimerRef.current);
                maxDurationTimerRef.current = null;
            }

            const audio = getAudio();
            audio.src = url;
            audio.currentTime = 0;

            setAndSync(() => ({
                currentArtistIndex: index,
                currentPreviewUrl: url,
                progress: 0,
                status: 'loading',
            }));

            audio.play().then(() => {
                // Start maxDuration timer once playback actually starts
                if (maxDurationRef.current > 0) {
                    maxDurationTimerRef.current = setTimeout(() => {
                        maxDurationTimerRef.current = null;
                        onSongEndRef.current?.();
                        // Skip to next preview song
                        const next = pickRandomIndex(artistList, index);
                        if (next !== null) {
                            playIndex(next, artistList);
                        } else {
                            getAudio().pause();
                            setAndSync(() => INITIAL_STATE);
                        }
                    }, maxDurationRef.current * 1000);
                }
            }).catch(() => {
                setAndSync((s) => ({ ...s, status: 'idle' }));
            });
        },
        [setAndSync],
    );

    // Wire audio events
    useEffect(() => {
        const audio = getAudio();
        if (!artists) return;

        const onPlaying = () => setAndSync((s) => ({ ...s, status: 'playing' }));
        const onPause = () => setAndSync((s) => ({ ...s, status: 'paused' }));
        const onTimeUpdate = () => {
            const a = getAudio();
            const prog = a.duration ? a.currentTime / a.duration : 0;
            setAndSync((s) => ({ ...s, progress: prog }));
        };
        const onEnded = () => {
            onSongEndRef.current?.();
            const next = pickRandomIndex(artists, stateRef.current.currentArtistIndex);
            if (next !== null) {
                playIndex(next, artists);
            } else {
                setAndSync(() => INITIAL_STATE);
            }
        };
        const onError = () => {
            // Skip errored preview — don't count as song end
            const next = pickRandomIndex(artists, stateRef.current.currentArtistIndex);
            if (next !== null) {
                playIndex(next, artists);
            } else {
                setAndSync(() => INITIAL_STATE);
            }
        };

        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        return () => {
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
        };
    }, [artists, playIndex, setAndSync]);

    // Auto-play when new artist list arrives (genre opened)
    useEffect(() => {
        if (!artists || artists.length === 0) {
            getAudio().pause();
            setAndSync(() => INITIAL_STATE);
            return;
        }
        const first = pickRandomIndex(artists, null);
        if (first !== null) playIndex(first, artists);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [artists]);

    const play = useCallback(() => {
        getAudio().play().catch(() => {});
    }, []);

    const pause = useCallback(() => {
        getAudio().pause();
    }, []);

    const skipNext = useCallback(() => {
        if (!artists) return;
        const next = pickRandomIndex(artists, stateRef.current.currentArtistIndex);
        if (next !== null) playIndex(next, artists);
    }, [artists, playIndex]);

    const playArtistIndex = useCallback(
        (index: number) => {
            if (!artists) return;
            playIndex(index, artists);
        },
        [artists, playIndex],
    );

    const stop = useCallback(() => {
        if (maxDurationTimerRef.current !== null) {
            clearTimeout(maxDurationTimerRef.current);
            maxDurationTimerRef.current = null;
        }
        getAudio().pause();
        getAudio().src = '';
        setAndSync(() => INITIAL_STATE);
    }, [setAndSync]);

    return { pause, play, playArtistIndex, skipNext, state, stop };
}
