import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { shuffle } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, Link } from 'react-router';

import styles from './featured-genres.module.css';

import { api } from '/@/renderer/api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { genresQueries } from '/@/renderer/features/genres/api/genres-api';
import { useIsPlayerFetching, usePlayer } from '/@/renderer/features/player/context/player-context';
import { PlayButton } from '/@/renderer/features/shared/components/play-button';
import { useGenreData } from '/@/renderer/features/spotify/hooks/use-genre-data';
import { useContainerQuery } from '/@/renderer/hooks';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServer, useCurrentServerId } from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';
import { TextTitle } from '/@/shared/components/text-title/text-title';
import { Genre, GenreListSort, Played, SortOrder } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';
import { stringToColor } from '/@/shared/utils/string-to-color';

function getGenresToShow(breakpoints: {
    isLargerThanLg: boolean;
    isLargerThanMd: boolean;
    isLargerThanSm: boolean;
    isLargerThanXl: boolean;
    isLargerThanXxl: boolean;
    isLargerThanXxxl: boolean;
}) {
    if (breakpoints.isLargerThanXxxl) {
        return 18;
    }

    if (breakpoints.isLargerThanXxl) {
        return 15;
    }

    if (breakpoints.isLargerThanXl) {
        return 12;
    }

    if (breakpoints.isLargerThanLg) {
        return 12;
    }

    if (breakpoints.isLargerThanMd) {
        return 12;
    }

    if (breakpoints.isLargerThanSm) {
        return 8;
    }

    return 6;
}

export const FeaturedGenres = () => {
    const { t } = useTranslation();
    const server = useCurrentServer();
    const [genreSource, setGenreSource] = useState<'local' | 'spotify'>('local');
    const { ref, ...cq } = useContainerQuery({
        lg: 900,
        md: 600,
        sm: 360,
    });

    const genresQuery = useSuspenseQuery({
        ...genresQueries.list({
            query: {
                limit: -1,
                sortBy: GenreListSort.NAME,
                sortOrder: SortOrder.ASC,
                startIndex: 0,
            },
            serverId: server?.id,
        }),
        queryKey: [server.id, 'home', 'featured-genres'],
    });

    const spotifyGenreData = useGenreData();

    const [shuffledGenres, setShuffledGenres] = useState<any[]>([]);
    const [shuffledLocalGenres, setShuffledLocalGenres] = useState<Genre[]>([]);

    // Re-shuffle whenever genreSource or data changes
    useEffect(() => {
        if (genreSource === 'spotify' && spotifyGenreData.isLoaded) {
            setShuffledGenres(shuffle([...spotifyGenreData.genres]));
        }
    }, [genreSource, spotifyGenreData.isLoaded, spotifyGenreData.genres]);

    useEffect(() => {
        if (genreSource === 'local' && genresQuery.data?.items) {
            setShuffledLocalGenres(shuffle([...genresQuery.data.items]));
        }
    }, [genreSource, genresQuery.data?.items]);

    const randomGenres = genreSource === 'spotify' ? shuffledGenres : shuffledLocalGenres;

    const doRefresh = useCallback(() => {
        if (genreSource === 'spotify' && spotifyGenreData.isLoaded) {
            setShuffledGenres(shuffle([...spotifyGenreData.genres]));
        } else if (genresQuery.data?.items) {
            setShuffledLocalGenres(shuffle([...genresQuery.data.items]));
        }
    }, [genreSource, spotifyGenreData, genresQuery.data?.items]);

    const genresToShow = useMemo(() => {
        return getGenresToShow({
            isLargerThanLg: cq.isLg,
            isLargerThanMd: cq.isMd,
            isLargerThanSm: cq.isSm,
            isLargerThanXl: cq.isXl,
            isLargerThanXxl: cq.is2xl,
            isLargerThanXxxl: cq.is3xl,
        });
    }, [cq.isLg, cq.isMd, cq.isSm, cq.isXl, cq.is2xl, cq.is3xl]);

    const visibleGenres = useMemo(() => {
        return randomGenres.slice(0, genresToShow);
    }, [randomGenres, genresToShow]);

    const genresWithColors = useMemo(() => {
        if (!visibleGenres) return [];

        if (genreSource === 'spotify') {
            return (visibleGenres as any[]).map((genre: any) => {
                const isLight = false;

                return {
                    ...genre,
                    color: `hsl(${genre.color?.[0] || 200}, 70%, 50%)`,
                    id: `spotify:${genre.genre}`,
                    isLight,
                    name: genre.genre,
                    path: generatePath(AppRoute.SPOTIFY_GENRE_DETAIL, {
                        genreName: encodeURIComponent(genre.genre),
                    }),
                };
            });
        }

        return visibleGenres.map((genre: Genre) => {
            const { color, isLight } = stringToColor(genre.name);
            const path = generatePath(AppRoute.LIBRARY_GENRES_DETAIL, { genreId: genre.id });

            return {
                ...genre,
                color,
                isLight,
                path,
            };
        });
    }, [visibleGenres, genreSource]);

    return (
        <div className={styles.container} ref={ref}>
            {cq.isCalculated && (
                <>
                    <Group align="flex-end" justify="space-between">
                        <div style={{ alignItems: 'flex-end', display: 'flex', gap: '12px' }}>
                            <TextTitle fw={700} isNoSelect order={3}>
                                {t('entity.genre', { count: 2 })}
                            </TextTitle>
                            <SegmentedControl
                                data={[
                                    { label: 'Local', value: 'local' },
                                    { label: 'Spotify', value: 'spotify' },
                                ]}
                                onChange={(value) => setGenreSource(value as 'local' | 'spotify')}
                                size="xs"
                                value={genreSource}
                            />
                            <ActionIcon
                                icon="refresh"
                                iconProps={{ size: 'xs' }}
                                onClick={doRefresh}
                                size="xs"
                                tooltip={{ label: 'Refresh genres' }}
                                variant="transparent"
                            />
                        </div>
                        <Button
                            component={Link}
                            size="compact-sm"
                            to={AppRoute.LIBRARY_GENRES}
                            variant="subtle"
                        >
                            {t('action.viewMore')}
                        </Button>
                    </Group>
                    <div className={styles.grid}>
                        {genresWithColors.map((genre) => (
                            <GenreItem genre={genre} key={genre.id} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const GenrePlayButton = ({ genre }: { genre: Genre }) => {
    const queryClient = useQueryClient();
    const isPlayerFetching = useIsPlayerFetching();
    const player = usePlayer();
    const serverId = useCurrentServerId();

    const handlePlay = useCallback(
        async (genre: Genre) => {
            if (!serverId) return;

            const data = await queryClient.fetchQuery({
                gcTime: 0,
                queryFn: () => {
                    return api.controller.getRandomSongList({
                        apiClientProps: { serverId },
                        query: {
                            genre: genre.id,
                            limit: 100,
                            played: Played.All,
                        },
                    });
                },
                queryKey: queryKeys.player.fetch(),
                staleTime: 0,
            });

            player.addToQueueByData(data?.items || [], Play.NOW);
        },
        [player, queryClient, serverId],
    );

    return (
        <span className={styles.playButtonWrapper}>
            <PlayButton
                fill={true}
                isSecondary
                loading={isPlayerFetching}
                onClick={() => handlePlay(genre)}
            />
        </span>
    );
};

const GenreItem = memo(({ genre }: { genre: Genre & { color: string; path: string } }) => {
    return (
        <div
            className={styles.genreContainer}
            key={genre.id}
            style={
                {
                    '--genre-color': genre.color,
                } as React.CSSProperties
            }
        >
            <Link className={styles.genreLink} state={{ item: genre }} to={genre.path}>
                <span className={styles.genreName}>{genre.name}</span>
                <GenrePlayButton genre={genre} />
            </Link>
        </div>
    );
});

GenreItem.displayName = 'GenreItem';
