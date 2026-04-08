import { useEffect, useState } from 'react';

import type { GenreArtist } from '/@/renderer/features/spotify/api/everynoise-types';

const DB_NAME = 'feishin-everynoise';
const DB_VERSION = 1;
const STORE_ARTISTS = 'genre-artists';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_ARTISTS)) {
                    db.createObjectStore(STORE_ARTISTS, { keyPath: 'genre' });
                }
                if (!db.objectStoreNames.contains(STORE_META)) {
                    db.createObjectStore(STORE_META);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return dbPromise;
}

function fetchArtistsFromIDB(genre: string): Promise<GenreArtist[] | undefined> {
    return getDB().then(
        (db) =>
            new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_ARTISTS, 'readonly');
                const req = tx.objectStore(STORE_ARTISTS).get(genre);
                req.onsuccess = () => {
                    const entry = req.result as { artists: GenreArtist[]; genre: string } | undefined;
                    resolve(entry?.artists);
                };
                req.onerror = () => reject(req.error);
            }),
    );
}

export function useGenreArtists(genre: string | null) {
    const [data, setData] = useState<GenreArtist[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!genre) {
            setData(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setData(null);

        fetchArtistsFromIDB(genre)
            .then((artists) => {
                if (!cancelled) {
                    setData(artists ?? null);
                    setIsLoading(false);
                }
            })
            .catch((err) => {
                console.error('[EveryNoise] IDB read error:', err);
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [genre]);

    return { data, isLoading };
}
