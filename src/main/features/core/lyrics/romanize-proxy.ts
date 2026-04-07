import axios, { AxiosResponse } from 'axios';

import {
    InternetProviderLyricResponse,
    InternetProviderLyricSearchResponse,
    LyricSearchQuery,
    LyricSource,
} from '.';
import { store } from '../settings';

const BASE_URL = 'https://osudroid.kansenindex.dev/proxy/lyric';

const TIMEOUT_MS = 30000;

// The API returns plain LRC text (or plain text), not JSON.
const LRC_TIMESTAMP_RE = /\[\d{2,}:\d{2}(?:\.\d{2,3})?]/;

interface ParsedLyrics {
    plainLyrics: null | string;
    syncedLyrics: null | string;
}

async function callApi(
    params: LyricSearchQuery,
    apiKey: string,
    signal?: AbortSignal,
): Promise<ParsedLyrics | null> {
    let result: AxiosResponse<string>;

    try {
        result = await axios.get<string>(BASE_URL, {
            params: {
                album: params.album,
                apikey: apiKey,
                artist: params.artist,
                duration: params.duration,
                romanize: 1,
                title: params.name,
            },
            responseType: 'text',
            signal,
            timeout: TIMEOUT_MS,
        });
    } catch (e) {
        if (axios.isCancel(e)) {
            console.log('Romanize Proxy request cancelled');
            return null;
        }
        console.error('Romanize Proxy lyrics request got an error!', (e as Error)?.message);
        return null;
    }

    const text = typeof result.data === 'string' ? result.data.trim() : null;
    if (!text) return null;

    if (LRC_TIMESTAMP_RE.test(text)) {
        return { plainLyrics: null, syncedLyrics: text };
    }
    return { plainLyrics: text, syncedLyrics: null };
}

export async function getLyricsBySongId(songId: string): Promise<null | string> {
    const apiKey = store.get('romanizeProxyApiKey', '') as string;

    let params: LyricSearchQuery;
    try {
        params = JSON.parse(Buffer.from(songId, 'base64url').toString('utf-8'));
    } catch {
        return null;
    }

    const result = await callApi(params, apiKey);
    if (!result) return null;

    return result.syncedLyrics || result.plainLyrics || null;
}

export async function getSearchResults(
    params: LyricSearchQuery,
): Promise<InternetProviderLyricSearchResponse[] | null> {
    if (!params.name) return null;

    const apiKey = store.get('romanizeProxyApiKey', '') as string;
    if (!apiKey) return null;

    const result = await callApi(params, apiKey);
    if (!result) return null;

    const lyrics = result.syncedLyrics || result.plainLyrics;
    if (!lyrics) return null;

    const id = Buffer.from(JSON.stringify(params)).toString('base64url');

    return [
        {
            artist: params.artist || '',
            id,
            isSync: !!result.syncedLyrics,
            name: params.name,
            source: LyricSource.ROMANIZE_PROXY,
        },
    ];
}

export async function query(
    params: LyricSearchQuery,
): Promise<InternetProviderLyricResponse | null> {
    if (!params.name) return null;

    const apiKey = store.get('romanizeProxyApiKey', '') as string;
    if (!apiKey) return null;

    const result = await callApi(params, apiKey);
    if (!result) return null;

    const lyrics = result.syncedLyrics || result.plainLyrics;
    if (!lyrics) return null;

    const id = Buffer.from(JSON.stringify(params)).toString('base64url');

    return {
        artist: params.artist || '',
        id,
        lyrics,
        name: params.name,
        source: LyricSource.ROMANIZE_PROXY,
    };
}

export async function fetchForSong(
    params: LyricSearchQuery,
    signal: AbortSignal,
    apiKey: string,
): Promise<InternetProviderLyricResponse | null> {
    if (!params.name) return null;
    if (!apiKey) return null;

    const result = await callApi(params, apiKey, signal);
    if (!result) return null;

    const lyrics = result.syncedLyrics || result.plainLyrics;
    if (!lyrics) return null;

    const id = Buffer.from(JSON.stringify(params)).toString('base64url');

    return {
        artist: params.artist || '',
        id,
        lyrics,
        name: params.name,
        source: LyricSource.ROMANIZE_PROXY,
    };
}
