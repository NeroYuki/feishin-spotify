import { QueueSong, Song } from '/@/shared/types/domain-types';
import { PlayerRepeat, PlayerStatus, SongState } from '/@/shared/types/types';

export interface ClientAuth {
    event: 'authenticate';
    header: string;
}

export type ClientEvent =
    | ClientAuth
    | ClientFavorite
    | ClientPosition
    | ClientRating
    | ClientSimpleEvent
    | ClientVolume
    | ClientQueueRequest
    | ClientQueueAction
    | ClientQueueAdd
    | ClientSearch
    | ClientSuggestSearch
    | ClientSimilarSongs
    | ClientSameArtist
    | ClientSameAlbum
    | ClientRandomSongs;

export interface ClientFavorite {
    event: 'favorite';
    favorite: boolean;
    id: string;
}

export interface ClientPosition {
    event: 'position';
    position: number;
}

export interface ClientRating {
    event: 'rating';
    id: string;
    rating: number;
}
export interface ClientSimpleEvent {
    event: 'next' | 'pause' | 'play' | 'previous' | 'proxy' | 'repeat' | 'shuffle';
}

export interface ClientVolume {
    event: 'volume';
    volume: number;
}

/** Request the current queue from the server */
export interface ClientQueueRequest {
    event: 'queue';
}

/** Queue manipulation: play, move, remove, or add items */
export type ClientQueueAction =
    | { event: 'queue-play'; index: number }
    | { event: 'queue-move'; from: number; to: number }
    | { event: 'queue-remove'; ids: string[] };

/** Add items to queue (from search results) */
export interface ClientQueueAdd {
    event: 'queue-add';
    items: Song[];
    playType: 'now' | 'next' | 'last';
}

/** Search request */
export interface ClientSearch {
    event: 'search';
    query: string;
    spotifySearch?: boolean;
}

/** Lightweight search for autocomplete (separate from main search) */
export interface ClientSuggestSearch {
    event: 'suggest-search';
    query: string;
}

/** Request similar songs (track radio) for a given track */
export interface ClientSimilarSongs {
    event: 'similar-songs';
    songId: string;
    song: Song;
}

/** Request songs from the same artist */
export interface ClientSameArtist {
    event: 'same-artist';
    artistName: string;
    artistId?: string;
}

/** Request songs from the same album */
export interface ClientSameAlbum {
    event: 'same-album';
    albumName: string;
    albumId?: string;
}

/** Request random songs */
export interface ClientRandomSongs {
    event: 'random-songs';
    size?: number;
}

export interface ServerError {
    data: string;
    event: 'error';
}

export type ServerEvent =
    | ServerError
    | ServerFavorite
    | ServerPlayStatus
    | ServerPosition
    | ServerProxy
    | ServerRating
    | ServerRepeat
    | ServerShuffle
    | ServerSong
    | ServerState
    | ServerVolume
    | ServerQueue
    | ServerSearchResults
    | ServerSuggestSearchResults
    | ServerSimilarSongs
    | ServerSameArtist
    | ServerSameAlbum
    | ServerRandomSongs;

export interface ServerFavorite {
    data: { favorite: boolean; id: string };
    event: 'favorite';
}

export interface ServerPlayStatus {
    data: PlayerStatus;
    event: 'playback';
}

export interface ServerPosition {
    data: number;
    event: 'position';
}

export interface ServerProxy {
    data: string;
    event: 'proxy';
}

export interface ServerRating {
    data: { id: string; rating: number };
    event: 'rating';
}

export interface ServerRepeat {
    data: PlayerRepeat;
    event: 'repeat';
}

export interface ServerShuffle {
    data: boolean;
    event: 'shuffle';
}

export interface ServerSong {
    data: null | QueueSong;
    event: 'song';
}

export interface ServerState {
    data: SongState;
    event: 'state';
}

export interface ServerVolume {
    data: number;
    event: 'volume';
}

export interface SongUpdateSocket extends Omit<SongState, 'song'> {
    position?: number;
    song?: null | QueueSong;
}

/** Full queue state sent to remotes */
export interface QueueData {
    index: number;
    items: QueueSong[];
}

export interface ServerQueue {
    data: QueueData;
    event: 'queue';
}

/** Search results sent to the requesting remote */
export interface SearchResultData {
    query: string;
    songs: Song[];
    wsClientId?: string;
}

export interface ServerSearchResults {
    data: SearchResultData;
    event: 'search-results';
}

/** Autocomplete search results */
export interface SuggestSearchResultData {
    query: string;
    songs: Song[];
}

export interface ServerSuggestSearchResults {
    data: SuggestSearchResultData;
    event: 'suggest-search-results';
}

/** Similar songs (track radio) results */
export interface SimilarSongsData {
    seedSong: Song;
    songs: Song[];
    truncated?: boolean;
}

export interface ServerSimilarSongs {
    data: SimilarSongsData;
    event: 'similar-songs';
}

/** Same artist results */
export interface SameArtistData {
    artistName: string;
    songs: Song[];
    truncated?: boolean;
}

export interface ServerSameArtist {
    data: SameArtistData;
    event: 'same-artist';
}

/** Same album results */
export interface SameAlbumData {
    albumName: string;
    songs: Song[];
    truncated?: boolean;
}

export interface ServerSameAlbum {
    data: SameAlbumData;
    event: 'same-album';
}

/** Random songs results */
export interface RandomSongsData {
    songs: Song[];
}

export interface ServerRandomSongs {
    data: RandomSongsData;
    event: 'random-songs';
}
