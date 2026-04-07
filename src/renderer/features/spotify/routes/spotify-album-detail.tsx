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
    normalizeSpotifyAlbum,
    normalizeSpotifyAlbumTrack,
} from '/@/renderer/api/spotify/spotify-normalize';

const SpotifyAlbumDetailContent = () => {
    const { albumId } = useParams<{ albumId: string }>();
    const isAuthenticated = useSpotifyIsAuthenticated();
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        enabled: isAuthenticated && Boolean(albumId),
        queryFn: async () => {
            const rawAlbum = await spotifyApiClient.getAlbum(albumId!);
            const album = normalizeSpotifyAlbum(rawAlbum);
            const songs = (rawAlbum.tracks?.items ?? [])
                .filter((t) => t.id && !t.is_local)
                .map((t) => normalizeSpotifyAlbumTrack(t, rawAlbum));
            return { album, songs };
        },
        queryKey: ['spotify', 'album', albumId],
        staleTime: 10 * 60 * 1000,
    });

    const handleAlbumClick = useCallback(
        (id: string) => {
            navigate(generatePath(AppRoute.SPOTIFY_ALBUM_DETAIL, { albumId: id }));
        },
        [navigate],
    );

    const handleArtistClick = useCallback(
        (artistId: string) => {
            navigate(generatePath(AppRoute.SPOTIFY_ARTIST_DETAIL, { artistId }));
        },
        [navigate],
    );

    if (isLoading) {
        return <Spinner container />;
    }

    const album = data?.album;
    const songs: Song[] = data?.songs ?? [];

    return (
        <Stack gap="md" px="md" py="md">
            {album && (
                <Group align="flex-end" gap="lg" wrap="nowrap">
                    <ItemImage
                        enableDebounce={false}
                        enableViewport={false}
                        id={album.id}
                        imageContainerProps={{ style: { borderRadius: 8, flexShrink: 0, height: 160, width: 160 } }}
                        itemType={LibraryItem.ALBUM}
                        src={album.imageUrl}
                    />
                    <Stack gap={4}>
                        <Group align="center" gap="xs" wrap="nowrap">
                            <Text fw={600} size="xl">
                                {album.name}
                            </Text>
                            <SpotifyLikeButton uri={`spotify:album:${album.id}`} />
                        </Group>
                        <Text
                            isMuted
                            size="sm"
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                                const artist = album.albumArtists?.[0];
                                if (artist) {
                                    navigate(
                                        generatePath(AppRoute.SPOTIFY_ARTIST_DETAIL, {
                                            artistId: artist.id,
                                        }),
                                    );
                                }
                            }}
                        >
                            {album.albumArtistName}
                        </Text>
                        {album.releaseYear ? (
                            <Text isMuted size="xs">
                                {album.releaseYear}
                            </Text>
                        ) : null}
                        <Text isMuted size="xs">
                            {album.songCount ?? songs.length} tracks
                        </Text>
                    </Stack>
                </Group>
            )}
            <SpotifyTrackList
                onAlbumClick={handleAlbumClick}
                onArtistClick={handleArtistClick}
                songs={songs}
            />
        </Stack>
    );
};

const SpotifyAlbumDetailRoute = () => (
    <AnimatedPage>
        <ScrollArea style={{ height: '100%' }}>
            <SpotifyAlbumDetailContent />
        </ScrollArea>
    </AnimatedPage>
);

const SpotifyAlbumDetailRouteWithBoundary = () => (
    <PageErrorBoundary>
        <SpotifyAlbumDetailRoute />
    </PageErrorBoundary>
);

export default SpotifyAlbumDetailRouteWithBoundary;
