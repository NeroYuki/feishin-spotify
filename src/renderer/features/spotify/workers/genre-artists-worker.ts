// Web Worker: stream-parse spotify_genres_artists_top50.json → IndexedDB
// Runs in the background on first visit to the Every Noise page.

import type { GenreArtistsEntry, IDBImportStatus } from '/@/renderer/features/spotify/api/everynoise-types';

const DB_NAME = 'feishin-everynoise';
const DB_VERSION = 1;
const STORE_ARTISTS = 'genre-artists';
const STORE_META = 'meta';

// Posted from the worker back to the main thread
export type WorkerMessage =
    | { type: 'progress'; done: number; total: number }
    | { type: 'done' }
    | { type: 'already_indexed' }
    | { type: 'error'; message: string };

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
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

function getMetaValue<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

function setMetaValue(db: IDBDatabase, key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        const req = tx.objectStore(STORE_META).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function putArtistsEntry(db: IDBDatabase, entry: GenreArtistsEntry): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ARTISTS, 'readwrite');
        const req = tx.objectStore(STORE_ARTISTS).put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function importData(db: IDBDatabase, dataVersion: string, dataUrl: string): Promise<void> {
    const response = await fetch(dataUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch artists data: ${response.status}`);
    }

    const data: GenreArtistsEntry[] = await response.json();
    const total = data.length;

    for (let i = 0; i < total; i++) {
        await putArtistsEntry(db, data[i]);

        if (i % 100 === 0 || i === total - 1) {
            const msg: WorkerMessage = { done: i + 1, total, type: 'progress' };
            self.postMessage(msg);
        }
    }

    const status: IDBImportStatus = { done: true, progress: total, totalGenres: total };
    await setMetaValue(db, 'importStatus', status);
    await setMetaValue(db, 'dataVersion', dataVersion);
}

// We embed the data version as a constant derived from the file's expected size/hash.
// For simplicity we use a hardcoded string; bump this when the source data changes.
const CURRENT_DATA_VERSION = 'v2-2026-07';

self.onmessage = async (e: MessageEvent) => {
    if (e.data?.type !== 'start') return;
    const dataUrl = e.data.dataUrl as string;

    try {
        const db = await openDB();
        const storedVersion = await getMetaValue<string>(db, 'dataVersion');

        if (storedVersion === CURRENT_DATA_VERSION) {
            const msg: WorkerMessage = { type: 'already_indexed' };
            self.postMessage(msg);
            db.close();
            return;
        }

        await importData(db, CURRENT_DATA_VERSION, dataUrl);
        db.close();

        const msg: WorkerMessage = { type: 'done' };
        self.postMessage(msg);
    } catch (err) {
        const msg: WorkerMessage = {
            message: err instanceof Error ? err.message : String(err),
            type: 'error',
        };
        self.postMessage(msg);
    }
};
