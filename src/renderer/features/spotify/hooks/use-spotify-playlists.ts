import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import {
    normalizeSpotifyPlaylist,
    normalizeSpotifyPlaylistTracks,
    normalizeSpotifyPlaylists,
} from '/@/renderer/api/spotify/spotify-normalize';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';

const PLAYLISTS_PER_PAGE = 50;

export const spotifyQueryKeys = {
    playlist: (id: string) => ['spotify', 'playlist', id] as const,
    playlistTracks: (id: string, offset: number) =>
        ['spotify', 'playlist-tracks', id, offset] as const,
    playlists: () => ['spotify', 'playlists'] as const,
    search: (query: string) => ['spotify', 'search', query] as const,
};

/**
 * Fetches the authenticated user's Spotify playlists using infinite scroll.
 */
export function useSpotifyPlaylists() {
    const isAuthenticated = useSpotifyIsAuthenticated();

    return useInfiniteQuery({
        enabled: isAuthenticated,
        getNextPageParam: (lastPage: ReturnType<typeof normalizeSpotifyPlaylists>) => {
            const loaded = lastPage.startIndex + lastPage.items.length;
            if (lastPage.totalRecordCount !== null && loaded < lastPage.totalRecordCount) {
                return loaded;
            }
            return undefined;
        },
        initialPageParam: 0,
        queryFn: async ({ pageParam = 0 }) => {
            const response = await spotifyApiClient.getUserPlaylists(
                PLAYLISTS_PER_PAGE,
                pageParam as number,
            );
            return normalizeSpotifyPlaylists(response.items, response.total, response.offset);
        },
        queryKey: spotifyQueryKeys.playlists(),
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetches tracks for a given Spotify playlist using infinite scroll.
 */
export function useSpotifyPlaylistTracks(playlistId: string | undefined) {
    const isAuthenticated = useSpotifyIsAuthenticated();

    return useInfiniteQuery({
        enabled: isAuthenticated && Boolean(playlistId),
        getNextPageParam: (lastPage: { items: any[]; startIndex: number; totalRecordCount: null | number }) => {
            const loaded = lastPage.startIndex + lastPage.items.length;
            if (lastPage.totalRecordCount !== null && loaded < lastPage.totalRecordCount) {
                return loaded;
            }
            return undefined;
        },
        initialPageParam: 0,
        queryFn: async ({ pageParam = 0 }) => {
            const response = await spotifyApiClient.getPlaylistTracks(
                playlistId!,
                100,
                pageParam as number,
            );
            return normalizeSpotifyPlaylistTracks(response.items, response.total, response.offset);
        },
        queryKey: ['spotify', 'playlist-tracks', playlistId],
        staleTime: 15 * 60 * 1000,
    });
}

/**
 * Fetches metadata for a single Spotify playlist.
 */
export function useSpotifyPlaylist(playlistId: string | undefined) {
    const isAuthenticated = useSpotifyIsAuthenticated();

    return useQuery({
        enabled: isAuthenticated && Boolean(playlistId),
        queryFn: async () => {
            const playlist = await spotifyApiClient.getPlaylist(playlistId!);
            return normalizeSpotifyPlaylist(playlist);
        },
        queryKey: spotifyQueryKeys.playlist(playlistId!),
        staleTime: 10 * 60 * 1000,
    });
}
