import { useCallback } from 'react';
import { generatePath, useNavigate, useParams } from 'react-router';

import { SpotifyTrackList } from '/@/renderer/features/spotify/components/spotify-track-list';
import { SpotifyLikeButton } from '/@/renderer/features/spotify/components/spotify-like-button';
import {
    useSpotifyPlaylist,
    useSpotifyPlaylistTracks,
} from '/@/renderer/features/spotify/hooks/use-spotify-playlists';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { AppRoute } from '/@/renderer/router/routes';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

const SpotifyPlaylistDetailContent = () => {
    const { playlistId } = useParams<{ playlistId: string }>();
    const navigate = useNavigate();

    const handleAlbumClick = useCallback(
        (albumId: string) => {
            navigate(generatePath(AppRoute.SPOTIFY_ALBUM_DETAIL, { albumId }));
        },
        [navigate],
    );

    const handleArtistClick = useCallback(
        (artistId: string) => {
            navigate(generatePath(AppRoute.SPOTIFY_ARTIST_DETAIL, { artistId }));
        },
        [navigate],
    );

    const { data: playlist, isLoading: isLoadingPlaylist } = useSpotifyPlaylist(playlistId);
    const {
        data: tracksData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isLoadingTracks,
    } = useSpotifyPlaylistTracks(playlistId);

    if (isLoadingPlaylist || isLoadingTracks) {
        return <Spinner container />;
    }

    const songs: Song[] = tracksData?.pages.flatMap((page) => page.items) ?? [];

    return (
        <Stack gap="md" px="md" py="md">
            {playlist && (
                <Group align="flex-end" gap="lg" wrap="nowrap">
                    <ItemImage
                        enableDebounce={false}
                        enableViewport={false}
                        id={playlist.id}
                        imageContainerProps={{ style: { borderRadius: 8, flexShrink: 0, height: 160, width: 160 } }}
                        itemType={LibraryItem.PLAYLIST}
                        src={playlist.imageUrl}
                    />
                    <Stack gap={4}>
                        <Group align="center" gap="xs" wrap="nowrap">
                            <Text fw={600} size="xl">
                                {playlist.name}
                            </Text>
                            <SpotifyLikeButton uri={`spotify:playlist:${playlist.id}`} />
                        </Group>
                        {playlist.description && (
                            <Text isMuted size="sm">
                                {playlist.description}
                            </Text>
                        )}
                        <Text isMuted size="sm">
                            {playlist.songCount ?? songs.length} tracks
                        </Text>
                    </Stack>
                </Group>
            )}
            <SpotifyTrackList
                    onAlbumClick={handleAlbumClick}
                    onArtistClick={handleArtistClick}
                    songs={songs}
                />
            {hasNextPage && (
                <Button
                    loading={isFetchingNextPage}
                    variant="subtle"
                    onClick={() => fetchNextPage()}
                >
                    Load more
                </Button>
            )}
        </Stack>
    );
};

const SpotifyPlaylistDetailRoute = () => {
    return (
        <AnimatedPage>
            <ScrollArea style={{ height: '100%' }}>
                <SpotifyPlaylistDetailContent />
            </ScrollArea>
        </AnimatedPage>
    );
};

const SpotifyPlaylistDetailRouteWithBoundary = () => {
    return (
        <PageErrorBoundary>
            <SpotifyPlaylistDetailRoute />
        </PageErrorBoundary>
    );
};

export default SpotifyPlaylistDetailRouteWithBoundary;
