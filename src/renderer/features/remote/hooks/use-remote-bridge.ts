import isElectron from 'is-electron';
import { useCallback, useEffect } from 'react';

import { api } from '/@/renderer/api';
import { useAuthStore, usePlayerStore } from '/@/renderer/store';
import { Play } from '/@/shared/types/types';
import { Song } from '/@/shared/types/domain-types';

const remote = isElectron() ? window.api.remote : null;

const MAX_RESULTS = 100;

function randomSort<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/**
 * Bridges remote IPC requests to the renderer's player store and search API.
 * Must be mounted once in the app root.
 */
export function useRemoteBridge() {
    const handleRequestQueue = useCallback(() => {
        const store = usePlayerStore.getState();
        const order = store.getQueueOrder();
        remote?.updateQueue({
            index: store.player.index,
            items: order.items,
        });
    }, []);

    const handleRequestSearch = useCallback(
        async (data: { query: string; spotifySearch?: boolean; wsClientId?: string }) => {
            const server = useAuthStore.getState().currentServer;
            const serverId = server?.id;
            if (!serverId || !data.query) {
                remote?.searchResults({ query: data.query, songs: [], wsClientId: data.wsClientId });
                return;
            }

            try {
                const result = await api.controller.search({
                    apiClientProps: { serverId },
                    query: {
                        albumArtistLimit: 0,
                        albumArtistStartIndex: 0,
                        albumLimit: 0,
                        albumStartIndex: 0,
                        query: data.query,
                        songLimit: 20,
                        songStartIndex: 0,
                        spotifySearch: data.spotifySearch,
                    },
                });
                remote?.searchResults({
                    query: data.query,
                    songs: result.songs || [],
                    wsClientId: data.wsClientId,
                });
            } catch {
                remote?.searchResults({ query: data.query, songs: [], wsClientId: data.wsClientId });
            }
        },
        [],
    );

    const handleRequestSuggestSearch = useCallback(
        async (data: { query: string; wsClientId?: string }) => {
            const server = useAuthStore.getState().currentServer;
            const serverId = server?.id;
            if (!serverId || !data.query) {
                remote?.suggestSearchResults({ query: data.query, songs: [], wsClientId: data.wsClientId });
                return;
            }

            try {
                const result = await api.controller.search({
                    apiClientProps: { serverId },
                    query: {
                        albumArtistLimit: 0,
                        albumArtistStartIndex: 0,
                        albumLimit: 0,
                        albumStartIndex: 0,
                        query: data.query,
                        songLimit: 8,
                        songStartIndex: 0,
                    },
                });
                remote?.suggestSearchResults({
                    query: data.query,
                    songs: result.songs || [],
                    wsClientId: data.wsClientId,
                });
            } catch {
                remote?.suggestSearchResults({ query: data.query, songs: [], wsClientId: data.wsClientId });
            }
        },
        [],
    );

    const handleRequestSimilarSongs = useCallback(
        async (data: { songId: string; song: Song; wsClientId?: string }) => {
            const server = useAuthStore.getState().currentServer;
            const serverId = server?.id;
            if (!serverId) {
                remote?.similarSongsResults({ seedSong: data.song, songs: [], wsClientId: data.wsClientId });
                return;
            }

            try {
                const songs = await api.controller.getSimilarSongs({
                    apiClientProps: { serverId },
                    query: { songId: data.songId, count: 100 },
                });
                remote?.similarSongsResults({
                    seedSong: data.song,
                    songs: songs || [],
                    wsClientId: data.wsClientId,
                });
            } catch {
                remote?.similarSongsResults({ seedSong: data.song, songs: [], wsClientId: data.wsClientId });
            }
        },
        [],
    );

    const handleRequestSameArtist = useCallback(
        async (data: { artistName: string; artistId?: string; wsClientId?: string }) => {
            const server = useAuthStore.getState().currentServer;
            const serverId = server?.id;
            if (!serverId) {
                remote?.sameArtistResults({ artistName: data.artistName, songs: [], wsClientId: data.wsClientId });
                return;
            }

            try {
                // Search for songs by this artist
                const result = await api.controller.search({
                    apiClientProps: { serverId },
                    query: {
                        albumArtistLimit: 0,
                        albumArtistStartIndex: 0,
                        albumLimit: 0,
                        albumStartIndex: 0,
                        query: data.artistName,
                        songLimit: 500,
                        songStartIndex: 0,
                    },
                });

                let songs = result.songs || [];
                const truncated = songs.length > MAX_RESULTS;

                if (truncated) {
                    songs = randomSort(songs).slice(0, MAX_RESULTS);
                }

                remote?.sameArtistResults({
                    artistName: data.artistName,
                    songs,
                    truncated,
                    wsClientId: data.wsClientId,
                });
            } catch {
                remote?.sameArtistResults({ artistName: data.artistName, songs: [], wsClientId: data.wsClientId });
            }
        },
        [],
    );

    const handleRequestSameAlbum = useCallback(
        async (data: { albumName: string; albumId?: string; wsClientId?: string }) => {
            const server = useAuthStore.getState().currentServer;
            const serverId = server?.id;
            if (!serverId) {
                remote?.sameAlbumResults({ albumName: data.albumName, songs: [], wsClientId: data.wsClientId });
                return;
            }

            try {
                const result = await api.controller.search({
                    apiClientProps: { serverId },
                    query: {
                        albumArtistLimit: 0,
                        albumArtistStartIndex: 0,
                        albumLimit: 0,
                        albumStartIndex: 0,
                        query: data.albumName,
                        songLimit: 500,
                        songStartIndex: 0,
                    },
                });

                let songs = (result.songs || []).filter(
                    (s) => s.album?.toLowerCase() === data.albumName.toLowerCase(),
                );
                const truncated = songs.length > MAX_RESULTS;

                if (truncated) {
                    songs = randomSort(songs).slice(0, MAX_RESULTS);
                }

                remote?.sameAlbumResults({
                    albumName: data.albumName,
                    songs,
                    truncated,
                    wsClientId: data.wsClientId,
                });
            } catch {
                remote?.sameAlbumResults({ albumName: data.albumName, songs: [], wsClientId: data.wsClientId });
            }
        },
        [],
    );

    const handleRequestRandomSongs = useCallback(
        async (data: { size: number; wsClientId?: string }) => {
            const server = useAuthStore.getState().currentServer;
            const serverId = server?.id;
            if (!serverId) {
                remote?.randomSongsResults({ songs: [], wsClientId: data.wsClientId });
                return;
            }

            try {
                const result = await api.controller.getRandomSongList({
                    apiClientProps: { serverId },
                    query: { size: data.size || 20 },
                });
                remote?.randomSongsResults({
                    songs: result?.items || result || [],
                    wsClientId: data.wsClientId,
                } as any);
            } catch {
                remote?.randomSongsResults({ songs: [], wsClientId: data.wsClientId });
            }
        },
        [],
    );

    const handleQueueAction = useCallback(
        (data: { action: string; [key: string]: any }) => {
            const store = usePlayerStore.getState();
            switch (data.action) {
                case 'play': {
                    store.mediaPlayByIndex(data.index);
                    break;
                }
                case 'move': {
                    const order = store.getQueueOrder();
                    const song = order.items[data.from];
                    if (song) {
                        store.moveSelectedTo(
                            [song],
                            order.items[data.to]?._uniqueId || '',
                            data.to === 0 ? 'top' : 'bottom',
                        );
                    }
                    break;
                }
                case 'remove': {
                    const order = store.getQueueOrder();
                    const toRemove = order.items.filter(
                        (item: any) => data.ids.includes(item.id) || data.ids.includes(item.uniqueId),
                    );
                    if (toRemove.length > 0) {
                        store.clearSelected(toRemove);
                    }
                    break;
                }
            }
        },
        [],
    );

    const handleQueueAdd = useCallback(
        (data: { items: Song[]; playType: 'now' | 'next' | 'last' }) => {
            const store = usePlayerStore.getState();

            const playTypeMap: Record<string, Play> = {
                last: Play.LAST,
                next: Play.NEXT,
                now: Play.NOW,
            };

            store.addToQueueByType(
                data.items as any,
                playTypeMap[data.playType] || Play.LAST,
            );
        },
        [],
    );

    // Watch player store queue changes and send them to remotes
    useEffect(() => {
        const unsub = usePlayerStore.subscribe((state, prev) => {
            const prevIds = prev.queue?.default?.join(',') || '';
            const currIds = state.queue?.default?.join(',') || '';

            if (
                prevIds !== currIds ||
                state.player.index !== prev.player.index ||
                state.player.shuffle !== prev.player.shuffle
            ) {
                if (remote) {
                    const fresh = usePlayerStore.getState();
                    const order = fresh.getQueueOrder();
                    remote.updateQueue({
                        index: fresh.player.index,
                        items: order.items,
                    });
                }
            }
        });

        return () => {
            unsub();
        };
    }, []);

    // Register IPC listeners
    useEffect(() => {
        if (!remote) return;

        remote.requestQueue(handleRequestQueue);
        remote.requestSearch(handleRequestSearch);
        remote.requestSuggestSearch(handleRequestSuggestSearch);
        remote.requestSimilarSongs(handleRequestSimilarSongs);
        remote.requestSameArtist(handleRequestSameArtist);
        remote.requestSameAlbum(handleRequestSameAlbum);
        remote.requestRandomSongs(handleRequestRandomSongs);
        remote.requestQueueAction(handleQueueAction);
        remote.requestQueueAdd(handleQueueAdd);

        return () => {
            // No cleanup needed for ipcRenderer.on since it's handled by the preload bindings
        };
    }, [
        handleRequestQueue,
        handleRequestSearch,
        handleRequestSuggestSearch,
        handleRequestSimilarSongs,
        handleRequestSameArtist,
        handleRequestSameAlbum,
        handleRequestRandomSongs,
        handleQueueAction,
        handleQueueAdd,
    ]);
}
