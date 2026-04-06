/**
 * useSpotifyPcmPlayer — schedules s16le PCM chunks from librespot for gapless
 * playback using the Web Audio API.
 *
 * Librespot sends raw PCM: 44100 Hz, 2 channels, signed 16-bit little-endian.
 * Each chunk arrives via IPC (~4 KB / ~23 ms of audio). We convert to float32
 * and schedule AudioBufferSourceNodes on a shared AudioContext so that each
 * chunk starts exactly where the previous one ended.
 */

import { useEffect, useRef } from 'react';
import { useWebAudio } from '/@/renderer/features/player/hooks/use-webaudio';

const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2; // s16le

function s16leToFloat32(view: DataView, channel: 0 | 1, frameCount: number): Float32Array<ArrayBuffer> {
    const out = new Float32Array(new ArrayBuffer(frameCount * 4));
    for (let i = 0; i < frameCount; i++) {
        // interleaved: [L, R, L, R, …] — each sample is 2 bytes, little-endian
        const byteOffset = (i * CHANNELS + channel) * BYTES_PER_SAMPLE;
        const sample = view.getInt16(byteOffset, /* littleEndian= */ true);
        out[i] = sample / 32768;
    }
    return out;
}

export function useSpotifyPcmPlayer(active: boolean) {
    const { webAudio } = useWebAudio();
    const audioCtxRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    // Wall-clock time (in AudioContext seconds) when the next chunk should start.
    // Starts at 0; updated after each chunk is scheduled.
    const nextStartTimeRef = useRef(0);

    // Create / tear down the Spotify gain node. Prefer the shared webAudio context
    // so the visualizer can analyse the Spotify PCM audio. Fall back to a private
    // AudioContext when webAudio is not available.
    useEffect(() => {
        if (!active) {
            // If we created our own AudioContext, close it. If using shared, just disconnect.
            if (audioCtxRef.current && audioCtxRef.current !== webAudio?.context) {
                audioCtxRef.current.close();
            }
            audioCtxRef.current = null;
            gainNodeRef.current = null;
            nextStartTimeRef.current = 0;
            return;
        }

        let ctx: AudioContext;
        let gain: GainNode;
        let ownContext = false;

        if (webAudio?.context && webAudio.context.state !== 'closed') {
            // Use the shared AudioContext so the visualizer can see Spotify audio
            ctx = webAudio.context;
            gain = ctx.createGain();
            // Connect into webAudio.gains[0] so the visualizer picks it up
            gain.connect(webAudio.gains[0] ?? ctx.destination);
        } else {
            // Fallback: own AudioContext (visualizer won't see it, but audio plays)
            ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
            gain = ctx.createGain();
            gain.connect(ctx.destination);
            ownContext = true;
        }

        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
        nextStartTimeRef.current = ctx.currentTime + 0.1; // small initial buffer

        return () => {
            gain.disconnect();
            if (ownContext) ctx.close();
            audioCtxRef.current = null;
            gainNodeRef.current = null;
            nextStartTimeRef.current = 0;
        };
    // Re-run if active changes or the shared webAudio context becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, webAudio?.context]);

    // Subscribe to PCM chunks from main process
    useEffect(() => {
        if (!active || !window.api?.utils?.librespotOnPcm) return;

        const removePcm = window.api.utils.librespotOnPcm((_event, chunk: Buffer) => {
            const ctx = audioCtxRef.current;
            const gain = gainNodeRef.current;
            if (!ctx || !gain) return;

            // IPC deserializes Buffer as a plain Uint8Array — wrap in DataView for
            // portable int16 reading without Node.js Buffer methods.
            const bytes = new Uint8Array(chunk);
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const frameCount = Math.floor(bytes.byteLength / (CHANNELS * BYTES_PER_SAMPLE));
            if (frameCount <= 0) return;

            const audioBuffer = ctx.createBuffer(CHANNELS, frameCount, SAMPLE_RATE);
            audioBuffer.copyToChannel(s16leToFloat32(view, 0, frameCount), 0);
            audioBuffer.copyToChannel(s16leToFloat32(view, 1, frameCount), 1);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gain);

            // Schedule gaplessly: start at the end of the previous chunk,
            // but never in the past.
            const now = ctx.currentTime;
            const startAt = Math.max(nextStartTimeRef.current, now + 0.005);
            source.start(startAt);

            nextStartTimeRef.current = startAt + audioBuffer.duration;
        });

        const removeVolume = window.api.utils.librespotOnVolumeChange?.((_event, pct: number) => {
            const gain = gainNodeRef.current;
            if (!gain) return;
            gain.gain.setTargetAtTime(pct / 100, gain.context.currentTime, 0.05);
        });

        return () => {
            removePcm();
            removeVolume?.();
        };
    }, [active]);
}
