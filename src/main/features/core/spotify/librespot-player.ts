/**
 * LibrespotPlayer — wraps @lox-audioserver/node-librespot to provide a
 * Spotify Connect device in the main process. PCM (s16le 44.1 kHz stereo)
 * is emitted as 'pcm' events so the IPC layer can forward chunks to the
 * renderer, where Web Audio API schedules gapless playback.
 *
 * Public API (all methods are safe to call before init / after stop):
 *   init(accessToken, clientId)  — start the Connect device
 *   stop()                       — tear down the Connect device
 *   setVolume(0-100)             — stored; sent to renderer via 'volume' event
 *   getDeviceId() → string | null
 *   onReady(cb)   — called with deviceId once the Connect device is ready
 *   onEvent(cb)   — called with librespot events (playing/paused/end_of_track…)
 *   onError(cb)   — called on fatal errors
 */

import { ConnectEvent } from '@lox-audioserver/node-librespot';
import crypto from 'crypto';
import { EventEmitter } from 'events';

// The native addon is a CJS module — require() at runtime to avoid bundling issues.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const librespot = require('@lox-audioserver/node-librespot') as typeof import('@lox-audioserver/node-librespot');

export const SAMPLE_RATE = 44100;
export const CHANNELS = 2;

interface LibrespotHandle {
    play(): void;
    pause(): void;
    next(): void;
    prev(): void;
    stop(): void;
    shutdown(): void;
}

type ReadyCallback = (deviceId: string) => void;
type EventCallback = (event: ConnectEvent) => void;
type ErrorCallback = (err: Error) => void;

export class LibrespotPlayer extends EventEmitter {
    private handle: LibrespotHandle | null = null;
    private deviceId: string | null = null;
    private volume = 100;
    private readyCb: ReadyCallback | null = null;
    private eventCb: EventCallback | null = null;

    onReady(cb: ReadyCallback) {
        this.readyCb = cb;
    }

    onEvent(cb: EventCallback) {
        this.eventCb = cb;
    }

    onError(cb: ErrorCallback) {
        this.on('error', (err: Error) => cb(err));
    }

    getDeviceId(): string | null {
        return this.deviceId;
    }

    getVolume(): number {
        return this.volume;
    }

    isRunning(): boolean {
        return this.handle !== null;
    }

    async init(accessToken: string, _clientId?: string): Promise<void> {
        await this.stop();

        // Spotify expects device IDs to be 40-char hex strings (same format as
        // official clients). A plain timestamp with hyphens triggers a 400.
        const deviceId = crypto.randomBytes(20).toString('hex');

        // Pass undefined as clientId — librespot uses its own built-in Spotify
        // client ID in that case, which is approved for Connect. Passing a custom
        // app's client ID causes a 400 unless that app has been granted Connect
        // API access by Spotify.
        const effectiveClientId = undefined;

        const handle = await librespot.startConnectDeviceWithToken(
            accessToken,
            effectiveClientId,
            'Feishin',
            deviceId,
            (chunk: Buffer) => {
                this.emit('pcm', chunk);
            },
            (event: ConnectEvent) => {
                this.eventCb?.(event);
                this.emit('event', event);
            },
        );

        this.handle = handle as LibrespotHandle;

        // The Connect device is registered as soon as startConnectDeviceWithToken
        // resolves — fire ready immediately with the ID we passed in.
        this.deviceId = deviceId;
        this.readyCb?.(this.deviceId);
    }

    async stop(): Promise<void> {
        try {
            this.handle?.stop();
        } catch (_) { /* ignore */ }
        this.handle = null;
        this.deviceId = null;
    }

    setVolume(pct: number): void {
        this.volume = Math.max(0, Math.min(100, pct));
        this.emit('volume', this.volume);
    }
}

export const librespotPlayer = new LibrespotPlayer();

