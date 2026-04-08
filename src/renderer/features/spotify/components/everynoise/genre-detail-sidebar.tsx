import { useNavigate } from 'react-router';

import type { GenreEntry } from '/@/renderer/features/spotify/api/everynoise-types';
import { useGenreArtists } from '/@/renderer/features/spotify/hooks/use-genre-artists';
import { useGenrePreviewPlayer } from '/@/renderer/features/spotify/hooks/use-genre-preview-player';
import { usePlayerVolume } from '/@/renderer/store/player.store';
import { GenreArtistList } from '/@/renderer/features/spotify/components/everynoise/genre-artist-list';
import { GenrePreviewPlayer } from '/@/renderer/features/spotify/components/everynoise/genre-preview-player';
import { hsvToCss } from '/@/renderer/features/spotify/components/everynoise/genre-scatter-helpers';
import { AppRoute } from '/@/renderer/router/routes';
import { Button } from '/@/shared/components/button/button';
import { Drawer } from '/@/shared/components/drawer/drawer';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

interface Props {
    genre: GenreEntry | null;
    isIndexing: boolean;
    indexingProgress: number;
    maxSongDuration?: number;
    totalGenres: number;
    onClose: () => void;
    onRelatedGenreClick: (genreName: string) => void;
    onSongEnd?: () => void;
    onStartRelatedWalk?: (genre: GenreEntry) => void;
}

export function GenreDetailSidebar({
    genre,
    isIndexing,
    indexingProgress,
    maxSongDuration = 0,
    totalGenres,
    onClose,
    onRelatedGenreClick,
    onSongEnd,
    onStartRelatedWalk,
}: Props) {
    const navigate = useNavigate();
    const { data: artists, isLoading: artistsLoading } = useGenreArtists(genre?.genre ?? null);
    const playerVolume = usePlayerVolume();
    const { state, play, pause, skipNext, stop, playArtistIndex } = useGenrePreviewPlayer(
        artists ?? null,
        playerVolume / 100,
        onSongEnd,
        maxSongDuration,
    );

    const colour = genre ? hsvToCss(...genre.color) : '#1db954';

    const handleOpenPlaylist = () => {
        if (!genre) return;
        const match = genre.spotify_playlist.match(/spotify:playlist:([\w]+)/);
        if (match) {
            navigate(AppRoute.SPOTIFY_PLAYLIST_DETAIL.replace(':playlistId', match[1]));
            onClose();
        }
    };

    return (
        <Drawer
            opened={genre !== null}
            position="right"
            size={420}
            styles={{
                body: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 },
                content: { background: '#17171b', display: 'flex', flexDirection: 'column' },
                header: { background: '#17171b', borderBottom: '1px solid rgba(255,255,255,0.07)' },
            }}
            title={
                genre ? (
                    <Group align="center" gap="sm">
                        <div
                            style={{
                                background: colour,
                                borderRadius: 4,
                                flexShrink: 0,
                                height: 14,
                                width: 14,
                            }}
                        />
                        <Text fw={700} size="lg">
                            {genre.genre}
                        </Text>
                        <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>
                            pop {genre.popularity}
                        </Text>
                    </Group>
                ) : null
            }
            withCloseButton
            withOverlay={false}
            onClose={() => { stop(); onClose(); }}
        >
            {genre && (
                <>
                    {/* ── Sticky top block ── */}
                    <Stack gap="md" p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                        {/* Description */}
                        <Stack gap="xs">
                            <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>
                                About
                            </Text>
                            <Text size="sm" style={{ lineHeight: 1.55 }}>
                                {genre.desc}
                            </Text>
                        </Stack>

                        {/* Reference playlist */}
                        <Button
                            fullWidth
                            leftSection={<Icon icon="list" size="md" />}
                            variant="light"
                            onClick={handleOpenPlaylist}
                        >
                            Open reference playlist
                        </Button>

                        {/* Related Walk */}
                        {onStartRelatedWalk && (
                            <Button
                                fullWidth
                                leftSection={<Icon icon="mediaShuffle" size="md" />}
                                variant="light"
                                onClick={() => {
                                    if (genre) {
                                        stop();
                                        onStartRelatedWalk(genre);
                                        onClose();
                                    }
                                }}
                            >
                                Start Related Walk from here
                            </Button>
                        )}

                        {/* Preview player */}
                        <Stack gap="xs">
                            <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>
                                Now Playing Preview
                            </Text>
                            {artistsLoading && !isIndexing ? (
                                <Spinner />
                            ) : (
                                <GenrePreviewPlayer
                                    artists={artists ?? null}
                                    state={state}
                                    onPause={pause}
                                    onPlay={play}
                                    onSkip={skipNext}
                                />
                            )}
                        </Stack>

                        {/* Indexing progress */}
                        {isIndexing && (
                            <Stack gap="xs">
                                <Text isMuted size="xs">
                                    Indexing artist data ({indexingProgress} / {totalGenres} genres)…
                                </Text>
                                <div
                                    style={{
                                        background: 'rgba(255,255,255,0.08)',
                                        borderRadius: 2,
                                        height: 3,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            background: colour,
                                            height: '100%',
                                            transition: 'width 0.5s ease',
                                            width: totalGenres > 0 ? `${(indexingProgress / totalGenres) * 100}%` : '0%',
                                        }}
                                    />
                                </div>
                            </Stack>
                        )}
                    </Stack>

                    {/* ── Scrollable bottom block: artists + related ── */}
                    <ScrollArea style={{ flex: 1 }}>
                        <Stack gap="md" p="md">
                            {/* Artist list */}
                            <Stack gap="xs">
                                <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>
                                    Top artists
                                </Text>
                                {artistsLoading ? (
                                    isIndexing ? (
                                        <Text isMuted size="sm">
                                            Artist data is still being indexed…
                                        </Text>
                                    ) : (
                                        <Spinner />
                                    )
                                ) : artists && artists.length > 0 ? (
                                    <GenreArtistList
                                        artists={artists}
                                        playerState={state}
                                        onPlayPreview={playArtistIndex}
                                    />
                                ) : (
                                    <Text isMuted size="sm">
                                        No artist data available.
                                    </Text>
                                )}
                            </Stack>

                            {/* Related genres */}
                            {genre.related_genres.length > 0 && (
                                <Stack gap="xs">
                                    <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>
                                        Related genres
                                    </Text>
                                    <Group gap="xs" wrap="wrap">
                                        {genre.related_genres.map((rel) => (
                                            <Button
                                                key={rel.genre}
                                                size="xs"
                                                variant="outline"
                                                onClick={() => {
                                                    stop();
                                                    onRelatedGenreClick(rel.genre);
                                                }}
                                            >
                                                {rel.genre}
                                            </Button>
                                        ))}
                                    </Group>
                                </Stack>
                            )}
                        </Stack>
                    </ScrollArea>
                </>
            )}
        </Drawer>
    );
}
