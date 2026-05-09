export interface AudioMuseTrack {
    album?: string;
    author?: string;
    distance?: number;
    item_id: string;
    similarity?: number;
    title: string;
}

interface RequestOptions {
    baseUrl: string;
    token: string;
}

function getHeaders(token: string): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || `AudioMuse-AI request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
}

export const audioMuseAIClient = {
    /** Instant Playlist – AI-generated playlist from a natural language prompt.
     *  POST /api/chatPlaylist
     */
    async instantPlaylist(
        opts: RequestOptions & { aiProvider?: string; userInput: string },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, userInput, aiProvider = 'NONE' } = opts;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chatPlaylist`, {
            body: JSON.stringify({ ai_provider: aiProvider, userInput }),
            headers: getHeaders(token),
            method: 'POST',
        });
        const data = await handleResponse<any>(res);
        return ((data.response?.query_results as any[]) || []).map((r) => ({
            album: r.album,
            author: r.artist ?? r.author,
            item_id: String(r.item_id),
            title: r.title,
        }));
    },

    /** Song Path – find a path of musically similar songs between two tracks.
     *  GET /api/find_path
     */
    async songPath(
        opts: RequestOptions & {
            endSongId: string;
            maxSteps?: number;
            startSongId: string;
        },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, startSongId, endSongId, maxSteps = 10 } = opts;
        const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/find_path`);
        url.searchParams.set('start_song_id', startSongId);
        url.searchParams.set('end_song_id', endSongId);
        url.searchParams.set('max_steps', String(maxSteps));
        const res = await fetch(url.toString(), { headers: getHeaders(token) });
        const data = await handleResponse<any>(res);
        return ((data.path as any[]) || []).map((r) => ({
            album: r.album,
            author: r.author,
            item_id: String(r.item_id),
            title: r.title,
        }));
    },

    /** Song Alchemy – blend/subtract songs/artists to find a sonic centroid.
     *  POST /api/alchemy
     */
    async songAlchemy(
        opts: RequestOptions & {
            items: Array<{ id: string; op: 'ADD' | 'SUBTRACT'; type: 'artist' | 'song' }>;
            n?: number;
        },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, items, n = 50 } = opts;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/alchemy`, {
            body: JSON.stringify({ items, n }),
            headers: getHeaders(token),
            method: 'POST',
        });
        const data = await handleResponse<any>(res);
        return ((data.results as any[]) || []).map((r) => ({
            album: r.album,
            author: r.author ?? r.artist,
            distance: r.distance,
            item_id: String(r.item_id),
            title: r.title,
        }));
    },

    /** Text Search – find songs matching a text description using CLAP/MuLan embeddings.
     *  POST /api/clap/search
     */
    async textSearch(
        opts: RequestOptions & { limit?: number; query: string },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, query, limit = 50 } = opts;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/clap/search`, {
            body: JSON.stringify({ limit, query }),
            headers: getHeaders(token),
            method: 'POST',
        });
        const data = await handleResponse<any>(res);
        return ((data.results as any[]) || []).map((r) => ({
            album: r.album,
            author: r.author ?? r.artist,
            item_id: String(r.item_id),
            similarity: r.similarity,
            title: r.title,
        }));
    },

    /** Lyric Search – find songs by free-text search over lyrics.
     *  POST /api/lyrics/search/text
     */
    async lyricSearch(
        opts: RequestOptions & { limit?: number; query: string },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, query, limit = 50 } = opts;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/lyrics/search/text`, {
            body: JSON.stringify({ limit, query }),
            headers: getHeaders(token),
            method: 'POST',
        });
        const data = await handleResponse<any>(res);
        return ((data.results as any[]) || []).map((r) => ({
            album: r.album,
            author: r.author ?? r.artist,
            item_id: String(r.item_id),
            title: r.title,
        }));
    },

    /** Ping – verify connectivity and authentication.
     *  GET /api/health (no auth required, but we send the token so a 401 surfaces bad tokens)
     *  Returns true on success, throws on error.
     */
    async ping(opts: RequestOptions): Promise<{ status: string }> {
        const { baseUrl, token } = opts;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, {
            headers: getHeaders(token),
        });
        return handleResponse<{ status: string }>(res);
    },

    /** Track autocomplete – search tracks by title / artist for song pickers.
     *  GET /api/search_tracks
     */
    async searchTracks(
        opts: RequestOptions & { limit?: number; query: string },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, query, limit = 20 } = opts;
        const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/search_tracks`);
        url.searchParams.set('search_query', query);
        url.searchParams.set('end', String(limit));
        const res = await fetch(url.toString(), { headers: getHeaders(token) });
        const results = await handleResponse<any[]>(res);
        return results.map((r) => ({
            album: r.album,
            author: r.author,
            item_id: String(r.item_id),
            title: r.title,
        }));
    },
};
