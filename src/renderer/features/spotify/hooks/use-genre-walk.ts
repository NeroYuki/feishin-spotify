import { useCallback, useEffect, useRef, useState } from 'react';

import type { GenreEntry } from '/@/renderer/features/spotify/api/everynoise-types';
import { findNearestUnvisited, WALK_RANDOMNESS_POOLS } from '/@/renderer/features/spotify/components/everynoise/genre-scatter-helpers';

export type WalkMode = 'idle' | 'random' | 'related';

export interface WalkSettings {
    /** 0 = whole preview, 1–30 = seconds */
    maxSongDuration: number;
    /** 0–5 — index into WALK_RANDOMNESS_POOLS */
    randomness: number;
    /** How many preview songs to hear per genre before advancing */
    songsPerGenre: number;
}

export interface UseGenreWalkReturn {
    currentWalkGenre: GenreEntry | null;
    mode: WalkMode;
    onSongEnded: () => void;
    settings: WalkSettings;
    startRandom: (genres: GenreEntry[]) => void;
    startRelated: (fromGenre: GenreEntry | null, genres: GenreEntry[]) => void;
    stop: () => void;
    updateSettings: (patch: Partial<WalkSettings>) => void;
    walkedCount: number;
}

const DEFAULT_SETTINGS: WalkSettings = {
    maxSongDuration: 0,
    randomness: 0,
    songsPerGenre: 2,
};

export function useGenreWalk(): UseGenreWalkReturn {
    const [mode, setMode] = useState<WalkMode>('idle');
    const [currentWalkGenre, setCurrentWalkGenre] = useState<GenreEntry | null>(null);
    const [settings, setSettings] = useState<WalkSettings>(DEFAULT_SETTINGS);
    const [walkedCount, setWalkedCount] = useState(0);

    // Refs for values used inside callbacks so they're always current
    const modeRef = useRef<WalkMode>('idle');
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const genresRef = useRef<GenreEntry[]>([]);
    const currentRef = useRef<GenreEntry | null>(null);
    currentRef.current = currentWalkGenre;
    const walkedSetRef = useRef<Set<string>>(new Set());
    const songCountRef = useRef(0);

    const pickAndAdvance = useCallback((currentGenre: GenreEntry | null, walkMode: WalkMode) => {
        if (walkMode === 'idle') return;
        songCountRef.current = 0;

        const genres = genresRef.current;
        const walked = walkedSetRef.current;
        let next: GenreEntry | null = null;

        if (walkMode === 'random') {
            const unvisited = genres.filter((g) => !walked.has(g.genre));
            const pool = unvisited.length > 0 ? unvisited : genres;
            if (unvisited.length === 0) walkedSetRef.current = new Set();
            next = pool[Math.floor(Math.random() * pool.length)] ?? null;
        } else if (walkMode === 'related' && currentGenre) {
            const poolSize = WALK_RANDOMNESS_POOLS[settingsRef.current.randomness] ?? 1;
            let candidates = findNearestUnvisited(currentGenre, genres, walked, poolSize);
            if (candidates.length === 0) {
                // All visited — reset and try again
                walkedSetRef.current = new Set();
                candidates = findNearestUnvisited(currentGenre, genres, walkedSetRef.current, poolSize);
            }
            next = candidates[Math.floor(Math.random() * candidates.length)] ?? null;
        }

        if (next) {
            walkedSetRef.current.add(next.genre);
            setWalkedCount(walkedSetRef.current.size);
            setCurrentWalkGenre(next);
        }
    }, []);

    const startRandom = useCallback((genres: GenreEntry[]) => {
        genresRef.current = genres;
        walkedSetRef.current = new Set();
        songCountRef.current = 0;
        modeRef.current = 'random';
        setMode('random');
        setWalkedCount(0);

        const first = genres[Math.floor(Math.random() * genres.length)];
        if (first) {
            walkedSetRef.current.add(first.genre);
            setCurrentWalkGenre(first);
        }
    }, []);

    const startRelated = useCallback((fromGenre: GenreEntry | null, genres: GenreEntry[]) => {
        genresRef.current = genres;
        walkedSetRef.current = new Set();
        songCountRef.current = 0;
        modeRef.current = 'related';
        setMode('related');
        setWalkedCount(0);

        const first = fromGenre ?? genres[Math.floor(Math.random() * genres.length)] ?? null;
        if (first) {
            walkedSetRef.current.add(first.genre);
            setCurrentWalkGenre(first);
        }
    }, []);

    const stop = useCallback(() => {
        modeRef.current = 'idle';
        setMode('idle');
        setCurrentWalkGenre(null);
        walkedSetRef.current = new Set();
        songCountRef.current = 0;
    }, []);

    const onSongEnded = useCallback(() => {
        if (modeRef.current === 'idle') return;
        songCountRef.current += 1;
        if (songCountRef.current >= settingsRef.current.songsPerGenre) {
            pickAndAdvance(currentRef.current, modeRef.current);
        }
    }, [pickAndAdvance]);

    // Keep modeRef in sync with state
    useEffect(() => { modeRef.current = mode; }, [mode]);

    const updateSettings = useCallback((patch: Partial<WalkSettings>) => {
        setSettings((s) => ({ ...s, ...patch }));
    }, []);

    return {
        currentWalkGenre,
        mode,
        onSongEnded,
        settings,
        startRandom,
        startRelated,
        stop,
        updateSettings,
        walkedCount,
    };
}
