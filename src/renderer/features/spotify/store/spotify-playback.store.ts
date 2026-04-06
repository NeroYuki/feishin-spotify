import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createWithEqualityFn } from 'zustand/traditional';

interface SpotifyPlaybackState {
    deviceId: null | string;
    isActive: boolean;
    isReady: boolean;
}

interface SpotifyPlaybackSlice extends SpotifyPlaybackState {
    actions: {
        reset: () => void;
        setDeviceReady: (deviceId: string) => void;
        setIsActive: (isActive: boolean) => void;
    };
}

const INITIAL_STATE: SpotifyPlaybackState = {
    deviceId: null,
    isActive: false,
    isReady: false,
};

export const useSpotifyPlaybackStore = createWithEqualityFn<SpotifyPlaybackSlice>()(
    devtools(
        immer((set) => ({
            ...INITIAL_STATE,
            actions: {
                reset: () => {
                    set((state) => {
                        Object.assign(state, INITIAL_STATE);
                    });
                },
                setDeviceReady: (deviceId) => {
                    set((state) => {
                        state.deviceId = deviceId;
                        state.isReady = true;
                    });
                },
                setIsActive: (isActive) => {
                    set((state) => {
                        state.isActive = isActive;
                    });
                },
            },
        })),
        { name: 'store_spotify_playback' },
    ),
);

export const useSpotifyDeviceId = () => useSpotifyPlaybackStore((state) => state.deviceId);
export const useSpotifyIsReady = () => useSpotifyPlaybackStore((state) => state.isReady);
