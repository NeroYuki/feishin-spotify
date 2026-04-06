import { ipcRenderer, IpcRendererEvent, shell, webFrame } from 'electron';

import { disableAutoUpdates, isLinux, isMacOS, isWindows } from '../main/utils';

const openItem = async (path: string) => {
    return ipcRenderer.invoke('open-item', path);
};

const openExternal = (url: string) => {
    shell.openExternal(url);
};

const openApplicationDirectory = async () => {
    return ipcRenderer.invoke('open-application-directory');
};

const playerErrorListener = (cb: (event: IpcRendererEvent, data: { code: number }) => void) => {
    ipcRenderer.on('player-error-listener', cb);
};

const mainMessageListener = (
    cb: (
        event: IpcRendererEvent,
        data: { message: string; type: 'error' | 'info' | 'success' | 'warning' },
    ) => void,
) => {
    ipcRenderer.on('toast-from-main', cb);
};

const logger = (
    cb: (
        event: IpcRendererEvent,
        data: {
            message: string;
            type: 'debug' | 'error' | 'info' | 'verbose' | 'warning';
        },
    ) => void,
) => {
    ipcRenderer.send('logger', cb);
};

const download = (url: string) => {
    ipcRenderer.send('download-url', url);
};

const checkForUpdates = (): Promise<{ updateAvailable: boolean; version?: string }> => {
    return ipcRenderer.invoke('app-check-for-updates');
};

const forceGarbageCollection = (): boolean => {
    try {
        if (typeof global.gc === 'function') {
            global.gc();
            webFrame.clearCache();
            return true;
        }
        if (typeof window.gc === 'function') {
            window.gc();
            webFrame.clearCache();
            return true;
        }
        return false;
    } catch {
        return false;
    }
};

const rendererOpenSettings = (cb: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on('renderer-open-settings', cb);
};

const rendererOpenCommandPalette = (cb: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on('renderer-open-command-palette', cb);
};

const rendererOpenManageServers = (cb: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on('renderer-open-manage-servers', cb);
};

const rendererTogglePrivateMode = (cb: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on('renderer-toggle-private-mode', cb);
};

const rendererToggleSidebar = (cb: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on('renderer-toggle-sidebar', cb);
};

const rendererOpenReleaseNotes = (cb: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on('renderer-open-release-notes', cb);
};

const spotifyAuthCallback = (cb: (event: IpcRendererEvent, url: string) => void): () => void => {
    ipcRenderer.on('spotify-auth-callback', cb);
    return () => ipcRenderer.removeListener('spotify-auth-callback', cb);
};

const librespotInit = (accessToken: string, clientId: string) => {
    return ipcRenderer.invoke('librespot-init', accessToken, clientId);
};

const librespotStop = () => {
    return ipcRenderer.invoke('librespot-stop');
};

const librespotVolume = (pct: number) => {
    ipcRenderer.send('librespot-volume', pct);
};

const librespotDeviceId = () => {
    return ipcRenderer.invoke('librespot-device-id');
};

const librespotOnReady = (cb: (event: IpcRendererEvent, deviceId: string) => void): () => void => {
    ipcRenderer.on('librespot-ready', cb);
    return () => ipcRenderer.removeListener('librespot-ready', cb);
};

const librespotOnEvent = (cb: (event: IpcRendererEvent, data: Record<string, unknown>) => void): () => void => {
    ipcRenderer.on('librespot-event', cb);
    return () => ipcRenderer.removeListener('librespot-event', cb);
};

const librespotOnError = (cb: (event: IpcRendererEvent, message: string) => void): () => void => {
    ipcRenderer.on('librespot-error', cb);
    return () => ipcRenderer.removeListener('librespot-error', cb);
};

const librespotOnPcm = (cb: (event: IpcRendererEvent, chunk: Buffer) => void): () => void => {
    ipcRenderer.on('librespot-pcm', cb);
    return () => ipcRenderer.removeListener('librespot-pcm', cb);
};

const librespotOnVolumeChange = (cb: (event: IpcRendererEvent, pct: number) => void): () => void => {
    ipcRenderer.on('librespot-volume-change', cb);
    return () => ipcRenderer.removeListener('librespot-volume-change', cb);
};

export const utils = {
    checkForUpdates,
    disableAutoUpdates,
    download,
    forceGarbageCollection,
    isLinux,
    isMacOS,
    isWindows,
    librespotDeviceId,
    librespotInit,
    librespotOnError,
    librespotOnEvent,
    librespotOnPcm,
    librespotOnReady,
    librespotOnVolumeChange,
    librespotStop,
    librespotVolume,
    logger,
    mainMessageListener,
    openApplicationDirectory,
    openExternal,
    openItem,
    playerErrorListener,
    rendererOpenCommandPalette,
    rendererOpenManageServers,
    rendererOpenReleaseNotes,
    rendererOpenSettings,
    rendererTogglePrivateMode,
    rendererToggleSidebar,
    spotifyAuthCallback,
};

export type Utils = typeof utils;
