import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';

import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import { normalizeSpotifyTrack } from '/@/renderer/api/spotify/spotify-normalize';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { Song } from '/@/shared/types/domain-types';

export interface SpotifySearchResults {
    songs: Song[];
    total: {
        songs: number;
    };
}

/**
 * Hook for Spotify catalog search. Returns tracks matching the query.
 */
export function useSpotifySearch(query: string) {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const deferredQuery = useDeferredValue(query.trim());

    return useQuery({
        enabled: isAuthenticated && deferredQuery.length >= 2,
        queryFn: async (): Promise<SpotifySearchResults> => {
            const results = await spotifyApiClient.search(deferredQuery, ['track'], 50);

            const songs = (results.tracks?.items ?? [])
                .filter((t) => t.id && !t.is_local)
                .map(normalizeSpotifyTrack);

            return {
                songs,
                total: {
                    songs: results.tracks?.total ?? 0,
                },
            };
        },
        queryKey: ['spotify', 'search', deferredQuery],
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Returns a controlled search query string and debounced value together.
 */
export function useSpotifySearchInput() {
    const [query, setQuery] = useState('');
    return { query, setQuery };
}
