import { useCallback, useState } from 'react';
import { generatePath, useNavigate, Link } from 'react-router';

import { SpotifyTrackList } from '/@/renderer/features/spotify/components/spotify-track-list';
import {
    useSpotifySearch,
    useSpotifySearchInput,
} from '/@/renderer/features/spotify/hooks/use-spotify-search';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { SpotifyConnectButton } from '/@/renderer/features/spotify/components/spotify-connect-button';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { AppRoute } from '/@/renderer/router/routes';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Tabs } from '/@/shared/components/tabs/tabs';
import { Text } from '/@/shared/components/text/text';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Album, AlbumArtist, LibraryItem, Playlist } from '/@/shared/types/domain-types';

const GENRE_TILES: { color: string; label: string }[] = [
    { color: '#1DB954', label: 'Pop' },
    { color: '#E91429', label: 'Rock' },
    { color: '#148A08', label: 'Hip-Hop' },
    { color: '#E8115B', label: 'R&B' },
    { color: '#0D73EC', label: 'Electronic' },
    { color: '#8D67AB', label: 'Jazz' },
    { color: '#B02897', label: 'Classical' },
    { color: '#DC148C', label: 'Metal' },
    { color: '#E3761B', label: 'Country' },
    { color: '#477D95', label: 'Soul' },
    { color: '#27856A', label: 'Reggae' },
    { color: '#C62F31', label: 'Blues' },
    { color: '#8C1932', label: 'Latin' },
    { color: '#608108', label: 'Folk' },
    { color: '#1BA0D7', label: 'Indie' },
    { color: '#DC148C', label: 'Punk' },
];

interface GenreGridProps {
    onSelect: (genre: string) => void;
}

const GenreGrid = ({ onSelect }: GenreGridProps) => (
    <Stack gap="sm">
        <Text fw={500} size="md">
            Browse by Genre
        </Text>
        <div
            style={{
                display: 'grid',
                gap: 8,
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            }}
        >
            {GENRE_TILES.map(({ color, label }) => (
                <button
                    key={label}
                    style={{
                        alignItems: 'center',
                        background: color,
                        border: 'none',
                        borderRadius: 8,
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        fontWeight: 600,
                        height: 60,
                        justifyContent: 'center',
                        overflow: 'hidden',
                        padding: '8px 12px',
                        textAlign: 'center',
                        transition: 'filter 0.15s',
                    }}
                    onClick={() => onSelect(label)}
                    onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.15)')
                    }
                    onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.filter = '')
                    }
                >
                    {label}
                </button>
            ))}
        </div>
    </Stack>
);

// ---------------------------------------------------------------------------
// Album result card
// ---------------------------------------------------------------------------
const AlbumCard = ({ album, onClick }: { album: Album; onClick: (id: string) => void }) => (
    <Group
        gap="sm"
        px="sm"
        py="xs"
        style={{
            borderBottom: '1px solid var(--mantine-color-dark-6)',
            cursor: 'pointer',
        }}
        wrap="nowrap"
        onClick={() => onClick(album.id)}
    >
        <ItemImage
            enableDebounce={false}
            enableViewport={false}
            id={album.id}
            imageContainerProps={{ style: { borderRadius: 4, flexShrink: 0, height: 48, width: 48 } }}
            itemType={LibraryItem.ALBUM}
            src={album.imageUrl}
        />
        <Stack gap={2} style={{ minWidth: 0 }}>
            <Text overflow="hidden" size="sm">
                {album.name}
            </Text>
            <Text isMuted overflow="hidden" size="xs">
                {album.albumArtistName}
                {album.releaseYear ? ` · ${album.releaseYear}` : ''}
            </Text>
        </Stack>
    </Group>
);

// ---------------------------------------------------------------------------
// Artist result card
// ---------------------------------------------------------------------------
const ArtistCard = ({
    artist,
    onClick,
}: {
    artist: AlbumArtist;
    onClick: (id: string) => void;
}) => (
    <Group
        gap="sm"
        px="sm"
        py="xs"
        style={{
            borderBottom: '1px solid var(--mantine-color-dark-6)',
            cursor: 'pointer',
        }}
        wrap="nowrap"
        onClick={() => onClick(artist.id)}
    >
        <ItemImage
            enableDebounce={false}
            enableViewport={false}
            id={artist.id}
            imageContainerProps={{
                style: { borderRadius: '50%', flexShrink: 0, height: 48, width: 48 },
            }}
            itemType={LibraryItem.ALBUM_ARTIST}
            src={artist.imageUrl}
        />
        <Stack gap={2} style={{ minWidth: 0 }}>
            <Text overflow="hidden" size="sm">
                {artist.name}
            </Text>
            {artist.genres.length > 0 && (
                <Text isMuted overflow="hidden" size="xs">
                    {artist.genres
                        .slice(0, 3)
                        .map((g) => g.name)
                        .join(' · ')}
                </Text>
            )}
        </Stack>
    </Group>
);

// ---------------------------------------------------------------------------
// Playlist result card
// ---------------------------------------------------------------------------
const PlaylistResultCard = ({
    playlist,
}: {
    playlist: Playlist;
}) => {
    const to = generatePath(AppRoute.SPOTIFY_PLAYLIST_DETAIL, { playlistId: playlist.id });
    return (
        <Group
            component={Link}
            gap="sm"
            px="sm"
            py="xs"
            style={{
                borderBottom: '1px solid var(--mantine-color-dark-6)',
                color: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                textDecoration: 'none',
            }}
            to={to}
            wrap="nowrap"
        >
            <ItemImage
                enableDebounce={false}
                enableViewport={false}
                id={playlist.id}
                imageContainerProps={{ style: { borderRadius: 4, flexShrink: 0, height: 48, width: 48 } }}
                itemType={LibraryItem.PLAYLIST}
                src={playlist.imageUrl}
            />
            <Stack gap={2} style={{ minWidth: 0 }}>
                <Text overflow="hidden" size="sm">
                    {playlist.name}
                </Text>
                <Text isMuted overflow="hidden" size="xs">
                    {playlist.songCount ?? 0} tracks
                    {playlist.owner ? ` · ${playlist.owner}` : ''}
                </Text>
            </Stack>
        </Group>
    );
};

// ---------------------------------------------------------------------------
// Main search content
// ---------------------------------------------------------------------------
const SpotifySearchContent = () => {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const { query, setQuery } = useSpotifySearchInput();
    const { data, isFetching } = useSpotifySearch(query);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<null | string>('tracks');

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

    const hasQuery = query.length >= 2;

    return (
        <Stack gap="md" px="md" py="md">
            <Text fw={600} size="xl">
                Search Spotify
            </Text>
            <TextInput
                leftSection={<Icon icon="search" />}
                placeholder="Search for songs, albums, artists, playlists..."
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

            {query.length === 0 && <GenreGrid onSelect={setQuery} />}

            {query.length > 0 && query.length < 2 && (
                <Text isMuted ta="center">
                    Type at least 2 characters to search
                </Text>
            )}

            {isFetching && <Spinner container />}

            {!isFetching && hasQuery && data && (
                <Tabs value={activeTab} onChange={setActiveTab}>
                    <Tabs.List>
                        <Tabs.Tab value="tracks">
                            Tracks
                            {data.total.songs > 0 && (
                                <Text isMuted ml={4} size="xs" span>
                                    {data.total.songs}
                                </Text>
                            )}
                        </Tabs.Tab>
                        <Tabs.Tab value="albums">
                            Albums
                            {data.total.albums > 0 && (
                                <Text isMuted ml={4} size="xs" span>
                                    {data.total.albums}
                                </Text>
                            )}
                        </Tabs.Tab>
                        <Tabs.Tab value="artists">
                            Artists
                            {data.total.artists > 0 && (
                                <Text isMuted ml={4} size="xs" span>
                                    {data.total.artists}
                                </Text>
                            )}
                        </Tabs.Tab>
                        <Tabs.Tab value="playlists">
                            Playlists
                            {data.total.playlists > 0 && (
                                <Text isMuted ml={4} size="xs" span>
                                    {data.total.playlists}
                                </Text>
                            )}
                        </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="tracks" pt="sm">
                        {data.songs.length === 0 ? (
                            <Text isMuted ta="center" py="xl">
                                No tracks found
                            </Text>
                        ) : (
                            <SpotifyTrackList
                                onAlbumClick={handleAlbumClick}
                                onArtistClick={handleArtistClick}
                                songs={data.songs}
                            />
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="albums" pt="sm">
                        {data.albums.length === 0 ? (
                            <Text isMuted ta="center" py="xl">
                                No albums found
                            </Text>
                        ) : (
                            <Stack gap={0}>
                                {data.albums.map((album) => (
                                    <AlbumCard
                                        key={album.id}
                                        album={album}
                                        onClick={handleAlbumClick}
                                    />
                                ))}
                            </Stack>
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="artists" pt="sm">
                        {data.artists.length === 0 ? (
                            <Text isMuted ta="center" py="xl">
                                No artists found
                            </Text>
                        ) : (
                            <Stack gap={0}>
                                {data.artists.map((artist) => (
                                    <ArtistCard
                                        key={artist.id}
                                        artist={artist}
                                        onClick={handleArtistClick}
                                    />
                                ))}
                            </Stack>
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="playlists" pt="sm">
                        {data.playlists.length === 0 ? (
                            <Text isMuted ta="center" py="xl">
                                No playlists found
                            </Text>
                        ) : (
                            <Stack gap={0}>
                                {data.playlists.map((playlist) => (
                                    <PlaylistResultCard key={playlist.id} playlist={playlist} />
                                ))}
                            </Stack>
                        )}
                    </Tabs.Panel>
                </Tabs>
            )}

            {!isFetching && hasQuery && !data && (
                <Text isMuted ta="center" py="xl">
                    No results found
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
