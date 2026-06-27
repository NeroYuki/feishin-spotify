import type {
    DefaultOptions,
    QueryOptions,
    UseInfiniteQueryOptions,
    UseMutationOptions,
    UseQueryOptions,
} from '@tanstack/react-query';

import { QueryCache, QueryClient } from '@tanstack/react-query';

import { toast } from '/@/shared/components/toast/toast';

const queryCache = new QueryCache({
    onError: (error: any, query) => {
        // Suppress toast spam for external enrichment-proxy songs (ext- prefix IDs).
        // These IDs don't exist in Navidrome — the proxy downloads them on-the-fly.
        // API calls that use ext- IDs will fail until the proxy's ID mapping is available.
        const isExtQuery = hasExtIdInQuery(query);
        if (isExtQuery) {
            return;
        }

        if (query.state.data !== undefined) {
            console.error(error);
            toast.show({ message: `${error.message}`, type: 'error' });
        }
    },
});

/** Check whether a query involves an ext- proxy song ID. */
function hasExtIdInQuery(query: any): boolean {
    const queryKey = query?.queryKey;
    if (!Array.isArray(queryKey)) return false;

    return queryKey.some((segment: unknown) => containsExtId(segment));
}

/** Recursively check a value for an ext- prefix string. */
function containsExtId(value: unknown): boolean {
    if (typeof value === 'string' && value.startsWith('ext-')) {
        return true;
    }
    if (Array.isArray(value)) {
        return value.some((item) => containsExtId(item));
    }
    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some((v) => containsExtId(v));
    }
    return false;
}

const queryConfig: DefaultOptions = {
    mutations: {
        retry: process.env.NODE_ENV === 'production' ? 3 : false,
    },
    queries: {
        gcTime: 1000 * 20, // 20 seconds
        refetchOnWindowFocus: false,
        retry: process.env.NODE_ENV === 'production',
        staleTime: 1000 * 10, // 10 seconds
        throwOnError: (error: any) => {
            return error?.response?.status >= 500;
        },
    },
};

export const queryClient = new QueryClient({
    defaultOptions: queryConfig,
    queryCache,
});

export type InfiniteQueryHookArgs<T> = {
    options?: UseInfiniteQueryOptions;
    query: T;
    serverId: string | undefined;
};

export type MutationHookArgs = {
    options?: MutationOptions;
};

export type MutationOptions = {
    mutationKey: UseMutationOptions['mutationKey'];
    onError?: (err: any) => void;
    onSettled?: any;
    onSuccess?: any;
    retry?: UseQueryOptions['retry'];
    retryDelay?: UseQueryOptions['retryDelay'];
    useErrorBoundary?: boolean;
};

export type QueryHookArgs<T> = {
    options?: UseQueryHookOptions;
    query: T;
    serverId: string;
};

type UseQueryHookOptions = {
    enabled?: boolean;
    gcTime?: QueryOptions['gcTime'];
    // initialData?: UseQueryOptions['initialData'];
    // initialDataUpdatedAt?: UseQueryOptions['initialDataUpdatedAt'];
    meta?: UseQueryOptions['meta'];
    networkMode?: UseQueryOptions['networkMode'];
    notifyOnChangeProps?: UseQueryOptions['notifyOnChangeProps'];
    placeholderData?: (prev: any) => any;
    // queryFn?: UseQueryOptions['queryFn'];
    queryKey?: UseQueryOptions['queryKey'];
    queryKeyHashFn?: UseQueryOptions['queryKeyHashFn'];
    refetchInterval?: number;
    refetchIntervalInBackground?: UseQueryOptions['refetchIntervalInBackground'];
    refetchOnMount?: boolean;
    refetchOnReconnect?: boolean;
    refetchOnWindowFocus?: boolean;
    retry?: UseQueryOptions['retry'];
    retryDelay?: UseQueryOptions['retryDelay'];
    retryOnMount?: UseQueryOptions['retryOnMount'];
    // select?: UseQueryOptions['select'];
    staleTime?: number;
    structuralSharing?: UseQueryOptions['structuralSharing'];
    subscribed?: UseQueryOptions['subscribed'];
    throwOnError?: boolean;
};
