// Types for the Every Noise at Once genre scatter plot data

export interface GenreRelated {
    count: string;
    genre: string;
}

export interface GenreEntry {
    atmospheric_index: number;
    color: [number, number, number]; // [H 0-360, S 0-1, V 0-1]
    desc: string;
    genre: string;
    organic_index: number;
    popularity: number;
    preview_url: string;
    related_genres: GenreRelated[];
    sample_song: string;
    spotify_playlist: string;
}

export interface GenreArtist {
    artist: string;
    artist_id: string;
    preview_url: string;
    sample_song: string;
    track_id?: string;
}

export interface GenreArtistsEntry {
    artists: GenreArtist[];
    genre: string;
}

// Spatial grid index for O(1) hit-testing
export interface SpatialCell {
    genres: GenreEntry[];
}

export interface SpatialIndex {
    cellSize: number;
    cols: number;
    grid: SpatialCell[][];
    rows: number;
}

// Canvas transform state
export interface CanvasTransform {
    offsetX: number;
    offsetY: number;
    scale: number;
}

// IDB meta store values
export interface IDBImportStatus {
    done: boolean;
    progress: number;
    totalGenres: number;
}
