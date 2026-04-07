import { useCallback } from 'react';
import { generatePath, useNavigate, useParams } from 'react-router';

import { SpotifyTrackList } from '/@/renderer/features/spotify/components/spotify-track-list';
import { SpotifyLikeButton } from '/@/renderer/features/spotify/components/spotify-like-button';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { AppRoute } from '/@/renderer/router/routes';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Group } from '/@/shared/components/group/group';
import { Text } from '/@/shared/components/text/text';
import { LibraryItem, Song } from '/@/shared/types/domain-types';
import { useQuery } from '@tanstack/react-query';
import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import {
    normalizeSpotifyArtist,
    normalizeSpotifyTrack,
} from '/@/renderer/api/spotify/spotify-normalize';

const SpotifyArtistDetailContent = () => {
    const { artistId } = useParams<{ artistId: string }>();
    const isAuthenticated = useSpotifyIsAuthenticated();
    const navigate = useNavigate();

    const { data: artist, isLoading: isLoadingArtist } = useQuery({
        enabled: isAuthenticated && Boolean(artistId),
        queryFn: async () => {
            const raw = await spotifyApiClient.getArtist(artistId!);
            return normalizeSpotifyArtist(raw);
        },
        queryKey: ['spotify', 'artist', artistId],
        staleTime: 10 * 60 * 1000,
    });

    const { data: topTracksData, isLoading: isLoadingTracks } = useQuery({
        enabled: isAuthenticated && Boolean(artistId),
        queryFn: async () => {
            const result = await spotifyApiClient.getArtistTopTracks(artistId!);
            return result.tracks.map(normalizeSpotifyTrack);
        },
        queryKey: ['spotify', 'artist-top-tracks', artistId],
        staleTime: 10 * 60 * 1000,
    });

    const handleAlbumClick = useCallback(
        (albumId: string) => {
            navigate(generatePath(AppRoute.SPOTIFY_ALBUM_DETAIL, { albumId }));
        },
        [navigate],
    );

    const handleArtistClick = useCallback(
        (id: string) => {
            navigate(generatePath(AppRoute.SPOTIFY_ARTIST_DETAIL, { artistId: id }));
        },
        [navigate],
    );

    if (isLoadingArtist || isLoadingTracks) {
        return <Spinner container />;
    }

    const songs: Song[] = topTracksData ?? [];

    return (
        <Stack gap="md" px="md" py="md">
            {artist && (
                <Group align="flex-end" gap="lg" wrap="nowrap">
                    <ItemImage
                        enableDebounce={false}
                        enableViewport={false}
                        id={artist.id}
                        imageContainerProps={{ style: { borderRadius: '50%', flexShrink: 0, height: 160, width: 160 } }}
                        itemType={LibraryItem.ALBUM_ARTIST}
                        src={artist.imageUrl}
                    />
                    <Stack gap={4}>
                        <Group align="center" gap="xs" wrap="nowrap">
                            <Text fw={600} size="xl">
                                {artist.name}
                            </Text>
                            <SpotifyLikeButton isArtist uri={`spotify:artist:${artist.id}`} />
                        </Group>
                        {artist.genres.length > 0 && (
                            <Text isMuted size="sm">
                                {artist.genres.map((g) => g.name).join(' · ')}
                            </Text>
                        )}
                    </Stack>
                </Group>
            )}
            <Text fw={500} size="md">
                Top Tracks
            </Text>
            <SpotifyTrackList
                onAlbumClick={handleAlbumClick}
                onArtistClick={handleArtistClick}
                songs={songs}
            />
        </Stack>
    );
};

const SpotifyArtistDetailRoute = () => (
    <AnimatedPage>
        <ScrollArea style={{ height: '100%' }}>
            <SpotifyArtistDetailContent />
        </ScrollArea>
    </AnimatedPage>
);

const SpotifyArtistDetailRouteWithBoundary = () => (
    <PageErrorBoundary>
        <SpotifyArtistDetailRoute />
    </PageErrorBoundary>
);

export default SpotifyArtistDetailRouteWithBoundary;
