import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { api } from '/@/renderer/api';
import {
    audioMuseAIClient,
    AudioMuseTrack,
} from '/@/renderer/api/audiomuse-ai/audiomuse-ai-client';
import {
    GridCarousel,
    GridCarouselSkeletonFallback,
    useGridCarouselContainerQuery,
} from '/@/renderer/components/grid-carousel/grid-carousel-v2';
import { DataRow, MemoizedItemCard } from '/@/renderer/components/item-card/item-card';
import { useDefaultItemListControls } from '/@/renderer/components/item-list/helpers/item-list-controls';
import { useGridRows } from '/@/renderer/components/item-list/helpers/use-grid-rows';
import { DefaultItemControlProps } from '/@/renderer/components/item-list/types';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useCurrentServer, useCurrentServerWithCredential } from '/@/renderer/store';
import { LibraryItem, Song } from '/@/shared/types/domain-types';
import { ItemListKey, Play } from '/@/shared/types/types';

const RECOMMENDED_STALE_TIME = 4 * 60 * 60 * 1000;
const PAGE_SIZE = 20;

interface RecommendedTracksCarouselProps {
    containerQuery?: ReturnType<typeof useGridCarouselContainerQuery>;
    title: string;
}

interface SongPage {
    items: Song[];
}

function RecommendedTracksCarouselInner({
    containerQuery,
    rows,
    title,
}: RecommendedTracksCarouselProps & { rows: DataRow[] }) {
    const server = useCurrentServer();
    const serverWithCredential = useCurrentServerWithCredential();
    const serverId = server?.id || '';
    const baseUrl = server?.audioMuseAIUrl;
    const token = server?.audioMuseAIToken || '';

    const { data: trackIds, isPending: idsPending } = useQuery<string[]>({
        enabled: Boolean(baseUrl) && Boolean(serverId),
        gcTime: RECOMMENDED_STALE_TIME,
        queryFn: async () => {
            if (!baseUrl) return [];
            const cred = serverWithCredential;
            const typeLower = cred?.type?.toLowerCase();

            let tracks: AudioMuseTrack[] = [];
            if (typeLower === 'jellyfin') {
                tracks = await audioMuseAIClient.sonicFingerprint({
                    baseUrl,
                    jellyfinToken: cred?.credential || undefined,
                    jellyfinUserId: cred?.userId || undefined,
                    n: 100,
                    token,
                });
            } else if (typeLower === 'navidrome' || typeLower === 'subsonic') {
                tracks = await audioMuseAIClient.sonicFingerprint({
                    baseUrl,
                    n: 100,
                    navidromePassword: server?.audioMuseAIPassword || undefined,
                    navidromeUser: cred?.username || undefined,
                    token,
                });
            } else {
                tracks = await audioMuseAIClient.sonicFingerprint({
                    baseUrl,
                    n: 100,
                    token,
                });
            }
            return tracks.map((t) => t.item_id);
        },
        queryKey: ['home', 'recommended-fingerprint', baseUrl, serverId],
        staleTime: RECOMMENDED_STALE_TIME,
    });

    const idsList = trackIds || [];

    const {
        data: songPages,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isPending: songsPending,
        refetch,
    } = useInfiniteQuery<SongPage>({
        enabled: idsList.length > 0,
        getNextPageParam: (_lastPage, allPages) => {
            const totalFetched = allPages.reduce((sum, p) => sum + p.items.length, 0);
            if (totalFetched >= idsList.length) return undefined;
            return String(totalFetched);
        },
        initialPageParam: '0',
        queryFn: async ({ pageParam }) => {
            const start = Number(pageParam);
            const batchIds = idsList.slice(start, start + PAGE_SIZE);

            const songs = await Promise.all(
                batchIds.map((id) =>
                    api.controller.getSongDetail({
                        apiClientProps: { serverId },
                        query: { id },
                    }),
                ),
            );

            return { items: songs.filter(Boolean) as Song[] };
        },
        queryKey: ['home', 'recommended-songs', serverId],
    });

    const player = usePlayer();
    const baseControls = useDefaultItemListControls();

    const controls = useMemo(() => {
        return {
            ...baseControls,
            onPlay: ({ item, playType }: DefaultItemControlProps & { playType: Play }) => {
                if (!item) return;
                player.addToQueueByData([item as Song], playType);
            },
        };
    }, [baseControls, player]);

    const cards = useMemo(() => {
        const allItems = songPages?.pages.flatMap((page) => page.items) || [];
        return allItems.map((song: Song) => ({
            content: (
                <MemoizedItemCard
                    controls={controls}
                    data={song}
                    enableDrag
                    imageFetchPriority="low"
                    itemType={LibraryItem.SONG}
                    rows={rows}
                    type="poster"
                    withControls
                />
            ),
            id: song.id,
        }));
    }, [songPages, controls, rows]);

    const handleNextPage = useCallback(() => {}, []);
    const handlePrevPage = useCallback(() => {}, []);

    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    if (!baseUrl) return null;

    if (idsPending || songsPending) {
        return (
            <GridCarouselSkeletonFallback
                containerQuery={containerQuery}
                placeholderItemType={LibraryItem.SONG}
                placeholderRows={rows}
                title={title}
            />
        );
    }

    if (idsList.length === 0) return null;

    return (
        <GridCarousel
            cards={cards}
            containerQuery={containerQuery}
            enableRefresh
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            loadNextPage={fetchNextPage}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            onRefresh={handleRefresh}
            placeholderItemType={LibraryItem.SONG}
            placeholderRows={rows}
            rowCount={1}
            title={title}
        />
    );
}

export const RecommendedTracksCarousel = ({
    containerQuery,
    title,
}: RecommendedTracksCarouselProps) => {
    const rows = useGridRows(LibraryItem.SONG, ItemListKey.SONG);

    return (
        <RecommendedTracksCarouselInner
            containerQuery={containerQuery}
            rows={rows}
            title={title}
        />
    );
};
