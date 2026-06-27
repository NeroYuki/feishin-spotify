import isElectron from 'is-electron';
import { useCallback, useEffect } from 'react';

import { api } from '/@/renderer/api';
import { useAuthStore, usePlayerStore } from '/@/renderer/store';
import { Play } from '/@/shared/types/types';
import { Song } from '/@/shared/types/domain-types';

const remote = isElectron() ? window.api.remote : null;

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
        async (data: { query: string }) => {
            const server = useAuthStore.getState().currentServer;
            const serverId = server?.id;
            if (!serverId || !data.query) {
                remote?.searchResults({ query: data.query, songs: [] });
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
                    },
                });
                remote?.searchResults({
                    query: data.query,
                    songs: result.songs || [],
                });
            } catch {
                remote?.searchResults({ query: data.query, songs: [] });
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
            // Only update if queue or index changed meaningfully
            const prevIds = prev.queue?.default?.join(',') || '';
            const currIds = state.queue?.default?.join(',') || '';

            if (
                prevIds !== currIds ||
                state.player.index !== prev.player.index ||
                state.player.shuffle !== prev.player.shuffle
            ) {
                if (remote) {
                    // Read fresh state outside the immer proxy
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
        remote.requestQueueAction(handleQueueAction);
        remote.requestQueueAdd(handleQueueAdd);

        return () => {
            // No cleanup needed for ipcRenderer.on since it's handled by the preload bindings
        };
    }, [handleRequestQueue, handleRequestSearch, handleQueueAction, handleQueueAdd]);
}
