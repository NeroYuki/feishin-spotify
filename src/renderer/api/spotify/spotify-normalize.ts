import {
    SpotifyPlaylist,
    SpotifyPlaylistTrack,
    SpotifyTrack,
} from '/@/renderer/features/spotify/api/spotify-types';
import {
    BasePaginatedResponse,
    LibraryItem,
    Playlist,
    RelatedArtist,
    ServerType,
    Song,
} from '/@/shared/types/domain-types';

export const SPOTIFY_SERVER_ID = '__spotify__';

const normalizeArtist = (a: {
    id: string;
    name: string;
}): RelatedArtist => ({
    id: a.id,
    imageId: null,
    imageUrl: null,
    name: a.name,
    userFavorite: false,
    userRating: null,
});

export const normalizeSpotifyTrack = (track: SpotifyTrack): Song => {
    const releaseYear = track.album.release_date
        ? parseInt(track.album.release_date.substring(0, 4), 10)
        : null;

    return {
        _itemType: LibraryItem.SONG,
        _serverId: SPOTIFY_SERVER_ID,
        _serverType: ServerType.SPOTIFY,
        album: track.album.name,
        albumArtistName: track.album.artists?.[0]?.name ?? '',
        albumArtists: (track.album.artists ?? []).map(normalizeArtist),
        albumId: track.album.id,
        artistName: track.artists.map((a) => a.name).join(', '),
        artists: track.artists.map(normalizeArtist),
        bitDepth: null,
        bitRate: 0,
        channels: null,
        comment: null,
        // Spotify uses Ogg Vorbis or AAC depending on quality — generic label
        container: 'spotify',
        createdAt: '',
        discNumber: track.disc_number,
        duration: track.duration_ms,
        explicitStatus: track.explicit ? ('EXPLICIT' as any) : ('CLEAN' as any),
        bpm: null,
        compilation: null,
        discSubtitle: null,
        gain: null,
        genres: [],
        id: track.id,
        imageId: null,
        imageUrl: track.album.images?.[0]?.url ?? null,
        lastPlayedAt: null,
        lyrics: null,
        mbzRecordingId: null,
        mbzTrackId: null,
        name: track.name,
        participants: null,
        path: null,
        peak: null,
        playCount: 0,
        releaseDate: track.album.release_date ?? null,
        releaseYear,
        sampleRate: null,
        size: 0,
        sortName: track.name,
        tags: null,
        trackNumber: track.track_number,
        trackSubtitle: null,
        updatedAt: '',
        userFavorite: false,
        userRating: null,
    };
};

export const normalizeSpotifyPlaylist = (playlist: SpotifyPlaylist): Playlist => ({
    _itemType: LibraryItem.PLAYLIST,
    _serverId: SPOTIFY_SERVER_ID,
    _serverType: ServerType.SPOTIFY,
    description: playlist.description?.replace(/<[^>]*>/g, '') ?? null,
    duration: null,
    genres: [],
    id: playlist.id,
    imageId: null,
    imageUrl: playlist.images?.[0]?.url ?? null,
    name: playlist.name,
    owner: playlist.owner.display_name ?? playlist.owner.id,
    ownerId: playlist.owner.id,
    public: playlist.public ?? null,
    size: null,
    songCount: playlist.tracks.total,
    sync: null,
});

export const normalizeSpotifyPlaylistTracks = (
    items: SpotifyPlaylistTrack[],
    total: number,
    offset: number,
): BasePaginatedResponse<Song[]> => {
    const songs = items
        .filter((item) => !item.is_local && item.track !== null && item.track.id !== null)
        .map((item) => normalizeSpotifyTrack(item.track!));

    return {
        items: songs,
        startIndex: offset,
        totalRecordCount: total,
    };
};

export const normalizeSpotifyPlaylists = (
    items: SpotifyPlaylist[],
    total: number,
    offset: number,
): BasePaginatedResponse<Playlist[]> => ({
    items: items.map(normalizeSpotifyPlaylist),
    startIndex: offset,
    totalRecordCount: total,
});
