import isElectron from 'is-electron';

import { SpotifyTokenResponse, SpotifyUserProfile } from '/@/renderer/features/spotify/api/spotify-types';
import { useSpotifyAuthStore } from '/@/renderer/features/spotify/store/spotify-auth.store';

// ---------------------------------------------------------------------------
// Configuration
// The client ID is public and safe to ship — PKCE requires no client secret.
// Set VITE_SPOTIFY_CLIENT_ID in your .env file.
// ---------------------------------------------------------------------------
export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string ?? '';

// In dev, use a localhost HTTP server to catch the OAuth callback (avoids
// protocol-handler conflict with the installed production app).
const SPOTIFY_REDIRECT_URI_ELECTRON = import.meta.env.DEV
    ? 'http://127.0.0.1:27042/spotify/callback'
    : 'feishin://spotify/callback';
const SPOTIFY_REDIRECT_URI_WEB = `${window.location.origin}/spotify/callback`;

export const SPOTIFY_REDIRECT_URI = isElectron()
    ? SPOTIFY_REDIRECT_URI_ELECTRON
    : SPOTIFY_REDIRECT_URI_WEB;

const SPOTIFY_SCOPES = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'streaming',
    'user-library-read',
    'user-read-playback-state',
    'user-modify-playback-state',
].join(' ');

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values)
        .map((x) => possible[x % possible.length])
        .join('');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Session-scoped PKCE verifier storage (not persisted)
let pendingCodeVerifier: null | string = null;

// ---------------------------------------------------------------------------
// Minimal inline token helpers (avoids circular dependency with spotify-api-client)
// ---------------------------------------------------------------------------

async function exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    clientId: string,
): Promise<SpotifyTokenResponse> {
    const body = new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Token exchange failed: ${res.status} ${msg}`);
    }

    return res.json() as Promise<SpotifyTokenResponse>;
}

async function refreshAccessToken(
    refreshToken: string,
    clientId: string,
): Promise<SpotifyTokenResponse> {
    const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
    });

    if (!res.ok) {
        throw new Error(`Token refresh failed: ${res.status}`);
    }

    return res.json() as Promise<SpotifyTokenResponse>;
}

async function fetchCurrentUser(accessToken: string): Promise<SpotifyUserProfile> {
    const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch Spotify user profile: ${res.status}`);
    }

    return res.json() as Promise<SpotifyUserProfile>;
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

/**
 * Initiates the Spotify OAuth PKCE flow by opening the authorization URL.
 * In Electron, this opens the system browser. In web, it navigates the page.
 */
export async function startSpotifyAuth(): Promise<void> {
    if (!SPOTIFY_CLIENT_ID) {
        throw new Error(
            'Spotify client ID not configured. Set VITE_SPOTIFY_CLIENT_ID in your .env file.',
        );
    }

    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store verifier for later exchange
    pendingCodeVerifier = codeVerifier;
    sessionStorage.setItem('spotify_pkce_verifier', codeVerifier);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        redirect_uri: SPOTIFY_REDIRECT_URI,
        response_type: 'code',
        scope: SPOTIFY_SCOPES,
    });

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    console.log('[spotify] redirect_uri =', SPOTIFY_REDIRECT_URI);
    console.log('[spotify] authUrl =', authUrl);

    if (isElectron()) {
        // Open in external browser — deep link will be sent back via IPC
        window.api.utils.openExternal(authUrl);
    } else {
        window.location.href = authUrl;
    }
}

/**
 * Handles the OAuth callback URL (both Electron deep link and web redirect).
 * Extracts `code` from the URL, exchanges for tokens, and fetches the user profile.
 */
export async function handleSpotifyCallback(callbackUrl: string): Promise<void> {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
        throw new Error(`Spotify auth error: ${error}`);
    }

    if (!code) {
        throw new Error('No authorization code in Spotify callback URL');
    }

    const codeVerifier =
        pendingCodeVerifier ?? sessionStorage.getItem('spotify_pkce_verifier');

    if (!codeVerifier) {
        throw new Error('Missing PKCE code verifier — please restart the auth flow');
    }

    const tokenResponse = await exchangeCodeForTokens(
        code,
        codeVerifier,
        SPOTIFY_REDIRECT_URI,
        SPOTIFY_CLIENT_ID,
    );

    pendingCodeVerifier = null;
    sessionStorage.removeItem('spotify_pkce_verifier');

    const { actions } = useSpotifyAuthStore.getState();
    actions.setTokens({
        accessToken: tokenResponse.access_token,
        expiresIn: tokenResponse.expires_in,
        refreshToken: tokenResponse.refresh_token,
    });

    // Fetch and persist user profile
    const user = await fetchCurrentUser(tokenResponse.access_token);
    actions.setUser({
        displayName: user.display_name,
        email: user.email,
        id: user.id,
        imageUrl: user.images?.[0]?.url ?? null,
        product: user.product,
    });
}

/**
 * Refreshes the access token using the stored refresh token.
 * Called automatically by the API client on 401 responses.
 */
export async function refreshSpotifyToken(): Promise<void> {
    const { refreshToken } = useSpotifyAuthStore.getState();

    if (!refreshToken) {
        useSpotifyAuthStore.getState().actions.clearAuth();
        throw new Error('No Spotify refresh token available');
    }

    try {
        const tokenResponse = await refreshAccessToken(refreshToken, SPOTIFY_CLIENT_ID);

        useSpotifyAuthStore.getState().actions.setTokens({
            accessToken: tokenResponse.access_token,
            expiresIn: tokenResponse.expires_in,
            // Refresh token rotation — Spotify may return a new one
            refreshToken: tokenResponse.refresh_token,
        });
    } catch {
        // Token is invalid — require full re-auth
        useSpotifyAuthStore.getState().actions.clearAuth();
        throw new Error('Spotify token refresh failed — please reconnect');
    }
}

/**
 * Returns a valid access token, refreshing if near expiry.
 */
export async function getValidSpotifyToken(): Promise<string> {
    const { accessToken, expiresAt } = useSpotifyAuthStore.getState();

    // Refresh if less than 60 seconds until expiry
    const shouldRefresh = !expiresAt || Date.now() >= expiresAt - 60_000;

    if (shouldRefresh) {
        await refreshSpotifyToken();
        return useSpotifyAuthStore.getState().accessToken!;
    }

    return accessToken!;
}

/**
 * Signs out of Spotify and clears stored tokens.
 */
export function disconnectSpotify(): void {
    useSpotifyAuthStore.getState().actions.clearAuth();
}
