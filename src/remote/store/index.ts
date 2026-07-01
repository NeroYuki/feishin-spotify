import merge from 'lodash/merge';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createWithEqualityFn } from 'zustand/traditional';

import { LogCategory, logFn } from '/@/renderer/utils/logger';
import { logMsg } from '/@/renderer/utils/logger-message';
import { toast } from '/@/shared/components/toast/toast';
import { QueueData, ClientEvent, ServerEvent, SongUpdateSocket } from '/@/shared/types/remote-types';
import { Song } from '/@/shared/types/domain-types';

export interface SettingsSlice extends SettingsState {
    actions: {
        reconnect: () => void;
        requestQueue: () => void;
        search: (query: string) => void;
        spotifySearchOnce: (query: string) => void;
        send: (data: ClientEvent) => void;
        toggleIsDark: () => void;
        toggleShowImage: () => void;
        requestRandomSongs: () => void;
        suggestSearch: (query: string) => void;
        requestSimilarSongs: (song: Song) => void;
        requestSameArtist: (artistName: string) => void;
        requestSameAlbum: (albumName: string) => void;
        setContextMenuSong: (song: Song | null) => void;
        setModalView: (view: 'same-artist' | 'same-album' | null) => void;
        setActiveTab: (tab: string) => void;
    };
}

interface SettingsState {
    activeTab: string;
    connected: boolean;
    info: Omit<SongUpdateSocket, 'currentTime'>;
    isDark: boolean;
    showImage: boolean;
    socket?: StatefulWebSocket;
    queue: QueueData;
    searchGeneration: number;
    searchQuery: string;
    searchResults: Song[];
    searchLoading: boolean;
    randomSongs: Song[];
    randomSongsLoading: boolean;
    suggestSearchResults: Song[];
    similarSongs: Song[];
    similarSongsSeed: Song | null;
    similarSongsLoading: boolean;
    sameArtistSongs: Song[];
    sameArtistName: string;
    sameArtistLoading: boolean;
    sameArtistTruncated: boolean;
    sameAlbumSongs: Song[];
    sameAlbumName: string;
    sameAlbumLoading: boolean;
    sameAlbumTruncated: boolean;
    contextMenuSong: Song | null;
    modalView: 'same-artist' | 'same-album' | null;
}

interface StatefulWebSocket extends WebSocket {
    natural: boolean;
}

const initialState: SettingsState = {
    activeTab: 'now-playing',
    connected: false,
    contextMenuSong: null,
    info: {},
    isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    modalView: null,
    queue: { index: -1, items: [] },
    randomSongs: [],
    randomSongsLoading: false,
    sameAlbumLoading: false,
    sameAlbumName: '',
    sameAlbumSongs: [],
    sameAlbumTruncated: false,
    sameArtistLoading: false,
    sameArtistName: '',
    sameArtistSongs: [],
    sameArtistTruncated: false,
    searchGeneration: 0,
    searchLoading: false,
    searchQuery: '',
    searchResults: [],
    showImage: true,
    suggestSearchResults: [],
    similarSongs: [],
    similarSongsLoading: false,
    similarSongsSeed: null,
};

export const useRemoteStore = createWithEqualityFn<SettingsSlice>()(
    persist(
        devtools(
            immer((set, get) => ({
                actions: {
                    reconnect: async () => {
                        logFn.debug(logMsg[LogCategory.REMOTE].reconnectInitiated, {
                            category: LogCategory.REMOTE,
                        });
                        const existing = get().socket;

                        if (existing) {
                            if (
                                existing.readyState === WebSocket.OPEN ||
                                existing.readyState === WebSocket.CONNECTING
                            ) {
                                logFn.debug(logMsg[LogCategory.REMOTE].closingExistingSocket, {
                                    category: LogCategory.REMOTE,
                                    meta: { readyState: existing.readyState },
                                });
                                existing.natural = true;
                                existing.close(4001);
                            }
                        }

                        let authHeader: string | undefined;

                        try {
                            logFn.debug(logMsg[LogCategory.REMOTE].fetchingCredentials, {
                                category: LogCategory.REMOTE,
                            });
                            const credentials = await fetch('/credentials');
                            authHeader = await credentials.text();
                            logFn.debug(logMsg[LogCategory.REMOTE].credentialsFetched, {
                                category: LogCategory.REMOTE,
                                meta: { hasAuthHeader: !!authHeader },
                            });
                        } catch (error) {
                            logFn.error(logMsg[LogCategory.REMOTE].failedToGetCredentials, {
                                category: LogCategory.REMOTE,
                                meta: { error },
                            });
                        }

                        set((state) => {
                            const wsUrl = location.href.replace('http', 'ws');
                            logFn.debug(logMsg[LogCategory.REMOTE].creatingWebSocket, {
                                category: LogCategory.REMOTE,
                                meta: { url: wsUrl },
                            });
                            const socket = new WebSocket(wsUrl) as StatefulWebSocket;

                            socket.natural = false;

                            socket.addEventListener('message', (message) => {
                                const { data, event } = JSON.parse(message.data) as ServerEvent;

                                logFn.debug(logMsg[LogCategory.REMOTE].webSocketMessageReceived, {
                                    category: LogCategory.REMOTE,
                                    meta: { data, event },
                                });

                                switch (event) {
                                    case 'error': {
                                        logFn.error(
                                            logMsg[LogCategory.REMOTE].webSocketErrorEvent,
                                            {
                                                category: LogCategory.REMOTE,
                                                meta: { data },
                                            },
                                        );
                                        toast.error({ message: data, title: 'Socket error' });
                                        break;
                                    }
                                    case 'favorite': {
                                        logFn.debug(
                                            logMsg[LogCategory.REMOTE].favoriteEventReceived,
                                            {
                                                category: LogCategory.REMOTE,
                                                meta: {
                                                    favorite: data.favorite,
                                                    id: data.id,
                                                },
                                            },
                                        );
                                        set((state) => {
                                            if (state.info.song?.id === data.id) {
                                                state.info.song.userFavorite = data.favorite;
                                            }
                                        });
                                        break;
                                    }
                                    case 'playback': {
                                        logFn.debug(
                                            logMsg[LogCategory.REMOTE].playbackEventReceived,
                                            {
                                                category: LogCategory.REMOTE,
                                                meta: { status: data },
                                            },
                                        );
                                        set((state) => {
                                            state.info.status = data;
                                        });
                                        break;
                                    }
                                    case 'position': {
                                        logFn.debug(
                                            logMsg[LogCategory.REMOTE].positionEventReceived,
                                            {
                                                category: LogCategory.REMOTE,
                                                meta: { position: data },
                                            },
                                        );
                                        set((state) => {
                                            state.info.position = data;
                                        });
                                        break;
                                    }
                                    case 'proxy': {
                                        logFn.debug(logMsg[LogCategory.REMOTE].proxyEventReceived, {
                                            category: LogCategory.REMOTE,
                                            meta: {
                                                dataLength: data?.length,
                                                hasData: !!data,
                                            },
                                        });
                                        set((state) => {
                                            if (state.info.song) {
                                                state.info.song.imageUrl = `data:image/jpeg;base64,${data}`;
                                            }
                                        });
                                        break;
                                    }
                                    case 'rating': {
                                        logFn.debug(
                                            logMsg[LogCategory.REMOTE].ratingEventReceived,
                                            {
                                                category: LogCategory.REMOTE,
                                                meta: {
                                                    id: data.id,
                                                    rating: data.rating,
                                                },
                                            },
                                        );
                                        set((state) => {
                                            if (state.info.song?.id === data.id) {
                                                state.info.song.userRating = data.rating;
                                            }
                                        });
                                        break;
                                    }
                                    case 'repeat': {
                                        logFn.debug(
                                            logMsg[LogCategory.REMOTE].repeatEventReceived,
                                            {
                                                category: LogCategory.REMOTE,
                                                meta: { repeat: data },
                                            },
                                        );
                                        set((state) => {
                                            state.info.repeat = data;
                                        });
                                        break;
                                    }
                                    case 'shuffle': {
                                        logFn.debug(
                                            logMsg[LogCategory.REMOTE].shuffleEventReceived,
                                            {
                                                category: LogCategory.REMOTE,
                                                meta: { shuffle: data },
                                            },
                                        );
                                        set((state) => {
                                            state.info.shuffle = data;
                                        });
                                        break;
                                    }
                                    case 'song': {
                                        logFn.debug(logMsg[LogCategory.REMOTE].songEventReceived, {
                                            category: LogCategory.REMOTE,
                                            meta: {
                                                artistName: data?.artistName,
                                                id: data?.id,
                                                name: data?.name,
                                            },
                                        });
                                        set((state) => {
                                            state.info.song = data;
                                        });
                                        break;
                                    }
                                    case 'state': {
                                        logFn.debug(logMsg[LogCategory.REMOTE].stateEventReceived, {
                                            category: LogCategory.REMOTE,
                                            meta: {
                                                hasSong: !!data.song,
                                                position: data.position,
                                                status: data.status,
                                                volume: data.volume,
                                            },
                                        });
                                        set((state) => {
                                            state.info = data;
                                        });
                                        break;
                                    }
                                    case 'volume': {
                                        logFn.debug(
                                            logMsg[LogCategory.REMOTE].volumeEventReceived,
                                            {
                                                category: LogCategory.REMOTE,
                                                meta: { volume: data },
                                            },
                                        );
                                        set((state) => {
                                            state.info.volume = data;
                                        });
                                        break;
                                    }
                                    case 'queue': {
                                        set((state) => {
                                            state.queue = data;
                                        });
                                        break;
                                    }
                                    case 'search-results': {
                                        set((state) => {
                                            if (state.searchQuery) {
                                                state.searchResults = data.songs;
                                            }
                                            state.searchLoading = false;
                                        });
                                        break;
                                    }
                                    case 'similar-songs': {
                                        set((state) => {
                                            state.similarSongs = data.songs;
                                            state.similarSongsSeed = data.seedSong;
                                            state.similarSongsLoading = false;
                                        });
                                        break;
                                    }
                                    case 'same-artist': {
                                        set((state) => {
                                            state.sameArtistSongs = data.songs;
                                            state.sameArtistName = data.artistName;
                                            state.sameArtistLoading = false;
                                            state.sameArtistTruncated = data.truncated || false;
                                        });
                                        break;
                                    }
                                    case 'same-album': {
                                        set((state) => {
                                            state.sameAlbumSongs = data.songs;
                                            state.sameAlbumName = data.albumName;
                                            state.sameAlbumLoading = false;
                                            state.sameAlbumTruncated = data.truncated || false;
                                        });
                                        break;
                                    }
                                    case 'random-songs': {
                                        set((state) => {
                                            state.randomSongs = data.songs;
                                            state.randomSongsLoading = false;
                                        });
                                        break;
                                    }
                                    case 'suggest-search-results': {
                                        set((state) => {
                                            state.suggestSearchResults = data.songs;
                                        });
                                        break;
                                    }
                                }
                            });

                            socket.addEventListener('open', () => {
                                logFn.debug(logMsg[LogCategory.REMOTE].webSocketOpened, {
                                    category: LogCategory.REMOTE,
                                    meta: {
                                        hasAuthHeader: !!authHeader,
                                        readyState: socket.readyState,
                                    },
                                });
                                if (authHeader) {
                                    logFn.debug(logMsg[LogCategory.REMOTE].sendingAuthentication, {
                                        category: LogCategory.REMOTE,
                                    });
                                    socket.send(
                                        JSON.stringify({
                                            event: 'authenticate',
                                            header: authHeader,
                                        }),
                                    );
                                }
                                set({ connected: true });
                            });

                            socket.addEventListener('close', (reason) => {
                                logFn.debug(logMsg[LogCategory.REMOTE].webSocketClosed, {
                                    category: LogCategory.REMOTE,
                                    meta: {
                                        code: reason.code,
                                        natural: socket.natural,
                                        reason: reason.reason,
                                        wasClean: reason.wasClean,
                                    },
                                });
                                if (reason.code === 4002 || reason.code === 4003) {
                                    logFn.debug(logMsg[LogCategory.REMOTE].reloadingPage, {
                                        category: LogCategory.REMOTE,
                                        meta: { code: reason.code },
                                    });
                                    location.reload();
                                } else if (reason.code === 4000) {
                                    logFn.warn(logMsg[LogCategory.REMOTE].serverIsDown, {
                                        category: LogCategory.REMOTE,
                                    });
                                    toast.warn({
                                        message: 'Feishin remote server is down',
                                        title: 'Connection closed',
                                    });
                                } else if (reason.code !== 4001 && !socket.natural) {
                                    logFn.error(
                                        logMsg[LogCategory.REMOTE].socketClosedUnexpectedly,
                                        {
                                            category: LogCategory.REMOTE,
                                            meta: {
                                                code: reason.code,
                                                reason: reason.reason,
                                            },
                                        },
                                    );
                                    toast.error({
                                        message: 'Socket closed for unexpected reason',
                                        title: 'Connection closed',
                                    });
                                }

                                if (!socket.natural) {
                                    set({ connected: false, info: {} });
                                }
                            });

                            state.socket = socket;
                        });
                    },
                    send: (data: ClientEvent) => {
                        const socket = get().socket;
                        if (socket) {
                            logFn.debug(logMsg[LogCategory.REMOTE].sendingEventToServer, {
                                category: LogCategory.REMOTE,
                                meta: {
                                    data: data,
                                    event: data.event,
                                    readyState: socket.readyState,
                                },
                            });
                            socket.send(JSON.stringify(data));
                        } else {
                            logFn.warn(logMsg[LogCategory.REMOTE].cannotSendEvent, {
                                category: LogCategory.REMOTE,
                                meta: { event: data.event },
                            });
                        }
                    },
                    toggleIsDark: () => {
                        set((state) => {
                            state.isDark = !state.isDark;
                        });
                    },
                    toggleShowImage: () => {
                        set((state) => {
                            state.showImage = !state.showImage;
                        });
                    },
                    requestQueue: () => {
                        const socket = get().socket;
                        if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ event: 'queue' }));
                        }
                    },
                    search: (query: string) => {
                        const socket = get().socket;
                        if (!query) {
                            // Clear immediately – no WS message, no loading state
                            set((state) => {
                                state.searchQuery = '';
                                state.searchResults = [];
                                state.searchLoading = false;
                            });
                            return;
                        }
                        set((state) => {
                            state.searchQuery = query;
                            state.searchLoading = true;
                            state.searchResults = [];
                            state.searchGeneration++;
                        });
                        if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ event: 'search', query }));
                        }
                    },
                    suggestSearch: (query: string) => {
                        const socket = get().socket;
                        if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ event: 'suggest-search', query }));
                        }
                    },
                    spotifySearchOnce: (query: string) => {
                        const socket = get().socket;
                        if (socket?.readyState === WebSocket.OPEN) {
                            // Don't change loading state — it's a side search
                            socket.send(JSON.stringify({ event: 'search', query, spotifySearch: true }));
                        }
                    },
                    requestRandomSongs: () => {
                        const socket = get().socket;
                        set((state) => {
                            state.randomSongsLoading = true;
                        });
                        if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ event: 'random-songs', size: 20 }));
                        }
                    },
                    requestSimilarSongs: (song: Song) => {
                        const socket = get().socket;
                        set((state) => {
                            state.similarSongsLoading = true;
                            state.similarSongs = [];
                            state.similarSongsSeed = song;
                        });
                        if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ event: 'similar-songs', songId: song.id, song }));
                        }
                    },
                    requestSameArtist: (artistName: string) => {
                        const socket = get().socket;
                        set((state) => {
                            state.sameArtistLoading = true;
                            state.sameArtistSongs = [];
                            state.sameArtistName = artistName;
                        });
                        if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ event: 'same-artist', artistName }));
                        }
                    },
                    requestSameAlbum: (albumName: string) => {
                        const socket = get().socket;
                        set((state) => {
                            state.sameAlbumLoading = true;
                            state.sameAlbumSongs = [];
                            state.sameAlbumName = albumName;
                        });
                        if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ event: 'same-album', albumName }));
                        }
                    },
                    setContextMenuSong: (song: Song | null) => {
                        set((state) => {
                            state.contextMenuSong = song;
                        });
                    },
                    setModalView: (view: 'same-artist' | 'same-album' | null) => {
                        set((state) => {
                            state.modalView = view;
                        });
                    },
                    setActiveTab: (tab: string) => {
                        set((state) => {
                            state.activeTab = tab;
                        });
                    },
                },
                ...initialState,
            })),
            { name: 'store_settings' },
        ),
        {
            merge: (persistedState, currentState) => merge(currentState, persistedState),
            name: 'store_settings',
            version: 7,
        },
    ),
);

export const useConnected = () => useRemoteStore((state) => state.connected);

export const useInfo = () => useRemoteStore((state) => state.info);

export const useIsDark = () => useRemoteStore((state) => state.isDark);

export const useReconnect = () => useRemoteStore((state) => state.actions.reconnect);

export const useShowImage = () => useRemoteStore((state) => state.showImage);

export const useSend = () => useRemoteStore((state) => state.actions.send);

export const useQueue = () => useRemoteStore((state) => state.queue);

export const useSearchQuery = () => useRemoteStore((state) => state.searchQuery);

export const useSearchResults = () => useRemoteStore((state) => state.searchResults);

export const useSearchLoading = () => useRemoteStore((state) => state.searchLoading);

export const useRequestQueue = () => useRemoteStore((state) => state.actions.requestQueue);
export const useSpotifySearchOnce = () => useRemoteStore((state) => state.actions.spotifySearchOnce);

export const useRandomSongs = () => useRemoteStore((state) => state.randomSongs);

export const useRandomSongsLoading = () => useRemoteStore((state) => state.randomSongsLoading);

export const useRequestRandomSongs = () => useRemoteStore((state) => state.actions.requestRandomSongs);

export const useSuggestSearchResults = () => useRemoteStore((state) => state.suggestSearchResults);

export const useSuggestSearch = () => useRemoteStore((state) => state.actions.suggestSearch);

export const useSimilarSongs = () => useRemoteStore((state) => state.similarSongs);

export const useSimilarSongsSeed = () => useRemoteStore((state) => state.similarSongsSeed);

export const useSimilarSongsLoading = () => useRemoteStore((state) => state.similarSongsLoading);

export const useRequestSimilarSongs = () => useRemoteStore((state) => state.actions.requestSimilarSongs);

export const useSameArtistSongs = () => useRemoteStore((state) => state.sameArtistSongs);

export const useSameArtistName = () => useRemoteStore((state) => state.sameArtistName);

export const useSameArtistLoading = () => useRemoteStore((state) => state.sameArtistLoading);

export const useSameArtistTruncated = () => useRemoteStore((state) => state.sameArtistTruncated);

export const useRequestSameArtist = () => useRemoteStore((state) => state.actions.requestSameArtist);

export const useSameAlbumSongs = () => useRemoteStore((state) => state.sameAlbumSongs);

export const useSameAlbumName = () => useRemoteStore((state) => state.sameAlbumName);

export const useSameAlbumLoading = () => useRemoteStore((state) => state.sameAlbumLoading);

export const useSameAlbumTruncated = () => useRemoteStore((state) => state.sameAlbumTruncated);

export const useRequestSameAlbum = () => useRemoteStore((state) => state.actions.requestSameAlbum);

export const useContextMenuSong = () => useRemoteStore((state) => state.contextMenuSong);

export const useSetContextMenuSong = () => useRemoteStore((state) => state.actions.setContextMenuSong);

export const useModalView = () => useRemoteStore((state) => state.modalView);

export const useSetModalView = () => useRemoteStore((state) => state.actions.setModalView);

export const useActiveTab = () => useRemoteStore((state) => state.activeTab);

export const useSetActiveTab = () => useRemoteStore((state) => state.actions.setActiveTab);

export const useSearch = () => useRemoteStore((state) => state.actions.search);

export const useToggleDark = () => useRemoteStore((state) => state.actions.toggleIsDark);

export const useToggleShowImage = () => useRemoteStore((state) => state.actions.toggleShowImage);
