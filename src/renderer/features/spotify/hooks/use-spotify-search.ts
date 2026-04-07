import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';

import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import {
    normalizeSpotifyPlaylist,
    normalizeSpotifySearchArtist,
    normalizeSpotifySimplifiedAlbum,
    normalizeSpotifyTrack,
} from '/@/renderer/api/spotify/spotify-normalize';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { Album, AlbumArtist, Playlist, Song } from '/@/shared/types/domain-types';

export interface SpotifySearchResults {
    albums: Album[];
    artists: AlbumArtist[];
    playlists: Playlist[];
    songs: Song[];
    total: {
        albums: number;
        artists: number;
        playlists: number;
        songs: number;
    };
}

/**
 * Hook for Spotify catalog search. Returns tracks, albums, artists, and playlists.
 */
export function useSpotifySearch(query: string) {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const deferredQuery = useDeferredValue(query.trim());

    return useQuery({
        enabled: isAuthenticated && deferredQuery.length >= 2,
        queryFn: async (): Promise<SpotifySearchResults> => {
            const results = await spotifyApiClient.search(
                deferredQuery,
                ['track', 'album', 'artist', 'playlist'],
                20,
            );

            const songs = (results.tracks?.items ?? [])
                .filter((t) => t.id && !t.is_local)
                .map(normalizeSpotifyTrack);

            const albums = (results.albums?.items ?? [])
                .filter((a) => a.id)
                .map(normalizeSpotifySimplifiedAlbum);

            const artists = (results.artists?.items ?? [])
                .filter((a) => a.id)
                .map(normalizeSpotifySearchArtist);

            const playlists = (results.playlists?.items ?? [])
                .filter((p) => p != null && !!p.id)
                .map(normalizeSpotifyPlaylist);

            return {
                albums,
                artists,
                playlists,
                songs,
                total: {
                    albums: results.albums?.total ?? 0,
                    artists: results.artists?.total ?? 0,
                    playlists: results.playlists?.total ?? 0,
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
