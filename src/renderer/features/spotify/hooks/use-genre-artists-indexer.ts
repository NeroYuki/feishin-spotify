import { useEffect, useState } from 'react';

import type { WorkerMessage } from '/@/renderer/features/spotify/workers/genre-artists-worker';

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

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
    return getDB().then(
        (db) =>
            new Promise<T | undefined>((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => resolve(req.result as T | undefined);
                req.onerror = () => reject(req.error);
            }),
    );
}

export interface IndexerState {
    isIndexing: boolean;
    isReady: boolean;
    progress: number;
    totalGenres: number;
}

// Singleton worker — only one import can run at a time
let workerInstance: Worker | null = null;

export function useGenreArtistsIndexer(): IndexerState {
    const [state, setState] = useState<IndexerState>({
        isIndexing: false,
        isReady: false,
        progress: 0,
        totalGenres: 6435,
    });

    useEffect(() => {
        let cancelled = false;

        async function start() {
            // Check if already indexed
            const version = await idbGet<string>(STORE_META, 'dataVersion').catch(() => undefined);
            if (version === 'v2-2026-07') {
                if (!cancelled) setState((s) => ({ ...s, isReady: true }));
                return;
            }

            if (workerInstance) return; // already running

            const worker = new Worker(
                new URL('../workers/genre-artists-worker.ts', import.meta.url),
                { type: 'module' },
            );
            workerInstance = worker;

            if (!cancelled) setState((s) => ({ ...s, isIndexing: true }));

            worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
                if (cancelled) return;
                const msg = e.data;
                if (msg.type === 'progress') {
                    setState((s) => ({ ...s, progress: msg.done, totalGenres: msg.total }));
                } else if (msg.type === 'done' || msg.type === 'already_indexed') {
                    setState({ isIndexing: false, isReady: true, progress: msg.type === 'done' ? state.totalGenres : 0, totalGenres: 6435 });
                    worker.terminate();
                    workerInstance = null;
                } else if (msg.type === 'error') {
                    console.error('[EveryNoise] IDB import error:', msg.message);
                    setState((s) => ({ ...s, isIndexing: false }));
                    worker.terminate();
                    workerInstance = null;
                }
            };

            worker.postMessage({
                dataUrl: new URL('./spotify_genres_artists_top50.json', location.href).href,
                type: 'start',
            });
        }

        start().catch(console.error);

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}
