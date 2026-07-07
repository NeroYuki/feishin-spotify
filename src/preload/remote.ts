import { ipcRenderer } from 'electron';

import { QueueData } from '/@/shared/types/remote-types';
import { QueueSong, Song } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

const requestFavorite = (
    cb: (data: { favorite: boolean; id: string; serverId: string }) => void,
) => {
    ipcRenderer.removeAllListeners('request-favorite');
    ipcRenderer.on('request-favorite', (_, data) => cb(data));
};

const requestPosition = (cb: (data: { position: number }) => void) => {
    ipcRenderer.removeAllListeners('request-position');
    ipcRenderer.on('request-position', (_, data) => cb(data));
};

const requestRating = (cb: (data: { id: string; rating: number; serverId: string }) => void) => {
    ipcRenderer.removeAllListeners('request-rating');
    ipcRenderer.on('request-rating', (_, data) => cb(data));
};

const requestSeek = (cb: (data: { offset: number }) => void) => {
    ipcRenderer.removeAllListeners('request-seek');
    ipcRenderer.on('request-seek', (_, data) => cb(data));
};

const requestVolume = (cb: (data: { volume: number }) => void) => {
    ipcRenderer.removeAllListeners('request-volume');
    ipcRenderer.on('request-volume', (_, data) => cb(data));
};

const setRemoteEnabled = (enabled: boolean): Promise<null | string> => {
    const result = ipcRenderer.invoke('remote-enable', enabled);
    return result;
};

const setRemotePort = (port: number): Promise<null | string> => {
    const result = ipcRenderer.invoke('remote-port', port);
    return result;
};

const updateFavorite = (favorite: boolean, serverId: string, ids: string[]) => {
    ipcRenderer.send('update-favorite', favorite, serverId, ids);
};

const updatePassword = (password: string) => {
    ipcRenderer.send('remote-password', password);
};

const updatePlayback = (playback: PlayerStatus) => {
    ipcRenderer.send('update-playback', playback);
};

const updateSetting = (
    enabled: boolean,
    port: number,
    username: string,
    password: string,
): Promise<null | string> => {
    return ipcRenderer.invoke('remote-settings', enabled, port, username, password);
};

const updateRating = (rating: number, serverId: string, ids: string[]) => {
    ipcRenderer.send('update-rating', rating, serverId, ids);
};

const updateRepeat = (repeat: string) => {
    ipcRenderer.send('update-repeat', repeat);
};

const updateShuffle = (shuffle: boolean) => {
    ipcRenderer.send('update-shuffle', shuffle);
};

const updateSong = (song: QueueSong | undefined, imageUrl?: null | string) => {
    ipcRenderer.send('update-song', song, imageUrl);
};

const updateUsername = (username: string) => {
    ipcRenderer.send('remote-username', username);
};

const updateVolume = (volume: number) => {
    ipcRenderer.send('update-volume', volume);
};

const updatePosition = (timeSec: number) => {
    ipcRenderer.send('update-position', timeSec);
};

const updateQueue = (data: QueueData) => {
    ipcRenderer.send('update-queue', data);
};

const searchResults = (data: { query: string; songs: Song[]; wsClientId?: string }) => {
    ipcRenderer.send('search-results', data);
};

const suggestSearchResults = (data: { query: string; songs: Song[]; wsClientId?: string }) => {
    ipcRenderer.send('suggest-search-results', data);
};

const similarSongsResults = (data: { seedSong: Song; songs: Song[]; truncated?: boolean; wsClientId?: string }) => {
    ipcRenderer.send('similar-songs-results', data);
};

const sameArtistResults = (data: { artistName: string; songs: Song[]; truncated?: boolean; wsClientId?: string }) => {
    ipcRenderer.send('same-artist-results', data);
};

const sameAlbumResults = (data: { albumName: string; songs: Song[]; truncated?: boolean; wsClientId?: string }) => {
    ipcRenderer.send('same-album-results', data);
};

const randomSongsResults = (data: { songs: Song[]; wsClientId?: string }) => {
    ipcRenderer.send('random-songs-results', data);
};

const requestQueue = (cb: () => void) => {
    ipcRenderer.removeAllListeners('request-queue');
    ipcRenderer.on('request-queue', () => cb());
};

const requestSearch = (cb: (data: { query: string; spotifySearch?: boolean; wsClientId?: string }) => void) => {
    ipcRenderer.removeAllListeners('request-search');
    ipcRenderer.on('request-search', (_, data) => cb(data));
};

const requestSuggestSearch = (cb: (data: { query: string; wsClientId?: string }) => void) => {
    ipcRenderer.removeAllListeners('request-suggest-search');
    ipcRenderer.on('request-suggest-search', (_, data) => cb(data));
};

const requestSimilarSongs = (cb: (data: { songId: string; song: Song; wsClientId?: string }) => void) => {
    ipcRenderer.removeAllListeners('request-similar-songs');
    ipcRenderer.on('request-similar-songs', (_, data) => cb(data));
};

const requestSameArtist = (cb: (data: { artistName: string; artistId?: string; wsClientId?: string }) => void) => {
    ipcRenderer.removeAllListeners('request-same-artist');
    ipcRenderer.on('request-same-artist', (_, data) => cb(data));
};

const requestSameAlbum = (cb: (data: { albumName: string; albumId?: string; wsClientId?: string }) => void) => {
    ipcRenderer.removeAllListeners('request-same-album');
    ipcRenderer.on('request-same-album', (_, data) => cb(data));
};

const requestRandomSongs = (cb: (data: { size: number; wsClientId?: string }) => void) => {
    ipcRenderer.removeAllListeners('request-random-songs');
    ipcRenderer.on('request-random-songs', (_, data) => cb(data));
};

const requestQueueAction = (
    cb: (data: { action: string; [key: string]: any }) => void,
) => {
    ipcRenderer.removeAllListeners('request-queue-action');
    ipcRenderer.on('request-queue-action', (_, data) => cb(data));
};

const requestQueueAdd = (
    cb: (data: { items: Song[]; playType: 'now' | 'next' | 'last' }) => void,
) => {
    ipcRenderer.removeAllListeners('request-queue-add');
    ipcRenderer.on('request-queue-add', (_, data) => cb(data));
};

export const remote = {
    requestFavorite,
    requestPosition,
    requestRating,
    requestSeek,
    requestVolume,
    setRemoteEnabled,
    setRemotePort,
    updateFavorite,
    updatePassword,
    updatePlayback,
    updatePosition,
    updateRating,
    updateRepeat,
    updateSetting,
    updateShuffle,
    updateSong,
    updateUsername,
    updateVolume,
    updateQueue,
    searchResults,
    suggestSearchResults,
    similarSongsResults,
    sameArtistResults,
    sameAlbumResults,
    randomSongsResults,
    requestQueue,
    requestSearch,
    requestSuggestSearch,
    requestSimilarSongs,
    requestSameArtist,
    requestSameAlbum,
    requestRandomSongs,
    requestQueueAction,
    requestQueueAdd,
};

export type Remote = typeof remote;
