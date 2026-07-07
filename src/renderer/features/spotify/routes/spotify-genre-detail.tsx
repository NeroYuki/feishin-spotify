import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';

import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { GenreArtistList } from '/@/renderer/features/spotify/components/everynoise/genre-artist-list';
import { GenrePreviewPlayer } from '/@/renderer/features/spotify/components/everynoise/genre-preview-player';
import { hsvToCss } from '/@/renderer/features/spotify/components/everynoise/genre-scatter-helpers';
import { useGenreArtists } from '/@/renderer/features/spotify/hooks/use-genre-artists';
import { useGenreArtistsIndexer } from '/@/renderer/features/spotify/hooks/use-genre-artists-indexer';
import { useGenreData } from '/@/renderer/features/spotify/hooks/use-genre-data';
import { useGenrePreviewPlayer } from '/@/renderer/features/spotify/hooks/use-genre-preview-player';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { AppRoute } from '/@/renderer/router/routes';
import { usePlayerVolume } from '/@/renderer/store/player.store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

export default function SpotifyGenreDetailPage() {
    const { genreName } = useParams() as { genreName: string };
    const decodedName = decodeURIComponent(genreName);
    const { map: genreMap, isLoaded } = useGenreData();
    const { isIndexing, progress: indexingProgress, totalGenres } = useGenreArtistsIndexer();
    const navigate = useNavigate();
    const playerVolume = usePlayerVolume();

    const genre = genreMap.get(decodedName) || null;

    const { data: artists, isLoading: artistsLoading } = useGenreArtists(genre?.genre ?? null);

    const { state, play, pause, skipNext, stop, playArtistIndex } = useGenrePreviewPlayer(
        artists ?? null,
        playerVolume / 100,
        () => {},
        30,
        false, // no auto-play on page load
    );

    const colour = genre ? hsvToCss(...genre.color) : '#1db954';

    const handleOpenPlaylist = useCallback(() => {
        if (!genre) return;
        const match = genre.spotify_playlist.match(/spotify:playlist:([\w]+)/);
        if (match) {
            navigate(AppRoute.SPOTIFY_PLAYLIST_DETAIL.replace(':playlistId', match[1]));
        }
    }, [genre, navigate]);

    const handleClose = useCallback(() => {
        stop();
        navigate(-1);
    }, [stop, navigate]);

    const handleRelatedGenreClick = useCallback(
        (clickedGenre: string) => {
            stop();
            navigate(
                AppRoute.SPOTIFY_GENRE_DETAIL.replace(':genreName', encodeURIComponent(clickedGenre)),
            );
        },
        [stop, navigate],
    );

    if (!isLoaded) {
        return (
            <AnimatedPage>
                <Spinner container />
            </AnimatedPage>
        );
    }

    if (!genre) {
        return (
            <AnimatedPage>
                <LibraryContainer>
                    <LibraryHeaderBar>
                        <LibraryHeaderBar.Title>Genre not found</LibraryHeaderBar.Title>
                    </LibraryHeaderBar>
                    <Stack align="center" p="xl">
                        <Text isMuted>Could not find genre: {decodedName}</Text>
                        <Button onClick={handleClose} variant="subtle">
                            Go back
                        </Button>
                    </Stack>
                </LibraryContainer>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: colour,
                    children: (
                        <LibraryHeaderBar>
                            <Group align="center" gap="sm">
                                <ActionIcon icon="arrowLeft" onClick={handleClose} size="sm" variant="subtle" />
                                <LibraryHeaderBar.Title>{genre.genre}</LibraryHeaderBar.Title>
                            </Group>
                            <Button leftSection={<Icon icon="list" size="sm" />} size="compact-sm" variant="light" onClick={handleOpenPlaylist}>
                                Open reference playlist
                            </Button>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
            >
                <LibraryContainer>
                    <Stack gap="md" pb="md" pt="md" px="md">
                        <Group align="center" gap="sm">
                            <div style={{ background: colour, borderRadius: 4, flexShrink: 0, height: 16, width: 16 }} />
                            <Text fw={700} size="xl">{genre.genre}</Text>
                            <Text isMuted size="sm" style={{ textTransform: 'uppercase' }}>pop {genre.popularity}</Text>
                        </Group>
                    </Stack>
                    <Stack gap="md" pb="md" pt="md" px="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                        <Stack gap="xs">
                            <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>About</Text>
                            <Text size="sm" style={{ lineHeight: 1.55 }}>{genre.desc}</Text>
                        </Stack>
                        <Button fullWidth leftSection={<Icon icon="list" size="md" />} variant="light" onClick={handleOpenPlaylist}>
                            Open reference playlist
                        </Button>
                        <Stack gap="xs">
                            <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>Now Playing Preview</Text>
                            {artistsLoading && !isIndexing ? (
                                <Spinner />
                            ) : (
                                <GenrePreviewPlayer artists={artists ?? null} state={state} onPause={pause} onPlay={play} onSkip={skipNext} />
                            )}
                        </Stack>
                        {isIndexing && (
                            <Stack gap="xs">
                                <Text isMuted size="xs">Indexing artist data ({indexingProgress} / {totalGenres} genres)…</Text>
                                <div style={{ background: 'var(--mantine-color-default-border)', borderRadius: 2, height: 3, overflow: 'hidden' }}>
                                    <div style={{ background: colour, height: '100%', transition: 'width 0.5s ease', width: totalGenres > 0 ? `${(indexingProgress / totalGenres) * 100}%` : '0%' }} />
                                </div>
                            </Stack>
                        )}
                    </Stack>
                    <Stack gap="md" pb="md" pt="md" px="md">
                        <Stack gap="xs">
                            <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>Top artists</Text>
                            {artistsLoading ? (
                                isIndexing ? <Text isMuted size="sm">Artist data is still being indexed…</Text> : <Spinner />
                            ) : artists && artists.length > 0 ? (
                                <GenreArtistList artists={artists} playerState={state} onPlayPreview={playArtistIndex} />
                            ) : (
                                <Text isMuted size="sm">No artist data available.</Text>
                            )}
                        </Stack>
                        {genre.related_genres.length > 0 && (
                            <Stack gap="xs">
                                <Text isMuted size="xs" style={{ textTransform: 'uppercase' }}>Related genres</Text>
                                <Group gap="xs" wrap="wrap">
                                    {genre.related_genres.map((rel) => (
                                        <Button key={rel.genre} size="xs" variant="outline" onClick={() => handleRelatedGenreClick(rel.genre)}>
                                            {rel.genre}
                                        </Button>
                                    ))}
                                </Group>
                            </Stack>
                        )}
                    </Stack>
                </LibraryContainer>
            </NativeScrollArea>
        </AnimatedPage>
    );
}

const GenreDetailWithBoundary = () => (
    <PageErrorBoundary>
        <SpotifyGenreDetailPage />
    </PageErrorBoundary>
);

export { GenreDetailWithBoundary };
