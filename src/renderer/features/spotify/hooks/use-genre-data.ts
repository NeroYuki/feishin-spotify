import { useEffect, useState } from 'react';

import type { GenreEntry, SpatialIndex } from '/@/renderer/features/spotify/api/everynoise-types';

const GRID_COLS = 50;
const GRID_ROWS = 50;

function buildSpatialIndex(genres: GenreEntry[]): SpatialIndex {
    const cellSize = 1 / GRID_COLS;
    const grid: { genres: GenreEntry[] }[][] = Array.from({ length: GRID_ROWS }, () =>
        Array.from({ length: GRID_COLS }, () => ({ genres: [] })),
    );

    for (const g of genres) {
        const col = Math.min(Math.floor(g.organic_index * GRID_COLS), GRID_COLS - 1);
        const row = Math.min(Math.floor(g.atmospheric_index * GRID_ROWS), GRID_ROWS - 1);
        grid[row][col].genres.push(g);
    }

    return { cellSize, cols: GRID_COLS, grid, rows: GRID_ROWS };
}

// Singleton — genre data is fetched once and cached for the lifetime of the app
let cachedGenres: GenreEntry[] | null = null;
let cachedMap: Map<string, GenreEntry> | null = null;
let cachedIndex: SpatialIndex | null = null;
let fetchPromise: Promise<void> | null = null;

function preloadGenreData(): Promise<void> {
    if (cachedGenres) return Promise.resolve();
    if (fetchPromise) return fetchPromise;

    const url = new URL('./spotify_genres.json', location.href).href;
    console.log('[EveryNoise] Fetching genre data from:', url);

    fetchPromise = fetch(url)
        .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
            return r.json() as Promise<GenreEntry[]>;
        })
        .then((data) => {
            console.log('[EveryNoise] Genre data loaded:', data.length, 'genres');
            cachedGenres = data;
            cachedMap = new Map(data.map((g) => [g.genre, g]));
            cachedIndex = buildSpatialIndex(data);
        })
        .catch((err) => {
            console.error('[EveryNoise] Failed to load genre data:', err);
            fetchPromise = null; // allow retry
            throw err;
        });

    return fetchPromise;
}

export interface GenreDataState {
    genres: GenreEntry[];
    index: SpatialIndex | null;
    isLoaded: boolean;
    map: Map<string, GenreEntry>;
}

const EMPTY_MAP = new Map<string, GenreEntry>();

export function useGenreData(): GenreDataState {
    const [genres, setGenres] = useState<GenreEntry[]>(cachedGenres ?? []);
    const [index, setIndex] = useState<SpatialIndex | null>(cachedIndex);
    const [map, setMap] = useState<Map<string, GenreEntry>>(cachedMap ?? EMPTY_MAP);
    const [isLoaded, setIsLoaded] = useState(cachedGenres !== null);

    useEffect(() => {
        if (cachedGenres) return;
        preloadGenreData()
            .then(() => {
                setGenres(cachedGenres!);
                setIndex(cachedIndex);
                setMap(cachedMap!);
                setIsLoaded(true);
            })
            .catch(() => {});
    }, []);

    return { genres, index, isLoaded, map };
}
