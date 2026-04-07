import { useCallback } from 'react';
import { generatePath, useNavigate } from 'react-router';

import { SpotifyTrackList } from '/@/renderer/features/spotify/components/spotify-track-list';
import { useSpotifyLikedTracks } from '/@/renderer/features/spotify/hooks/use-spotify-liked-tracks';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { SpotifyConnectButton } from '/@/renderer/features/spotify/components/spotify-connect-button';
import { AppRoute } from '/@/renderer/router/routes';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Song } from '/@/shared/types/domain-types';

const SpotifyLikedTracksContent = () => {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const navigate = useNavigate();
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useSpotifyLikedTracks();

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

    if (!isAuthenticated) {
        return (
            <Stack align="center" gap="md" mt="xl">
                <Text fw={500} size="lg">
                    Connect your Spotify account
                </Text>
                <SpotifyConnectButton />
            </Stack>
        );
    }

    if (isLoading) {
        return <Spinner container />;
    }

    const songs: Song[] = data?.pages.flatMap((page) => page.items) ?? [];
    const total = data?.pages[0]?.total ?? 0;

    return (
        <Stack gap="md" px="md" py="md">
            <Group align="center" gap="sm">
                <Icon icon="favorite" size="xl" style={{ color: 'var(--theme-colors-primary)' }} />
                <Stack gap={2}>
                    <Text fw={600} size="xl">
                        Liked Songs
                    </Text>
                    {total > 0 && (
                        <Text isMuted size="sm">
                            {total} tracks
                        </Text>
                    )}
                </Stack>
            </Group>
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
            {!isLoading && songs.length === 0 && (
                <Text isMuted ta="center" py="xl">
                    No liked songs yet. Save tracks by clicking the heart icon.
                </Text>
            )}
        </Stack>
    );
};

const SpotifyLikedTracksRoute = () => (
    <AnimatedPage>
        <ScrollArea style={{ height: '100%' }}>
            <SpotifyLikedTracksContent />
        </ScrollArea>
    </AnimatedPage>
);

const SpotifyLikedTracksRouteWithBoundary = () => (
    <PageErrorBoundary>
        <SpotifyLikedTracksRoute />
    </PageErrorBoundary>
);

export default SpotifyLikedTracksRouteWithBoundary;
