import { generatePath } from 'react-router';

import { SpotifyConnectButton } from '/@/renderer/features/spotify/components/spotify-connect-button';
import { useSpotifyPlaylists } from '/@/renderer/features/spotify/hooks/use-spotify-playlists';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { AppRoute } from '/@/renderer/router/routes';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Playlist } from '/@/shared/types/domain-types';
import { Link } from 'react-router';

interface PlaylistCardProps {
    playlist: Playlist;
}

const PlaylistCard = ({ playlist }: PlaylistCardProps) => {
    const to = generatePath(AppRoute.SPOTIFY_PLAYLIST_DETAIL, { playlistId: playlist.id });
    return (
        <Button
            component={Link}
            justify="flex-start"
            style={{
                height: 'auto',
                padding: '8px 12px',
                textAlign: 'left',
                width: '100%',
            }}
            to={to}
            variant="subtle"
        >
            <Stack gap={2} style={{ minWidth: 0, width: '100%' }}>
                <Text overflow="hidden">{playlist.name}</Text>
                {playlist.description && (
                    <Text isMuted overflow="hidden" size="xs">
                        {playlist.description}
                    </Text>
                )}
                <Text isMuted size="xs">
                    {playlist.songCount ?? 0} tracks
                </Text>
            </Stack>
        </Button>
    );
};

const SpotifyHomeContent = () => {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useSpotifyPlaylists();

    if (!isAuthenticated) {
        return (
            <Stack align="center" gap="md" mt="xl">
                <Text fw={500} size="lg">
                    Connect your Spotify account
                </Text>
                <Text isMuted ta="center">
                    Connect to browse your playlists and play Spotify tracks alongside your
                    library.
                </Text>
                <SpotifyConnectButton />
            </Stack>
        );
    }

    if (isLoading) {
        return <Spinner container />;
    }

    const playlists = data?.pages.flatMap((page) => page.items) ?? [];

    return (
        <Stack gap="md" px="md" py="md">
            <Group justify="space-between">
                <Text fw={600} size="xl">
                    My Spotify Playlists
                </Text>
                <SpotifyConnectButton />
            </Group>
            <Stack gap={4}>
                {playlists.map((playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
            </Stack>
            {hasNextPage && (
                <Button
                    loading={isFetchingNextPage}
                    variant="subtle"
                    onClick={() => fetchNextPage()}
                >
                    Load more
                </Button>
            )}
            {playlists.length === 0 && (
                <Text isMuted ta="center" py="xl">
                    No playlists found
                </Text>
            )}
        </Stack>
    );
};

const SpotifyHomeRoute = () => {
    return (
        <AnimatedPage>
            <ScrollArea style={{ height: '100%' }}>
                <SpotifyHomeContent />
            </ScrollArea>
        </AnimatedPage>
    );
};

const SpotifyHomeRouteWithBoundary = () => {
    return (
        <PageErrorBoundary>
            <SpotifyHomeRoute />
        </PageErrorBoundary>
    );
};

export default SpotifyHomeRouteWithBoundary;
