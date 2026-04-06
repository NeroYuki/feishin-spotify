import { BrowserWindow, ipcMain } from 'electron';

import { librespotPlayer } from './librespot-player';

// Notify the renderer when the Connect device is ready with its device_id
librespotPlayer.onReady((deviceId) => {
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('librespot-ready', deviceId);
    });
});

// Forward librespot events to the renderer (playing, paused, end_of_track, etc.)
librespotPlayer.onEvent((event) => {
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('librespot-event', event);
    });
});

librespotPlayer.onError((err) => {
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('librespot-error', err.message);
    });
});

// Stream PCM chunks to the renderer for Web Audio playback
librespotPlayer.on('pcm', (chunk: Buffer) => {
    BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
            win.webContents.send('librespot-pcm', chunk);
        }
    });
});

// Forward volume changes to the renderer so Web Audio can apply gain
librespotPlayer.on('volume', (pct: number) => {
    BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
            win.webContents.send('librespot-volume-change', pct);
        }
    });
});

ipcMain.handle('librespot-init', async (_event, accessToken: string, clientId: string) => {
    try {
        await librespotPlayer.init(accessToken, clientId);
        return { ok: true };
    } catch (err: unknown) {
        return { error: String(err) };
    }
});

ipcMain.handle('librespot-stop', async () => {
    await librespotPlayer.stop();
    return { ok: true };
});

ipcMain.on('librespot-volume', (_event, pct: number) => {
    librespotPlayer.setVolume(pct);
});

ipcMain.handle('librespot-device-id', () => {
    return librespotPlayer.getDeviceId();
});
