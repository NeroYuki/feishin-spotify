import { useSpotifyAuthStore } from '/@/renderer/features/spotify/store/spotify-auth.store';
import {
    SpotifyFullAlbum,
    SpotifyFullArtist,
    SpotifyPaging,
    SpotifyPlaylist,
    SpotifyPlaylistTrack,
    SpotifySearchResults,
    SpotifySavedTrack,
    SpotifyTokenResponse,
    SpotifyTrack,
    SpotifyUserProfile,
} from '/@/renderer/features/spotify/api/spotify-types';
import { refreshSpotifyToken } from '/@/renderer/features/spotify/api/spotify-auth';

class SpotifyApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = 'SpotifyApiError';
    }
}

class SpotifyApiClient {
    private baseUrl = 'https://api.spotify.com/v1';

    private async request<T>(
        endpoint: string,
        options?: RequestInit,
        retryCount = 0,
    ): Promise<T> {
        const token = useSpotifyAuthStore.getState().accessToken;

        if (!token) {
            throw new SpotifyApiError(401, 'Spotify not authenticated');
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (response.status === 401 && retryCount === 0) {
            // Attempt a single token refresh then retry
            await refreshSpotifyToken();
            return this.request<T>(endpoint, options, retryCount + 1);
        }

        // Rate limited — honour Retry-After and retry up to 3 times
        if (response.status === 429 && retryCount < 3) {
            const retryAfterSec = parseInt(response.headers.get('Retry-After') ?? '1', 10);
            const delayMs = Math.min(retryAfterSec, 30) * 1000;
            console.warn(`[Spotify] 429 on ${endpoint} — retrying after ${delayMs}ms`);
            await new Promise<void>((r) => setTimeout(r, delayMs));
            return this.request<T>(endpoint, options, retryCount + 1);
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => response.statusText);
            throw new SpotifyApiError(response.status, errorBody);
        }

        // No body — 204 No Content or 202 Accepted with empty body
        if (response.status === 204 || response.status === 202) {
            return undefined as unknown as T;
        }

        // Guard against empty bodies on any other 2xx (e.g. unexpected 200 with no JSON)
        const text = await response.text();
        if (!text) return undefined as unknown as T;
        try {
            return JSON.parse(text) as T;
        } catch {
            return undefined as unknown as T;
        }
    }

    getCurrentUser(): Promise<SpotifyUserProfile> {
        return this.request<SpotifyUserProfile>('/me');
    }

    getUserPlaylists(limit = 50, offset = 0): Promise<SpotifyPaging<SpotifyPlaylist>> {
        return this.request<SpotifyPaging<SpotifyPlaylist>>(
            `/me/playlists?limit=${limit}&offset=${offset}`,
        );
    }

    getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
        return this.request<SpotifyPlaylist>(`/playlists/${playlistId}`);
    }

    getPlaylistTracks(
        playlistId: string,
        limit = 100,
        offset = 0,
    ): Promise<SpotifyPaging<SpotifyPlaylistTrack>> {
        return this.request<SpotifyPaging<SpotifyPlaylistTrack>>(
            `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(added_at,is_local,track(id,name,duration_ms,track_number,disc_number,explicit,is_playable,artists(id,name,uri),album(id,name,release_date,images,artists(id,name,uri)),uri,preview_url)),total,next,offset`,
        );
    }

    search(
        query: string,
        types: Array<'album' | 'artist' | 'playlist' | 'track'>,
        limit = 20,
        offset = 0,
    ): Promise<SpotifySearchResults> {
        const typeParam = types.join(',');
        const encoded = encodeURIComponent(query);
        return this.request<SpotifySearchResults>(
            `/search?q=${encoded}&type=${typeParam}&limit=${limit}&offset=${offset}`,
        );
    }

    getArtist(artistId: string): Promise<SpotifyFullArtist> {
        return this.request<SpotifyFullArtist>(`/artists/${artistId}`);
    }

    getArtistTopTracks(artistId: string): Promise<{ tracks: SpotifyTrack[] }> {
        return this.request<{ tracks: SpotifyTrack[] }>(
            `/artists/${artistId}/top-tracks?market=from_token`,
        );
    }

    getAlbum(albumId: string): Promise<SpotifyFullAlbum> {
        return this.request<SpotifyFullAlbum>(`/albums/${albumId}`);
    }

    getAlbumTracks(
        albumId: string,
        limit = 50,
        offset = 0,
    ): Promise<SpotifyPaging<SpotifyTrack>> {
        return this.request<SpotifyPaging<SpotifyTrack>>(
            `/albums/${albumId}/tracks?limit=${limit}&offset=${offset}&market=from_token`,
        );
    }

    // -----------------------------------------------------------------------
    // Library / Follow endpoints
    // -----------------------------------------------------------------------

    getSavedTracks(limit = 50, offset = 0): Promise<SpotifyPaging<SpotifySavedTrack>> {
        return this.request<SpotifyPaging<SpotifySavedTrack>>(
            `/me/tracks?limit=${limit}&offset=${offset}&market=from_token`,
        );
    }

    saveLibraryItems(uris: string[]): Promise<void> {
        const encoded = uris.map(encodeURIComponent).join(',');
        return this.request<void>(`/me/library?uris=${encoded}`, { method: 'PUT' });
    }

    removeLibraryItems(uris: string[]): Promise<void> {
        const encoded = uris.map(encodeURIComponent).join(',');
        return this.request<void>(`/me/library?uris=${encoded}`, { method: 'DELETE' });
    }

    checkLibraryContains(uris: string[]): Promise<boolean[]> {
        const encoded = uris.map(encodeURIComponent).join(',');
        return this.request<boolean[]>(`/me/library/contains?uris=${encoded}`);
    }

    followArtist(artistId: string): Promise<void> {
        return this.request<void>(`/me/following?type=artist&ids=${artistId}`, { method: 'PUT' });
    }

    unfollowArtist(artistId: string): Promise<void> {
        return this.request<void>(`/me/following?type=artist&ids=${artistId}`, { method: 'DELETE' });
    }

    checkFollowingArtist(artistId: string): Promise<boolean> {
        return this.request<boolean[]>(`/me/following/contains?type=artist&ids=${artistId}`).then(
            (res) => Array.isArray(res) ? res[0] ?? false : false,
        );
    }

    /**
     * Transfer playback to this Web Playback SDK device and start playing a list of Spotify URIs.
     */
    play(deviceId: string, uris: string[]): Promise<void> {
        return this.request<void>(
            `/me/player/play?device_id=${deviceId}`,
            {
                body: JSON.stringify({ uris }),
                method: 'PUT',
            },
        );
    }

    transferPlayback(deviceId: string, play = true): Promise<void> {
        return this.request<void>('/me/player', {
            body: JSON.stringify({ device_ids: [deviceId], play }),
            method: 'PUT',
        });
    }

    resumePlayback(deviceId: string): Promise<void> {
        return this.request<void>(`/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
        });
    }

    pausePlayback(deviceId: string): Promise<void> {
        return this.request<void>(`/me/player/pause?device_id=${deviceId}`, {
            method: 'PUT',
        });
    }

    getPlaybackState(): Promise<{ is_playing: boolean; progress_ms: number | null } | null> {
        return this.request<{ is_playing: boolean; progress_ms: number | null } | null>('/me/player');
    }

    seekToPosition(deviceId: string, positionMs: number): Promise<void> {
        return this.request<void>(`/me/player/seek?position_ms=${positionMs}&device_id=${deviceId}`, {
            method: 'PUT',
        });
    }

    exchangeToken(
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

        return fetch('https://accounts.spotify.com/api/token', {
            body: body.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
        }).then((res) => {
            if (!res.ok) throw new SpotifyApiError(res.status, res.statusText);
            return res.json();
        });
    }

    refreshAccessToken(
        refreshToken: string,
        clientId: string,
    ): Promise<SpotifyTokenResponse> {
        const body = new URLSearchParams({
            client_id: clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        return fetch('https://accounts.spotify.com/api/token', {
            body: body.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
        }).then((res) => {
            if (!res.ok) throw new SpotifyApiError(res.status, res.statusText);
            return res.json();
        });
    }
}

export const spotifyApiClient = new SpotifyApiClient();
