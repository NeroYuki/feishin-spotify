import { Suspense, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGridCarouselContainerQuery } from '/@/renderer/components/grid-carousel/grid-carousel-v2';
import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { AlbumInfiniteCarousel } from '/@/renderer/features/albums/components/album-infinite-carousel';
import { AlbumInfiniteFeatureCarousel } from '/@/renderer/features/home/components/album-infinite-feature-carousel';
import { AlbumInfiniteSingleFeatureCarousel } from '/@/renderer/features/home/components/album-infinite-single-feature-carousel';
import { FeaturedGenres } from '/@/renderer/features/home/components/featured-genres';
import { RecommendedTracksCarousel } from '/@/renderer/features/home/components/recommended-tracks-carousel';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { SongInfiniteCarousel } from '/@/renderer/features/songs/components/song-infinite-carousel';
import {
    HomeFeatureStyle,
    HomeItem,
    useCurrentServer,
    useHomeFeature,
    useHomeFeatureStyle,
    useHomeItems,
    useWindowSettings,
} from '/@/renderer/store';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import {
    AlbumListSort,
    LibraryItem,
    ServerType,
    SongListSort,
    SortOrder,
} from '/@/shared/types/domain-types';
import { Platform } from '/@/shared/types/types';

const VIEW_TOGGLE_SECTIONS = new Set([
    HomeItem.MOST_PLAYED,
    HomeItem.RANDOM,
    HomeItem.RECENTLY_ADDED,
    HomeItem.RECENTLY_PLAYED,
    HomeItem.RECENTLY_RELEASED,
]);

type ItemView = 'album' | 'song';

const HomeRoute = () => {
    const { t } = useTranslation();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const server = useCurrentServer();
    const { windowBarStyle } = useWindowSettings();
    const homeFeature = useHomeFeature();
    const homeFeatureStyle = useHomeFeatureStyle();
    const homeItems = useHomeItems();
    const containerQuery = useGridCarouselContainerQuery();
    const [itemViews, setItemViews] = useState<Record<string, ItemView>>({});

    const isJellyfin = server?.type === ServerType.JELLYFIN;

    const carousels: Record<string, any> = {
        [HomeItem.MOST_PLAYED]: {
            album: {
                enableRefresh: true,
                sortBy: AlbumListSort.PLAY_COUNT,
                sortOrder: SortOrder.DESC,
                title: t('page.home.mostPlayed'),
            },
            song: {
                enableRefresh: true,
                sortBy: SongListSort.PLAY_COUNT,
                sortOrder: SortOrder.DESC,
                title: t('page.home.mostPlayed'),
            },
        },
        [HomeItem.RANDOM]: {
            album: {
                enableRefresh: true,
                sortBy: AlbumListSort.RANDOM,
                sortOrder: SortOrder.ASC,
                title: t('page.home.explore'),
            },
            song: {
                enableRefresh: true,
                sortBy: SongListSort.RANDOM,
                sortOrder: SortOrder.ASC,
                title: t('page.home.explore'),
            },
        },
        [HomeItem.RECENTLY_ADDED]: {
            album: {
                enableRefresh: true,
                sortBy: AlbumListSort.RECENTLY_ADDED,
                sortOrder: SortOrder.DESC,
                title: t('page.home.newlyAdded'),
            },
            song: {
                enableRefresh: true,
                sortBy: SongListSort.RECENTLY_ADDED,
                sortOrder: SortOrder.DESC,
                title: t('page.home.newlyAdded'),
            },
        },
        [HomeItem.RECENTLY_PLAYED]: {
            album: {
                enableRefresh: true,
                sortBy: AlbumListSort.RECENTLY_PLAYED,
                sortOrder: SortOrder.DESC,
                title: t('page.home.recentlyPlayed'),
            },
            song: {
                enableRefresh: true,
                sortBy: SongListSort.RECENTLY_PLAYED,
                sortOrder: SortOrder.DESC,
                title: t('page.home.recentlyPlayed'),
            },
        },
        [HomeItem.RECENTLY_RELEASED]: {
            album: {
                enableRefresh: true,
                sortBy: AlbumListSort.RELEASE_DATE,
                sortOrder: SortOrder.DESC,
                title: t('page.home.recentlyReleased'),
                maxYear: new Date().getFullYear(),
            },
            song: {
                enableRefresh: true,
                sortBy: SongListSort.RELEASE_DATE,
                sortOrder: SortOrder.DESC,
                title: t('page.home.recentlyReleased'),
            },
        },
    };

    const getDefaultView = (itemId: HomeItem): ItemView => {
        if (isJellyfin) return 'song';
        return 'album';
    };

    const sortedItems = homeItems.filter((item) => !item.disabled);

    const renderCarousel = (item: { disabled: boolean; id: HomeItem }) => {
        if (item.id === HomeItem.RECOMMENDED) {
            return (
                <RecommendedTracksCarousel
                    containerQuery={containerQuery}
                    key="recommended-tracks"
                    title={t('page.home.recommendedTracks')}
                />
            );
        }

        if (item.id === HomeItem.GENRES) {
            return <FeaturedGenres key="featured-genres" />;
        }

        const sectionCfg = carousels[item.id];
        if (!sectionCfg) return null;

        const viewMode = itemViews[item.id] || getDefaultView(item.id);
        const cfg = VIEW_TOGGLE_SECTIONS.has(item.id) ? sectionCfg[viewMode] : sectionCfg.album || sectionCfg;
        if (!cfg) return null;

        const isAlbum = viewMode === 'album';
        const toggleActions = VIEW_TOGGLE_SECTIONS.has(item.id) ? (
            <SegmentedControl
                data={[
                    { label: t('entity.album', { count: 2 }), value: 'album' },
                    { label: t('entity.track', { count: 2 }), value: 'song' },
                ]}
                onChange={(value) =>
                    setItemViews((prev) => ({ ...prev, [item.id]: value as ItemView }))
                }
                size="xs"
                value={viewMode}
            />
        ) : undefined;

        if (isAlbum) {
            return (
                <AlbumInfiniteCarousel
                    actions={toggleActions}
                    containerQuery={containerQuery}
                    enableRefresh={cfg.enableRefresh}
                    key={`carousel-${item.id}-${viewMode}`}
                    query={cfg.maxYear ? { maxYear: cfg.maxYear } : undefined}
                    queryKey={['home', 'album', item.id, viewMode] as const}
                    rowCount={1}
                    sortBy={cfg.sortBy as AlbumListSort}
                    sortOrder={cfg.sortOrder}
                    title={cfg.title}
                />
            );
        }

        return (
            <SongInfiniteCarousel
                actions={toggleActions}
                containerQuery={containerQuery}
                enableRefresh={cfg.enableRefresh}
                key={`carousel-${item.id}-${viewMode}`}
                queryKey={['home', 'song', item.id, viewMode] as const}
                rowCount={1}
                sortBy={cfg.sortBy as SongListSort}
                sortOrder={cfg.sortOrder}
                title={cfg.title}
            />
        );
    };

    return (
        <AnimatedPage>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: 'var(--theme-colors-background)',
                    children: (
                        <LibraryHeaderBar>
                            <LibraryHeaderBar.Title>{t('page.home.title')}</LibraryHeaderBar.Title>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
                ref={scrollAreaRef}
            >
                <LibraryContainer>
                    <Stack
                        gap="2xl"
                        mb="5rem"
                        pt={windowBarStyle === Platform.WEB ? '5rem' : '3rem'}
                        px="2rem"
                        ref={containerQuery.ref}
                    >
                        {homeFeature && homeFeatureStyle === HomeFeatureStyle.SINGLE && (
                            <AlbumInfiniteSingleFeatureCarousel />
                        )}
                        {homeFeature && homeFeatureStyle === HomeFeatureStyle.MULTIPLE && (
                            <AlbumInfiniteFeatureCarousel />
                        )}
                        {sortedItems.map((item) => renderCarousel(item))}
                    </Stack>
                </LibraryContainer>
            </NativeScrollArea>
        </AnimatedPage>
    );
};

const HomeRouteWithBoundary = () => {
    return (
        <PageErrorBoundary>
            <Suspense fallback={<Spinner container />}>
                <HomeRoute />
            </Suspense>
        </PageErrorBoundary>
    );
};

export default HomeRouteWithBoundary;
