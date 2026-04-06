import { SpotifyTrackList } from '/@/renderer/features/spotify/components/spotify-track-list';
import {
    useSpotifySearch,
    useSpotifySearchInput,
} from '/@/renderer/features/spotify/hooks/use-spotify-search';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { SpotifyConnectButton } from '/@/renderer/features/spotify/components/spotify-connect-button';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Icon } from '/@/shared/components/icon/icon';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { TextInput } from '/@/shared/components/text-input/text-input';

const SpotifySearchContent = () => {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const { query, setQuery } = useSpotifySearchInput();
    const { data, isFetching } = useSpotifySearch(query);

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

    return (
        <Stack gap="md" px="md" py="md">
            <Text fw={600} size="xl">
                Search Spotify
            </Text>
            <TextInput
                leftSection={<Icon icon="search" />}
                placeholder="Search for songs..."
                radius="xl"
                rightSection={
                    query ? (
                        <ActionIcon
                            icon="x"
                            size="sm"
                            variant="transparent"
                            onClick={() => setQuery('')}
                        />
                    ) : null
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {isFetching && <Spinner container />}
            {!isFetching && data && (
                <Stack gap="xs">
                    <Text isMuted size="sm">
                        {data.total.songs} results
                    </Text>
                    <SpotifyTrackList songs={data.songs} />
                </Stack>
            )}
            {!isFetching && !data && query.length >= 2 && (
                <Text isMuted ta="center" py="xl">
                    No results found
                </Text>
            )}
            {query.length < 2 && query.length > 0 && (
                <Text isMuted ta="center">
                    Type at least 2 characters to search
                </Text>
            )}
        </Stack>
    );
};

const SpotifySearchRoute = () => {
    return (
        <AnimatedPage>
            <ScrollArea style={{ height: '100%' }}>
                <SpotifySearchContent />
            </ScrollArea>
        </AnimatedPage>
    );
};

const SpotifySearchRouteWithBoundary = () => {
    return (
        <PageErrorBoundary>
            <SpotifySearchRoute />
        </PageErrorBoundary>
    );
};

export default SpotifySearchRouteWithBoundary;
