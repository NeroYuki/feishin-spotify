import { useInfiniteQuery } from '@tanstack/react-query';

import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import { normalizeSpotifyTrack } from '/@/renderer/api/spotify/spotify-normalize';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';

const LIKED_TRACKS_PER_PAGE = 50;

/**
 * Fetches the current user's saved ("liked") Spotify tracks using infinite scroll.
 * Each page contains up to 50 tracks ordered by most-recently-saved first.
 */
export function useSpotifyLikedTracks() {
    const isAuthenticated = useSpotifyIsAuthenticated();

    return useInfiniteQuery({
        enabled: isAuthenticated,
        getNextPageParam: (lastPage: { items: unknown[]; startIndex: number; total: number }) => {
            const loaded = lastPage.startIndex + lastPage.items.length;
            if (loaded < lastPage.total) return loaded;
            return undefined;
        },
        initialPageParam: 0,
        queryFn: async ({ pageParam = 0 }) => {
            const response = await spotifyApiClient.getSavedTracks(
                LIKED_TRACKS_PER_PAGE,
                pageParam as number,
            );
            const songs = response.items
                .filter((item) => item.track?.id && !item.track.is_local)
                .map((item) => normalizeSpotifyTrack(item.track));
            return {
                items: songs,
                startIndex: response.offset,
                total: response.total,
            };
        },
        queryKey: ['spotify', 'liked-tracks'],
        staleTime: 5 * 60 * 1000,
    });
}
