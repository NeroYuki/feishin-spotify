import { ipcRenderer } from 'electron';

import {
    InternetProviderLyricResponse,
    InternetProviderLyricSearchResponse,
    LyricGetQuery,
    LyricSearchQuery,
    LyricSource,
} from '../main/features/core/lyrics';

import { QueueSong } from '/@/shared/types/domain-types';

const getRemoteLyricsBySong = (song: QueueSong) => {
    const result = ipcRenderer.invoke('lyric-by-song', song);
    return result;
};

const searchRemoteLyrics = (
    params: LyricSearchQuery,
): Promise<Record<LyricSource, InternetProviderLyricSearchResponse[]>> => {
    const result = ipcRenderer.invoke('lyric-search', params);
    return result;
};

const getRemoteLyricsByRemoteId = (id: LyricGetQuery) => {
    const result = ipcRenderer.invoke('lyric-by-remote-id', id);
    return result;
};

const clearLyricsCache = (): Promise<void> => {
    return ipcRenderer.invoke('lyric-cache-clear');
};

const fetchRomanizeProxyLyrics = (
    songId: string,
    params: LyricSearchQuery,
    apiKey: string,
): Promise<InternetProviderLyricResponse | null> => {
    return ipcRenderer.invoke('lyric-romanize-proxy-fetch', songId, params, apiKey);
};

const cancelRomanizeProxyFetch = (songId: string): Promise<void> => {
    return ipcRenderer.invoke('lyric-romanize-proxy-cancel', songId);
};

export const lyrics = {
    cancelRomanizeProxyFetch,
    clearLyricsCache,
    fetchRomanizeProxyLyrics,
    getRemoteLyricsByRemoteId,
    getRemoteLyricsBySong,
    searchRemoteLyrics,
};

export type Lyrics = typeof lyrics;
