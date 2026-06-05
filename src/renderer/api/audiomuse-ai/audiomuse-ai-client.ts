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
        const message =
            (body as any).error ||
            (body as any).response?.message ||
            (body as any).message ||
            `AudioMuse-AI request failed: ${res.status}`;
        throw new Error(message);
    }
    return res.json() as Promise<T>;
}

export const audioMuseAIClient = {
    /** Instant Playlist – AI-generated playlist from a natural language prompt.
     *  POST /chat/api/chatPlaylist
     */
    async instantPlaylist(
        opts: RequestOptions & {
            aiModel?: string;
            aiProvider?: string;
            limit?: number;
            ollamaServerUrl?: string;
            openaiServerUrl?: string;
            userInput: string;
        },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, userInput, aiProvider = 'NONE', aiModel, openaiServerUrl, ollamaServerUrl, limit } = opts;
        const body: Record<string, unknown> = { ai_provider: aiProvider, userInput };
        if (aiModel) body.ai_model = aiModel;
        if (openaiServerUrl) body.openai_server_url = openaiServerUrl;
        if (ollamaServerUrl) body.ollama_server_url = ollamaServerUrl;
        if (limit !== undefined) body.limit = limit;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/api/chatPlaylist`, {
            body: JSON.stringify(body),
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

    /** SemGrove Search – find songs lyrically and sonically similar to a seed song.
     *  POST /api/sem_grove/search
     */
    async semGroveSearch(
        opts: RequestOptions & { itemId: string; limit?: number },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, itemId, limit = 50 } = opts;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/sem_grove/search`, {
            body: JSON.stringify({ item_id: itemId, limit }),
            headers: getHeaders(token),
            method: 'POST',
        });
        const data = await handleResponse<any>(res);
        return ((data.results as any[]) || []).map((r) => ({
            album: r.album,
            author: r.author,
            item_id: String(r.item_id),
            similarity: r.similarity,
            title: r.title,
        }));
    },

    /** Sonic Fingerprint – per-user recommendation based on listening habits.
     *  POST /api/sonic_fingerprint/generate
     */
    async sonicFingerprint(
        opts: RequestOptions & {
            jellyfinToken?: string;
            jellyfinUserId?: string;
            n?: number;
            navidromePassword?: string;
            navidromeUser?: string;
        },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, n, jellyfinUserId, jellyfinToken, navidromeUser, navidromePassword } = opts;
        const body: Record<string, unknown> = {};
        if (n !== undefined) body.n = n;
        if (jellyfinUserId) body.jellyfin_user_identifier = jellyfinUserId;
        if (jellyfinToken) body.jellyfin_token = jellyfinToken;
        if (navidromeUser) body.navidrome_user = navidromeUser;
        if (navidromePassword) body.navidrome_password = navidromePassword;
        console.log('[sonicFingerprint] Request body keys:', Object.keys(body), 'hasPassword:', Boolean(body.navidrome_password));
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/sonic_fingerprint/generate`, {
            body: JSON.stringify(body),
            headers: getHeaders(token),
            method: 'POST',
        });
        const results = await handleResponse<any[]>(res);
        return results.map((r) => ({
            album: r.album,
            author: r.author,
            distance: r.distance,
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
            pathFixSize?: boolean;
            startSongId: string;
        },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, startSongId, endSongId, maxSteps = 10, pathFixSize } = opts;
        const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/find_path`);
        url.searchParams.set('start_song_id', startSongId);
        url.searchParams.set('end_song_id', endSongId);
        url.searchParams.set('max_steps', String(maxSteps));
        if (pathFixSize !== undefined) {
            url.searchParams.set('path_fix_size', pathFixSize ? 'true' : 'false');
        }
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
            subtractDistance?: number;
            temperature?: number;
        },
    ): Promise<AudioMuseTrack[]> {
        const { baseUrl, token, items, n = 50, subtractDistance, temperature } = opts;
        const body: Record<string, unknown> = { items, n };
        if (temperature !== undefined) body.temperature = temperature;
        if (subtractDistance !== undefined) body.subtract_distance = subtractDistance;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/alchemy`, {
            body: JSON.stringify(body),
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
