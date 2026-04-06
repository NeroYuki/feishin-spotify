import { useParams } from 'react-router';

import { SpotifyTrackList } from '/@/renderer/features/spotify/components/spotify-track-list';
import {
    useSpotifyPlaylist,
    useSpotifyPlaylistTracks,
} from '/@/renderer/features/spotify/hooks/use-spotify-playlists';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { Button } from '/@/shared/components/button/button';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Song } from '/@/shared/types/domain-types';

const SpotifyPlaylistDetailContent = () => {
    const { playlistId } = useParams<{ playlistId: string }>();

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
                <Stack gap={4}>
                    <Text fw={600} size="xl">
                        {playlist.name}
                    </Text>
                    {playlist.description && (
                        <Text isMuted size="sm">
                            {playlist.description}
                        </Text>
                    )}
                    <Text isMuted size="sm">
                        {playlist.songCount ?? songs.length} tracks
                    </Text>
                </Stack>
            )}
            <SpotifyTrackList songs={songs} />
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
