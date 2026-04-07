// Spotify Web API response types (subset needed for Phase 1)

export interface SpotifyImage {
    height: null | number;
    url: string;
    width: null | number;
}

export interface SpotifySimplifiedArtist {
    id: string;
    name: string;
    uri: string;
}

export interface SpotifySimplifiedAlbum {
    album_type?: string;
    artists: SpotifySimplifiedArtist[];
    id: string;
    images: SpotifyImage[];
    name: string;
    release_date: string;
    release_date_precision: 'day' | 'month' | 'year';
    total_tracks?: number;
    uri: string;
}

export interface SpotifySearchArtist extends SpotifySimplifiedArtist {
    genres: string[];
    images: SpotifyImage[];
    popularity: number;
}

export interface SpotifySavedTrack {
    added_at: string;
    track: SpotifyTrack;
}

export interface SpotifyTrack {
    album: SpotifySimplifiedAlbum;
    artists: SpotifySimplifiedArtist[];
    disc_number: number;
    duration_ms: number;
    explicit: boolean;
    id: string;
    is_local: boolean;
    is_playable?: boolean;
    name: string;
    popularity: number;
    preview_url: null | string;
    track_number: number;
    uri: string;
}

export interface SpotifyPlaylistOwner {
    display_name: null | string;
    id: string;
}

export interface SpotifyPlaylist {
    collaborative: boolean;
    description: null | string;
    id: string;
    images: SpotifyImage[];
    name: string;
    owner: SpotifyPlaylistOwner;
    public: boolean | null;
    tracks: { href: string; total: number };
    uri: string;
}

export interface SpotifyPlaylistTrack {
    added_at: null | string;
    is_local: boolean;
    track: null | SpotifyTrack;
}

export interface SpotifyPaging<T> {
    href: string;
    items: T[];
    limit: number;
    next: null | string;
    offset: number;
    previous: null | string;
    total: number;
}

export interface SpotifyUserProfile {
    display_name: null | string;
    email: string;
    id: string;
    images: SpotifyImage[];
    product: 'free' | 'open' | 'premium';
}

export interface SpotifyTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    token_type: string;
}

export interface SpotifySearchResults {
    albums?: SpotifyPaging<SpotifySimplifiedAlbum>;
    artists?: SpotifyPaging<SpotifySearchArtist>;
    playlists?: SpotifyPaging<SpotifyPlaylist>;
    tracks?: SpotifyPaging<SpotifyTrack>;
}

export interface SpotifyFullArtist {
    followers: { total: number };
    genres: string[];
    id: string;
    images: SpotifyImage[];
    name: string;
    popularity: number;
    uri: string;
}

export interface SpotifyFullAlbum {
    album_type: string;
    artists: SpotifySimplifiedArtist[];
    id: string;
    images: SpotifyImage[];
    name: string;
    release_date: string;
    release_date_precision: 'day' | 'month' | 'year';
    total_tracks: number;
    tracks: SpotifyPaging<SpotifySimplifiedTrack>;
    uri: string;
}

export interface SpotifySimplifiedTrack {
    artists: SpotifySimplifiedArtist[];
    disc_number: number;
    duration_ms: number;
    explicit: boolean;
    id: string;
    is_local: boolean;
    is_playable?: boolean;
    name: string;
    preview_url: null | string;
    track_number: number;
    uri: string;
}

// Application-level Spotify auth state
export interface SpotifyAuthState {
    accessToken: null | string;
    expiresAt: null | number; // Unix ms timestamp
    isAuthenticated: boolean;
    isPremium: boolean;
    refreshToken: null | string;
    user: null | {
        displayName: null | string;
        email: string;
        id: string;
        imageUrl: null | string;
        product: 'free' | 'open' | 'premium';
    };
}

// Spotify Web Playback SDK types
// The SDK is loaded at runtime so we extend the Window type
export interface SpotifySDKPlayer {
    addListener(event: 'account_error', callback: (e: { message: string }) => void): void;
    addListener(event: 'authentication_error', callback: (e: { message: string }) => void): void;
    addListener(event: 'initialization_error', callback: (e: { message: string }) => void): void;
    addListener(event: 'not_ready', callback: (e: { device_id: string }) => void): void;
    addListener(event: 'playback_error', callback: (e: { message: string }) => void): void;
    addListener(event: 'player_state_changed', callback: (state: null | SpotifyPlaybackState) => void): void;
    addListener(event: 'ready', callback: (e: { device_id: string }) => void): void;
    connect(): Promise<boolean>;
    disconnect(): void;
    getCurrentState(): Promise<null | SpotifyPlaybackState>;
    getVolume(): Promise<number>;
    nextTrack(): Promise<void>;
    pause(): Promise<void>;
    previousTrack(): Promise<void>;
    removeListener(event: string, callback?: Function): void;
    resume(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    setVolume(volume: number): Promise<void>;
    togglePlay(): Promise<void>;
}

export interface SpotifyPlaybackState {
    context: {
        metadata: unknown;
        uri: null | string;
    };
    disallows: {
        pausing?: boolean;
        peeking_next?: boolean;
        peeking_prev?: boolean;
        resuming?: boolean;
        seeking?: boolean;
        skipping_next?: boolean;
        skipping_prev?: boolean;
    };
    duration: number;
    loading: boolean;
    paused: boolean;
    position: number;
    repeat_mode: number;
    restrictions: unknown;
    shuffle: boolean;
    timestamp: number;
    track_window: {
        current_track: SpotifyWebTrack;
        next_tracks: SpotifyWebTrack[];
        previous_tracks: SpotifyWebTrack[];
    };
}

export interface SpotifyWebTrack {
    album: {
        images: SpotifyImage[];
        name: string;
        uri: string;
    };
    artists: Array<{ name: string; uri: string }>;
    duration_ms: number;
    id: null | string;
    is_playable: boolean;
    media_type: string;
    name: string;
    type: string;
    uid: string;
    uri: string;
}

declare global {
    interface Window {
        Spotify: {
            Player: new (options: {
                getOAuthToken: (cb: (token: string) => void) => void;
                name: string;
                volume?: number;
            }) => SpotifySDKPlayer;
        };
        onSpotifyWebPlaybackSDKReady: () => void;
    }
}
