import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createWithEqualityFn } from 'zustand/traditional';

import { SpotifyAuthState } from '/@/renderer/features/spotify/api/spotify-types';

interface SpotifyAuthSlice extends SpotifyAuthState {
    actions: {
        clearAuth: () => void;
        setTokens: (args: {
            accessToken: string;
            expiresIn: number;
            refreshToken?: string;
        }) => void;
        setUser: (user: SpotifyAuthState['user']) => void;
    };
}

const INITIAL_STATE: SpotifyAuthState = {
    accessToken: null,
    expiresAt: null,
    isAuthenticated: false,
    isPremium: false,
    refreshToken: null,
    user: null,
};

export const useSpotifyAuthStore = createWithEqualityFn<SpotifyAuthSlice>()(
    persist(
        devtools(
            immer((set) => ({
                ...INITIAL_STATE,
                actions: {
                    clearAuth: () => {
                        set((state) => {
                            Object.assign(state, INITIAL_STATE);
                        });
                    },
                    setTokens: ({ accessToken, expiresIn, refreshToken }) => {
                        set((state) => {
                            state.accessToken = accessToken;
                            state.expiresAt = Date.now() + expiresIn * 1000;
                            state.isAuthenticated = true;
                            if (refreshToken) {
                                state.refreshToken = refreshToken;
                            }
                        });
                    },
                    setUser: (user) => {
                        set((state) => {
                            state.user = user;
                            state.isPremium = user?.product === 'premium';
                        });
                    },
                },
            })),
            { name: 'store_spotify_auth' },
        ),
        {
            name: 'store_spotify_auth',
            // Only persist tokens and user info — not transient state
            partialize: (state) => ({
                accessToken: state.accessToken,
                expiresAt: state.expiresAt,
                isAuthenticated: state.isAuthenticated,
                isPremium: state.isPremium,
                refreshToken: state.refreshToken,
                user: state.user,
            }),
            version: 1,
        },
    ),
);

export const useSpotifyIsAuthenticated = () =>
    useSpotifyAuthStore((state) => state.isAuthenticated);

export const useSpotifyIsPremium = () => useSpotifyAuthStore((state) => state.isPremium);

export const useSpotifyUser = () => useSpotifyAuthStore((state) => state.user);
