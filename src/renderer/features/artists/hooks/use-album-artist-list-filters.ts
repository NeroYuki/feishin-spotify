import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { useSearchTermFilter } from '/@/renderer/features/shared/hooks/use-search-term-filter';
import { useSortByFilter } from '/@/renderer/features/shared/hooks/use-sort-by-filter';
import { useSortOrderFilter } from '/@/renderer/features/shared/hooks/use-sort-order-filter';
import { FILTER_KEYS } from '/@/renderer/features/shared/utils';
import { parseBooleanParam, setMultipleSearchParams } from '/@/renderer/utils/query-params';
import { runInUrlTransition } from '/@/renderer/utils/url-transition';
import { AlbumArtistListSort, ArtistListSort } from '/@/shared/types/domain-types';
import { ItemListKey } from '/@/shared/types/types';

export const useAlbumArtistListFilters = () => {
    const { sortBy } = useSortByFilter<AlbumArtistListSort>(
        ArtistListSort.NAME,
        ItemListKey.ALBUM_ARTIST,
    );

    const { sortOrder } = useSortOrderFilter(null, ItemListKey.ALBUM_ARTIST);

    const { searchTerm, setSearchTerm } = useSearchTermFilter('');

    const [searchParams, setSearchParams] = useSearchParams();

    const spotifySearch = useMemo(
        () => parseBooleanParam(searchParams, FILTER_KEYS.SHARED.SPOTIFY_SEARCH),
        [searchParams],
    );

    const clear = useCallback(() => {
        runInUrlTransition(() => {
            setSearchParams(
                (prev) =>
                    setMultipleSearchParams(prev, {
                        [FILTER_KEYS.SHARED.SEARCH_TERM]: null,
                        [FILTER_KEYS.SHARED.SPOTIFY_SEARCH]: null,
                    }),
                { replace: true },
            );
        });
    }, [setSearchParams]);

    const query = {
        [FILTER_KEYS.SHARED.SEARCH_TERM]: searchTerm ?? undefined,
        [FILTER_KEYS.SHARED.SORT_BY]: sortBy ?? undefined,
        [FILTER_KEYS.SHARED.SORT_ORDER]: sortOrder ?? undefined,
        [FILTER_KEYS.SHARED.SPOTIFY_SEARCH]: spotifySearch ?? undefined,
    };

    return {
        clear,
        query,
        setSearchTerm,
    };
};
