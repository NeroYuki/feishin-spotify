/**
 * spotify-saved-batcher.ts
 *
 * DataLoader-style batcher for Spotify's /me/library/contains endpoint.
 *
 * Problem: SpotifyLikeButton calls checkLibraryContains([uri]) once per track.
 * When a list of 20 songs renders, 20 simultaneous requests fire and hit the
 * Spotify rate limit (HTTP 429).
 *
 * Solution: All checkLibraryContainsBatched() calls made within the same
 * JavaScript event-loop task (i.e. the same React render cycle) are coalesced
 * into a single /me/library/contains?uris=... request by a setTimeout(0) flush.
 * The Spotify API accepts up to 50 URIs per call; larger lists are split into
 * sequential chunks of 50.
 */

import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';

type BoolResolver = (saved: boolean) => void;
type BoolRejecter = (err: unknown) => void;

const CHUNK_SIZE = 50;

let _pendingUris: string[] = [];
let _resolvers: Map<string, BoolResolver[]> = new Map();
let _rejectors: Map<string, BoolRejecter[]> = new Map();
let _timer: ReturnType<typeof setTimeout> | null = null;

async function _flush(): Promise<void> {
    _timer = null;
    if (_pendingUris.length === 0) return;

    // Drain the queue atomically before any awaits
    const uris = _pendingUris.splice(0);
    const resolverMap = new Map(_resolvers);
    const rejectorMap = new Map(_rejectors);
    _resolvers = new Map();
    _rejectors = new Map();

    for (let i = 0; i < uris.length; i += CHUNK_SIZE) {
        const chunk = uris.slice(i, i + CHUNK_SIZE);
        try {
            const results = await spotifyApiClient.checkLibraryContains(chunk);
            chunk.forEach((uri, idx) => {
                const cbs = resolverMap.get(uri) ?? [];
                cbs.forEach((cb) => cb(results[idx] ?? false));
            });
        } catch (err) {
            // On network/API error resolve with false & also reject waiting promises
            chunk.forEach((uri) => {
                const rjCbs = rejectorMap.get(uri) ?? [];
                if (rjCbs.length > 0) {
                    rjCbs.forEach((cb) => cb(err));
                } else {
                    // No rejector registered — resolve false so UI doesn't hang
                    const resCbs = resolverMap.get(uri) ?? [];
                    resCbs.forEach((cb) => cb(false));
                }
            });
        }
    }
}

/**
 * Returns the saved status for a single non-artist Spotify URI.
 * Calls made within the same event-loop tick are batched into one HTTP request.
 */
export function checkLibraryContainsBatched(uri: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        if (!_resolvers.has(uri)) {
            _resolvers.set(uri, []);
            _rejectors.set(uri, []);
            _pendingUris.push(uri);
        }
        _resolvers.get(uri)!.push(resolve);
        _rejectors.get(uri)!.push(reject);

        if (!_timer) {
            // Schedule flush at the end of the current task so all same-render
            // calls are captured before the network request is made.
            _timer = setTimeout(_flush, 0);
        }
    });
}
