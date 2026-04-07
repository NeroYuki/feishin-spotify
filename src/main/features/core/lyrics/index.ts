import { ipcMain } from 'electron';

import { store } from '../settings';
import { getLyricsBySongId as getGenius, getSearchResults as searchGenius } from './genius';
import { getLyricsBySongId as getLrcLib, getSearchResults as searchLrcLib } from './lrclib';
import { getLyricsBySongId as getNetease, getSearchResults as searchNetease } from './netease';
import {
    fetchForSong as fetchRomanizeProxySong,
    getLyricsBySongId as getRomanizeProxy,
    getSearchResults as searchRomanizeProxy,
} from './romanize-proxy';
import { orderSearchResults } from './shared';
import {
    getLyricsBySongId as getSimpMusic,
    getSearchResults as searchSimpMusic,
} from './simpmusic';

import { Song } from '/@/shared/types/domain-types';

export enum LyricSource {
    GENIUS = 'Genius',
    LRCLIB = 'lrclib.net',
    NETEASE = 'NetEase',
    ROMANIZE_PROXY = 'Romanize Proxy',
    SIMPMUSIC = 'SimpMusic',
}

export type FullLyricsMetadata = Omit<InternetProviderLyricResponse, 'id' | 'lyrics' | 'source'> & {
    lyrics: LyricsResponse;
    remote: boolean;
    source: string;
};

export type InternetProviderLyricResponse = {
    artist: string;
    id: string;
    lyrics: string;
    name: string;
    source: LyricSource;
};

export type InternetProviderLyricSearchResponse = {
    artist: string;
    id: string;
    isSync: boolean | null;
    name: string;
    score?: number;
    source: LyricSource;
};

export type LyricGetQuery = {
    remoteSongId: string;
    remoteSource: LyricSource;
    song: Song;
};

export type LyricOverride = Omit<InternetProviderLyricResponse, 'lyrics'>;

export type LyricSearchQuery = {
    album?: string;
    artist?: string;
    duration?: number;
    name?: string;
};

export type LyricsResponse = string | SynchronizedLyricsArray;

export type SynchronizedLyricsArray = Array<[number, string]>;

type CachedLyrics = Record<LyricSource, InternetProviderLyricResponse>;
type GetFetcher = (id: string) => Promise<null | string>;
type SearchFetcher = (
    params: LyricSearchQuery,
) => Promise<InternetProviderLyricSearchResponse[] | null>;

const SEARCH_FETCHERS: Record<LyricSource, SearchFetcher> = {
    [LyricSource.GENIUS]: searchGenius,
    [LyricSource.LRCLIB]: searchLrcLib,
    [LyricSource.NETEASE]: searchNetease,
    [LyricSource.ROMANIZE_PROXY]: searchRomanizeProxy,
    [LyricSource.SIMPMUSIC]: searchSimpMusic,
};

const GET_FETCHERS: Record<LyricSource, GetFetcher> = {
    [LyricSource.GENIUS]: getGenius,
    [LyricSource.LRCLIB]: getLrcLib,
    [LyricSource.NETEASE]: getNetease,
    [LyricSource.ROMANIZE_PROXY]: getRomanizeProxy,
    [LyricSource.SIMPMUSIC]: getSimpMusic,
};

const MAX_CACHED_ITEMS = 10;

const lyricCache = new Map<string, CachedLyrics>();

const searchAllSources = async (
    params: LyricSearchQuery,
    sourcesOverride?: LyricSource[],
): Promise<InternetProviderLyricSearchResponse[]> => {
    const sources = sourcesOverride ?? (store.get('lyrics', []) as LyricSource[]);

    const searchPromises = sources.map((source) =>
        SEARCH_FETCHERS[source](params).then((searchResults) => ({ searchResults, source })),
    );

    const settled = await Promise.allSettled(searchPromises);

    const allSearchResults: InternetProviderLyricSearchResponse[] = [];

    for (const result of settled) {
        if (result.status === 'fulfilled' && result.value.searchResults) {
            const { source, searchResults } = result.value;
            console.log(
                `[Lyrics] ${source}: returned ${searchResults.length} result(s)`,
                searchResults.map((r) => ({
                    artist: r.artist,
                    id: r.id,
                    isSync: r.isSync,
                    name: r.name,
                    source: r.source,
                })),
            );
            allSearchResults.push(...searchResults);
        } else if (result.status === 'rejected') {
            const index = settled.indexOf(result);
            console.error(`[Lyrics] ${sources[index]}: search failed:`, result.reason);
        } else if (result.status === 'fulfilled' && !result.value.searchResults) {
            console.log(`[Lyrics] ${result.value.source}: returned null (no results)`);
        }
    }
    return allSearchResults;
};

const getRemoteLyrics = async (song: Song) => {
    const sources = store.get('lyrics', []) as LyricSource[];

    const cached = lyricCache.get(song.id.toString());

    if (cached) {
        for (const source of sources) {
            const data = cached[source];
            if (data) return data;
        }
    }

    const params: LyricSearchQuery = {
        album: song.album || song.name,
        artist: song.artists[0].name,
        duration: song.duration / 1000.0,
        name: song.name,
    };

    // Romanize Proxy is handled exclusively via the background fetch mechanism;
    // exclude it from the main auto-fetch pipeline so regular sources return quickly.
    const autoSources = sources.filter((s) => s !== LyricSource.ROMANIZE_PROXY);
    const allSearchResults = await searchAllSources(params, autoSources);

    if (allSearchResults.length === 0) {
        return null;
    }

    const rankedResults = orderSearchResults({
        params,
        results: allSearchResults,
    });

    if (rankedResults.length === 0) {
        return null;
    }

    // Score is 0-1 where 0 = perfect match, 1 = worst match
    const matchThreshold = 0.55;

    const bestMatch = rankedResults[0];

    if (!bestMatch) {
        return null;
    }

    const matchScore = bestMatch.score ?? 1;

    if (matchScore > matchThreshold) {
        console.log(`[Lyrics] best match score ${matchScore} exceeds threshold ${matchThreshold}, returning null`);
        return null;
    }

    console.log(`[Lyrics] selected: ${bestMatch.source} — "${bestMatch.name}" by "${bestMatch.artist}" (score: ${bestMatch.score})`);

    let lyricsFromSource: InternetProviderLyricResponse | null = null;

    try {
        const lyrics = await GET_FETCHERS[bestMatch.source](bestMatch.id);
        if (lyrics) {
            lyricsFromSource = {
                artist: bestMatch.artist,
                id: bestMatch.id,
                lyrics,
                name: bestMatch.name,
                source: bestMatch.source,
            };
        }
    } catch (error) {
        console.error(`Error fetching lyrics from ${bestMatch.source}:`, error);
    }

    if (lyricsFromSource) {
        const newResult = cached
            ? {
                  ...cached,
                  [lyricsFromSource.source]: lyricsFromSource,
              }
            : ({ [lyricsFromSource.source]: lyricsFromSource } as CachedLyrics);

        if (lyricCache.size === MAX_CACHED_ITEMS && cached === undefined) {
            const toRemove = lyricCache.keys().next().value;
            if (toRemove) {
                lyricCache.delete(toRemove);
            }
        }

        lyricCache.set(song.id.toString(), newResult);
    }

    return lyricsFromSource;
};

const searchRemoteLyrics = async (params: LyricSearchQuery) => {
    // Romanize Proxy is slow (up to 30s timeout) and handled via dedicated background fetch;
    // exclude it here so it doesn't block lrclib/netease results in the search modal.
    const sources = (store.get('lyrics', []) as LyricSource[]).filter(
        (s) => s !== LyricSource.ROMANIZE_PROXY,
    );
    const allSearchResults = await searchAllSources(params, sources);

    const results: Record<LyricSource, InternetProviderLyricSearchResponse[]> = {
        [LyricSource.GENIUS]: [],
        [LyricSource.LRCLIB]: [],
        [LyricSource.NETEASE]: [],
        [LyricSource.ROMANIZE_PROXY]: [],
        [LyricSource.SIMPMUSIC]: [],
    };
    for (const item of allSearchResults) {
        results[item.source].push(item);
    }
    return results;
};

const getRemoteLyricsById = async (params: LyricGetQuery): Promise<null | string> => {
    const { remoteSongId, remoteSource } = params;
    const response = await GET_FETCHERS[remoteSource](remoteSongId);

    if (!response) {
        return null;
    }

    return response;
};

ipcMain.handle('lyric-cache-clear', () => {
    lyricCache.clear();
});

const romanizeAbortControllers = new Map<string, AbortController>();

ipcMain.handle('lyric-romanize-proxy-fetch', async (_event, songId: string, params: LyricSearchQuery, apiKey: string) => {
    // Cancel any existing in-flight fetch before starting a new one
    for (const [key, controller] of romanizeAbortControllers) {
        controller.abort();
        romanizeAbortControllers.delete(key);
    }
    const controller = new AbortController();
    romanizeAbortControllers.set(songId, controller);
    try {
        const result = await fetchRomanizeProxySong(params, controller.signal, apiKey);
        return result;
    } finally {
        romanizeAbortControllers.delete(songId);
    }
});

ipcMain.handle('lyric-romanize-proxy-cancel', (_event, songId: string) => {
    const controller = romanizeAbortControllers.get(songId);
    if (controller) {
        controller.abort();
        romanizeAbortControllers.delete(songId);
    }
});

ipcMain.handle('lyric-by-song', async (_event, song: any) => {
    const lyric = await getRemoteLyrics(song);
    return lyric;
});

ipcMain.handle('lyric-search', async (_event, params: LyricSearchQuery) => {
    const lyricResults = await searchRemoteLyrics(params);
    return lyricResults;
});

ipcMain.handle('lyric-by-remote-id', async (_event, params: LyricGetQuery) => {
    const lyricResults = await getRemoteLyricsById(params);
    return lyricResults;
});
