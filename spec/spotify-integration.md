# Spotify Integration — Implementation Plan

> **Status**: Phase 1 Complete  
> **Target**: Feishin Music Player  
> **Scope**: Phase 1 — Separate Spotify tab with OAuth, playlist access, search, librespot Connect device, and mixed queue support

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Codebase Integration Points](#2-codebase-integration-points)
3. [Phase 1 Feature Scope](#3-phase-1-feature-scope)
4. [Implementation Details](#4-implementation-details)
   - 4.1 [Spotify OAuth Flow](#41-spotify-oauth-flow)
   - 4.2 [Spotify API Client & Normalizer](#42-spotify-api-client--normalizer)
   - 4.3 [Type System Extensions](#43-type-system-extensions)
   - 4.4 [Librespot Playback Engine](#44-librespot-playback-engine)
   - 4.5 [Spotify Feature Module (UI)](#45-spotify-feature-module-ui)
   - 4.6 [Mixed Queue Support](#46-mixed-queue-support)
   - 4.7 [Search Interface](#47-search-interface)
   - 4.8 [Routing & Navigation](#48-routing--navigation)
5. [File Structure](#5-file-structure)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [Migration & Compatibility Concerns](#7-migration--compatibility-concerns)
8. [Security Considerations](#8-security-considerations)
9. [Future Phases](#9-future-phases)

---

## 1. Architecture Overview

Feishin uses a **controller pattern** to abstract multiple server backends (Navidrome, Jellyfin, Subsonic) behind a unified `ControllerEndpoint` interface. Each server type has its own controller implementation, normalizer (server response → domain types), and authentication flow.

Spotify integration works **alongside** existing backends rather than replacing them. The key architectural decision made during Phase 1: instead of the **Web Playback SDK** (planned), playback is handled by **`@lox-audioserver/node-librespot`** — a native Rust addon that creates a Spotify Connect device in the Electron main process. PCM audio (s16le 44.1 kHz stereo) streams over IPC to the renderer, where a Web Audio API scheduler plays it gaplessly.

This approach gives:
- **No Widevine / DRM issues** — librespot handles codec decoding natively
- **PCM in-process** — enables the existing audiomotion visualizer and web audio pipeline to work
- **True Spotify Connect** — device is visible and controllable via Spotify apps

### High-Level Architecture (as implemented)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Electron Main Process                        │
│                                                                       │
│  ┌──────────────────────────────────────┐                            │
│  │  LibrespotPlayer (librespot-player.ts)│                            │
│  │  • startConnectDeviceWithToken()      │                            │
│  │  • Spotify Connect device (40-char   │                            │
│  │    hex device ID via crypto.random)  │                            │
│  │  • PCM callback → IPC 'librespot-pcm'│                            │
│  │  • Event callback → IPC 'librespot-event'                         │
│  └──────────────────────────────────────┘                            │
│               ↕ IPC (librespot-init, -stop, -volume, -device-id)     │
└──────────────────────────────────────────────────────────────────────┘
               ↕
┌──────────────────────────────────────────────────────────────────────┐
│                         Electron Renderer                             │
│                                                                       │
│  ┌──────────────────────┐    ┌────────────────────────────────────┐  │
│  │     SpotifyPlayer     │    │     useSpotifyPcmPlayer            │  │
│  │  (headless component) │    │  • Subscribes to IPC PCM chunks   │  │
│  │  • librespotInit()    │    │  • DataView s16le → Float32       │  │
│  │  • play/pause/seek    │    │  • AudioBufferSourceNode scheduler│  │
│  │    via Spotify Web API│    │  • Uses shared WebAudio context   │  │
│  │  • position polling   │    │    (visualizer sees Spotify audio) │  │
│  │  • end_of_track →     │    └────────────────────────────────────┘  │
│  │    mediaNext()        │                                             │
│  └──────────────────────┘                                             │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              Unified Queue (player.store)                       │   │
│  │    QueueSong[] — mixed _serverType per song                     │   │
│  │    Song.duration in milliseconds                                │   │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐    │
│  │   WebPlayer / MpvPlayer│   │  SpotifyPlayer                   │    │
│  │   Handles library songs│   │  Handles Spotify songs via       │    │
│  │   Skips timestamp for  │   │  librespot + Web API             │    │
│  │   Spotify songs        │   │                                  │    │
│  └──────────────────────┘    └──────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Codebase Integration Points

| Area | Key Files | Status |
|------|-----------|--------|
| **Server Types** | `src/shared/types/domain-types.ts` | ✅ `ServerType.SPOTIFY` added |
| **Song Type** | `src/shared/types/domain-types.ts` | ✅ No changes — Spotify songs normalize to `Song` |
| **Stream URL Hook** | `use-stream-url.tsx` | ✅ Returns `null` for Spotify songs (early return) |
| **Audio Players** | `audio-players.tsx` | ✅ `<SpotifyPlayer />` mounted alongside `WebPlayer` |
| **Web Player** | `web-player.tsx` | ✅ Skips timestamp update for Spotify songs |
| **Mpv Player** | `mpv-player.tsx` | ✅ Skips timestamp update for Spotify songs |
| **Player Store** | `player.store.ts` | ✅ No structural changes — queue supports mixed sources |
| **Auth Store** | `src/renderer/features/spotify/store/spotify-auth.store.ts` | ✅ Dedicated store (not in main auth store) |
| **Router** | `routes.ts`, `app-router.tsx` | ✅ Spotify routes added |
| **Sidebar** | sidebar components | ✅ Spotify nav section added |
| **Lyrics API** | `lyrics-api.ts` → `fetchLocalLyrics` | ✅ Returns `null` for unknown server (Spotify) instead of throwing |
| **Visualizer** | `use-spotify-pcm-player.ts` | ✅ Uses shared `webAudio` context; PCM flows into visualizer |
| **Preload** | `src/preload/utils.ts` | ✅ IPC bridge methods for librespot added |
| **IPC layer** | `src/main/features/core/spotify/index.ts` | ✅ Forwards PCM, events, volume to renderer |
| **Update current song** | `use-update-current-song.ts` | ✅ Early return for Spotify (no `getSongDetail` route) |
| **Discord RPC** | Not yet updated | ⬜ Future |
| **Scrobbling** | Not yet skipped for Spotify | ⬜ Future |

---

## 3. Phase 1 Feature Scope

### Completed ✅
- **Spotify OAuth 2.0 PKCE** login/logout (Electron deep link `feishin://spotify/callback`, loopback `http://127.0.0.1:27042/spotify/callback` in dev)
- **Browse saved playlists** from the connected Spotify account
- **View playlist tracks** with metadata (title, artist, album, artwork, duration)
- **Search Spotify catalog** (tracks) with basic UI
- **Playback via librespot** — full Spotify Connect device in main process, PCM streamed to Web Audio API
- **Mixed queue** — add Spotify tracks alongside library songs in the unified queue
- **Spotify tab** in sidebar for browsing Spotify content
- **Token refresh** — automatic access token renewal
- **Album art** for Spotify songs in queue/now-playing
- **Progress bar** — position polling via Spotify Web API + librespot `playing` event; WebPlayer/MpvPlayer skip timestamp updates for Spotify songs
- **Lyrics** — remote lyrics fetch works for Spotify songs (local server fetch gracefully skipped)
- **Visualizer** — Spotify PCM feeds into shared WebAudio context; audiomotion/butterchurn work
- **Play/pause/seek** — via Spotify Web API (`/me/player/play`, `/me/player/pause`, `/me/player/seek`)
- **Volume** — forwarded to librespot via IPC
- **End of track** — librespot `end_of_track` event advances queue via `mediaNext()`
- **Premium check** — `useSpotifyIsPremium()` gates playback features

### Descoped / Deferred
- Unified search across Spotify + library simultaneously → Phase 2
- Crossfade between Spotify ↔ library tracks → Phase 2
- Spotify favorites (like/unlike) → Phase 2
- Album & artist detail views → Phase 2
- Self-scrobble prevention for Spotify songs → Phase 2
- Discord RPC Spotify branch → Phase 2

---

## 4. Implementation Details

### 4.1 Spotify OAuth Flow

**OAuth 2.0 Authorization Code with PKCE** — no client secret in renderer.

#### Spotify Developer Setup
- Register app at https://developer.spotify.com/dashboard
- Redirect URIs:
  - `feishin://spotify/callback` — Electron production (deep link)
  - `http://127.0.0.1:27042/spotify/callback` — Electron dev (loopback)
- Required scopes:
  ```
  user-read-private
  user-read-email
  playlist-read-private
  playlist-read-collaborative
  streaming
  user-library-read
  user-read-playback-state
  user-modify-playback-state
  ```

#### Auth Flow (Electron, as implemented)

1. Generate PKCE `code_verifier` + `code_challenge` (S256)
2. Open Spotify auth URL via `window.open()` / Electron `shell.openExternal()`
3. In dev: an Express-style HTTP server on port 27042 intercepts the loopback redirect and sends the code back via IPC `spotify-auth-code`
4. In prod: Electron intercepts `feishin://` deep links via `app.setAsDefaultProtocolClient` / `second-instance`
5. Exchange auth code for tokens: `POST https://accounts.spotify.com/api/token`
6. Store `access_token`, `refresh_token`, `expiresAt` in `spotify-auth.store.ts` (Zustand, persisted)
7. Fetch user profile → determine `isPremium`

#### Token Refresh (`spotify-auth.ts`)
- `refreshSpotifyToken()` sends `grant_type=refresh_token` with `client_id`
- Called automatically by `getValidSpotifyToken()` before any API call when token is within 60s of expiry
- Also triggered on 401 responses in `SpotifyApiClient.request()` (retry-once logic)

#### Key Files
- `src/renderer/features/spotify/api/spotify-auth.ts` — PKCE helpers, token exchange, refresh
- `src/renderer/features/spotify/store/spotify-auth.store.ts` — tokens + user profile (persisted)
- `src/main/features/core/spotify/index.ts` — IPC handlers for auth callback
- `src/preload/utils.ts` — IPC bridge (`librespotInit`, `librespotOnReady`, etc.)

---

### 4.2 Spotify API Client & Normalizer

#### API Client (`src/renderer/features/spotify/api/spotify-api-client.ts`)

Thin fetch wrapper with automatic token injection and 401 retry:

```typescript
class SpotifyApiClient {
  private async request<T>(endpoint, options?, isRetry = false): Promise<T>

  // Used in Phase 1:
  getCurrentUser(): Promise<SpotifyUserProfile>
  getUserPlaylists(limit, offset): Promise<SpotifyPaging<SpotifyPlaylist>>
  getPlaylist(id): Promise<SpotifyPlaylist>
  getPlaylistTracks(id, limit, offset): Promise<SpotifyPaging<SpotifyPlaylistTrack>>
  search(query, types, limit, offset): Promise<SpotifySearchResults>

  // Playback control (via Spotify Web API → librespot Connect device):
  play(deviceId, uris): Promise<void>
  transferPlayback(deviceId, play): Promise<void>
  resumePlayback(deviceId): Promise<void>
  pausePlayback(deviceId): Promise<void>
  getPlaybackState(): Promise<{ is_playing, progress_ms } | null>
  seekToPosition(deviceId, positionMs): Promise<void>
  exchangeToken(...): Promise<SpotifyTokenResponse>
  refreshAccessToken(...): Promise<SpotifyTokenResponse>
}
```

**Key implementation details:**
- `202 Accepted` treated same as `204 No Content` → returns `undefined` (Spotify Play/Pause returns 202)
- Text-parse guard: reads response as text first, skips JSON.parse if empty body
- Single retry on 401 using `refreshSpotifyToken()`

#### Normalizer (`src/renderer/api/spotify/spotify-normalize.ts`)

Converts Spotify API responses to Feishin `Song` / `Playlist` domain types:

```typescript
export const SPOTIFY_SERVER_ID = '__spotify__';

export const normalizeSpotifyTrack = (track: SpotifyTrack): Song => ({
  _itemType: LibraryItem.SONG,
  _serverId: SPOTIFY_SERVER_ID,
  _serverType: ServerType.SPOTIFY,
  id: track.id,
  duration: track.duration_ms,        // milliseconds, matching all other server types
  container: 'spotify',
  // ... all required Song fields
});

export const normalizeSpotifyPlaylist = (playlist: SpotifyPlaylist): Playlist => ({
  description: playlist.description?.replace(/<[^>]*>/g, '') ?? null,  // strip HTML
  // ...
});
```

**No `spotify-controller.ts` was implemented.** Spotify playback does not go through the `ControllerEndpoint` dispatch — the `SpotifyPlayer` component calls `spotifyApiClient` directly, and librespot handles audio streaming.

---

### 4.3 Type System Extensions

```typescript
// src/shared/types/domain-types.ts — implemented

enum ServerType {
  JELLYFIN = 'jellyfin',
  NAVIDROME = 'navidrome',
  SUBSONIC = 'subsonic',
  SPOTIFY = 'spotify',   // ✅ Added
}
```

`Song.duration` is in **milliseconds** throughout the app (consistent with all other server normalizers). `normalizeSpotifyTrack` sets `duration: track.duration_ms` directly.

---

### 4.4 Librespot Playback Engine

> **Note**: The original plan called for the Spotify Web Playback SDK. This was replaced by `@lox-audioserver/node-librespot` — a native Rust addon that creates a real Spotify Connect device in the Electron main process. The Web Playback SDK requires Widevine and cannot pipe raw PCM; librespot gives us PCM directly.

#### LibrespotPlayer (`src/main/features/core/spotify/librespot-player.ts`)

```typescript
class LibrespotPlayer extends EventEmitter {
  async init(accessToken: string): Promise<void> {
    // Device ID: crypto.randomBytes(20).toString('hex') — required 40-char hex format
    // clientId: undefined — uses librespot's built-in Spotify client ID (custom app IDs get 400)
    const handle = await librespot.startConnectDeviceWithToken(
      accessToken, undefined, 'Feishin', deviceId, pcmCallback, eventCallback
    );
    this.readyCb?.(deviceId);  // fires immediately on resolve
  }

  // PCM callback: emits 'pcm' events (s16le 44100 Hz stereo ~4KB chunks)
  // Event callback: proxies ConnectEvent (playing/paused/end_of_track/...)
  // Fields: event.type (camelCase), event.positionMs, event.durationMs, event.trackId
}
```

**Key implementation decisions:**
- `clientId` must be `undefined` — passing a custom app's client ID causes `400 Bad Request` from SPIRC
- Device ID must be 40-character hex — `crypto.randomBytes(20).toString('hex')`
- `ConnectEvent` shape: `.type` (not `.event`), `.positionMs` (not `.position_ms`)

#### PCM Pipeline (`src/renderer/features/spotify/player/use-spotify-pcm-player.ts`)

```typescript
export function useSpotifyPcmPlayer(active: boolean) {
  const { webAudio } = useWebAudio();  // shared context — visualizer sees Spotify audio

  // Effect: when webAudio.context is available, create GainNode connected to webAudio.gains[0]
  // Fallback: own AudioContext if shared not yet available

  // PCM decoding (IPC serializes Buffer as plain object — Buffer methods unavailable):
  const bytes = new Uint8Array(chunk);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sample = view.getInt16(byteOffset, /* littleEndian= */ true);

  // Gapless scheduler: AudioBufferSourceNode per chunk, start = max(nextStartTime, now + 5ms)
}
```

#### SpotifyPlayer Component (`src/renderer/features/spotify/player/spotify-player.tsx`)

Headless component — mounts alongside WebPlayer/MpvPlayer in `audio-players.tsx`:

```typescript
export function SpotifyPlayer() {
  // Init librespot Connect device with fresh OAuth token
  // Handle librespot events: end_of_track → mediaNext(), playing → setTimestamp()

  // Play effect: fires when currentSong.id changes and isReady && deviceId
  //   hasIssuedPlayRef.current = true  ← prevents resumePlayback from firing before play()

  // Play/pause sync: watches playerStatus
  //   Guards resumePlayback with hasIssuedPlayRef — avoids 404 before initial play()

  // Position polling: 1s interval via getPlaybackState() when PLAYING
  // Volume sync: librespotVolume(volume) on volume changes
  // Seek: subscribes to player.seekToTimestamp → seekToPosition()
}
```

**Key correctness guards:**
- `hasIssuedPlayRef` — reset on song change; prevents `resumePlayback` from executing before `play(uri)` has been sent for the current song
- `deviceIdRef` / `isReadyRef` — play/pause effect accesses via refs so dep changes don't re-trigger it
- WebPlayer/MpvPlayer `setTimestamp` intervals skip Spotify songs (`currentSong._serverType === ServerType.SPOTIFY`) to prevent resetting position to 0

---

### 4.5 Spotify Feature Module (UI)

#### Spotify Tab — Playlists View

Route: `/spotify` — shows the user's Spotify playlists as a scrollable list. Each playlist is a Button/Link routing to the detail page. Playlist descriptions have HTML stripped (Spotify embeds `<a href="spotify:...">` tags).

#### Spotify Playlist Detail

Route: `/spotify/playlists/:playlistId` — shows playlist metadata and a `SpotifyTrackList` with infinite scroll. Tracks show: index, title, artist, album, duration (formatted), and play/queue actions.

#### Spotify Search

Route: `/spotify/search` — text search against Spotify catalog (tracks only in Phase 1). Uses `useSpotifySearch` hook with `useDeferredValue` for debouncing. Results shown in `SpotifyTrackList`.

#### Spotify Connect Button

`spotify-connect-button.tsx` — handles login/logout. Shows current user's display name and profile image when connected.

---

### 4.6 Mixed Queue Support

The existing queue system already supports mixed `_serverType` per song. Implemented changes:

1. **`useSongUrl` hook** — early return for `ServerType.SPOTIFY` → `{ url: null, isLoading: false }`. WebPlayer/MpvPlayer remain idle.

2. **`audio-players.tsx`** — `<SpotifyPlayer />` mounted unconditionally alongside `WebPlayer`/`MpvPlayer`:
   ```tsx
   {playbackType === PlayerType.WEB && <WebPlayer />}
   {playbackType === PlayerType.LOCAL && <MpvPlayer />}
   <SpotifyPlayer />
   ```

3. **Timestamp isolation** — `mpv-player.tsx` and `web-player.tsx` skip the 500ms `setTimestamp` interval when `currentSong._serverType === ServerType.SPOTIFY`. This prevents the native players (which have nothing playing) from resetting position to 0 every half-second.

4. **Track end** — librespot `end_of_track` event → `usePlayerStoreBase.getState().mediaNext()`. Works for both Spotify→Spotify and Spotify→Library transitions.

5. **Seek** — `SpotifyPlayer` subscribes to `player.seekToTimestamp` changes via `usePlayerStoreBase.subscribe()` → calls `seekToPosition(deviceId, positionMs)`.

6. **`use-update-current-song.ts`** — early return for `ServerType.SPOTIFY` (no `getSongDetail` API route; all metadata is already in the `Song` object from normalization).

7. **`fetchLocalLyrics`** — returns `null` instead of throwing when `getServerById` returns null (Spotify's `__spotify__` ID is not in the music server list). Remote lyrics still fetched and displayed.

---

### 4.7 Search Interface

Route: `/spotify/search`

- Text input with `useDeferredValue` for debounce
- Minimum 2 characters to trigger search
- React Query with `staleTime: 5 * 60 * 1000`
- Track results shown in `SpotifyTrackList` (play now / play next / add to queue actions)
- Clear button in search field

---

### 4.8 Routing & Navigation

#### Implemented Routes

```typescript
// src/renderer/router/routes.ts

enum AppRoute {
  SPOTIFY = '/spotify',
  SPOTIFY_PLAYLIST_DETAIL = '/spotify/playlists/:playlistId',
  SPOTIFY_SEARCH = '/spotify/search',
  // SPOTIFY_CALLBACK handled by the Electron main process / loopback server
}
```

#### Sidebar

Spotify section added below existing navigation. Rendered conditionally — always visible in the sidebar with a Connect CTA if not authenticated.

---

## 5. File Structure

```
src/
├── renderer/
│   ├── api/
│   │   └── spotify/
│   │       └── spotify-normalize.ts         ✅ Track + Playlist + PlaylistTrack normalizers
│   ├── features/
│   │   └── spotify/
│   │       ├── api/
│   │       │   ├── spotify-auth.ts          ✅ PKCE, token exchange, refresh, getValidSpotifyToken
│   │       │   ├── spotify-api-client.ts    ✅ Web API client (playback + catalog)
│   │       │   └── spotify-types.ts         ✅ SpotifyTrack, SpotifyPlaylist, SpotifyPaging, etc.
│   │       ├── components/
│   │       │   ├── spotify-connect-button.tsx  ✅ OAuth login/logout
│   │       │   └── spotify-track-list.tsx      ✅ Track list with play/queue actions
│   │       ├── hooks/
│   │       │   ├── use-spotify-playlists.ts    ✅ Paginated user playlists + playlist detail
│   │       │   └── use-spotify-search.ts       ✅ Catalog search
│   │       ├── player/
│   │       │   ├── spotify-player.tsx          ✅ Headless playback coordinator
│   │       │   ├── spotify-sdk-loader.ts       ✅ (file exists, not used — librespot used instead)
│   │       │   └── use-spotify-pcm-player.ts   ✅ Web Audio PCM scheduler
│   │       ├── routes/
│   │       │   ├── spotify-home.tsx             ✅ Playlist list
│   │       │   ├── spotify-playlist-detail.tsx  ✅ Playlist track list
│   │       │   └── spotify-search.tsx           ✅ Catalog search UI
│   │       └── store/
│   │           ├── spotify-auth.store.ts        ✅ Tokens + user profile (persisted)
│   │           └── spotify-playback.store.ts    ✅ Device ID + ready state (transient)
│   └── features/
│       └── player/
│           ├── audio-player/
│           │   ├── mpv-player.tsx               ✅ Skip timestamp for Spotify songs
│           │   └── web-player.tsx               ✅ Skip timestamp for Spotify songs
│           ├── components/
│           │   └── audio-players.tsx            ✅ Mounts <SpotifyPlayer />
│           └── hooks/
│               └── use-update-current-song.ts   ✅ Early return for Spotify
├── shared/
│   └── types/
│       └── domain-types.ts                      ✅ ServerType.SPOTIFY added
├── main/
│   └── features/
│       └── core/
│           └── spotify/
│               ├── index.ts                     ✅ IPC handlers, PCM forwarding
│               └── librespot-player.ts          ✅ LibrespotPlayer class
└── preload/
    └── utils.ts                                 ✅ librespotInit/Stop/Volume/DeviceId,
                                                    librespotOnReady/Event/Error/Pcm/VolumeChange
```

**Not implemented (vs. original plan):**
- `src/renderer/api/spotify/spotify-controller.ts` — Spotify does not go through the ControllerEndpoint dispatch
- `src/renderer/api/spotify/spotify-types.ts` — types live under `features/spotify/api/`
- `src/main/features/core/spotify/protocol-handler.ts` — OAuth handling is in `index.ts`
- `src/preload/spotify.ts` — IPC bridge lives in `preload/utils.ts`

---

## 6. Data Flow Diagrams

### OAuth Authentication

```
User clicks "Connect Spotify"
       │
       ▼
Generate PKCE code_verifier + code_challenge
       │
       ▼
Open accounts.spotify.com/authorize?... in browser
       │
       ▼
User approves → Redirect to feishin://spotify/callback?code=XXX
                         (or http://127.0.0.1:27042/spotify/callback in dev)
       │
       ▼
Electron intercepts deep link / loopback HTTP server
       │
       ▼
IPC → Renderer: 'spotify-auth-code' with auth code
       │
       ▼
Exchange code for tokens: POST accounts.spotify.com/api/token
       │
       ▼
Store access_token + refresh_token in spotify-auth.store (persisted)
       │
       ▼
Fetch /me → verify isPremium, save user profile
       │
       ▼
librespotInit(accessToken) → LibrespotPlayer.init()
       │
       ▼
librespot creates Spotify Connect device (40-char hex ID)
       │
       ▼
IPC 'librespot-ready' → SpotifyPlaybackStore.setDeviceReady(deviceId)
       │
       ▼
Ready for playback
```

### Playing a Spotify Song from Queue

```
User clicks play on Spotify track
       │
       ▼
normalizeSpotifyTrack(track) → Song { _serverType: SPOTIFY, duration: track.duration_ms }
       │
       ▼
playerStore.addToQueueByData([song], Play.NOW)
       │
       ▼
Queue updated → currentSong changes → playerStatus = PLAYING
       │
       ▼
useSongUrl detects _serverType === SPOTIFY → returns { url: null }
       │
       ▼
WebPlayer/MpvPlayer has no src → idle
MpvPlayer/WebPlayer timestamp intervals skip Spotify songs
       │
       ▼
SpotifyPlayer effect fires (currentSong.id changed, isReady, deviceId present):
  hasIssuedPlayRef = true
  spotifyApiClient.play(deviceId, ['spotify:track:{id}'])
       │
       ▼
Spotify Web API → librespot Connect device receives URI
       │
       ▼
librespot streams PCM via IPC 'librespot-pcm'
       │
       ▼
useSpotifyPcmPlayer schedules AudioBufferSourceNodes gaplessly
  → Web Audio → speakers
  → webAudio.gains[0] → visualizer
       │
       ▼
librespot 'playing' event → positionRef updated → setTimestamp()
Spotify Web API polling (1s) → setTimestamp() for progress bar
       │
       ▼
librespot 'end_of_track' → mediaNext()
```

### Queue Transition: Spotify → Library

```
Spotify track ends
       │
       ▼
librespot fires 'end_of_track' event
       │
       ▼
SpotifyPlayer: usePlayerStoreBase.getState().mediaNext()
       │
       ▼
Queue advances → currentSong._serverType = NAVIDROME
       │
       ▼
useSongUrl resolves stream URL from Navidrome
WebPlayer/MpvPlayer receives src → starts playback
       │
       ▼
SpotifyPlayer: play/resume/pause effects skip — isSpotifySong = false
useSpotifyPcmPlayer: still subscribed but no new PCM arrives
```

---

## 7. Migration & Compatibility Concerns

### Existing Queue Persistence
The queue persists to IndexedDB. Spotify songs in a persisted queue carry `_serverType: 'spotify'`. On app restart:
- If Spotify still authenticated → `librespotInit()` called on re-auth, device re-registers, songs are playable
- If token expired → `getValidSpotifyToken()` triggers refresh automatically
- If user disconnected Spotify → Spotify songs in queue show metadata but fail to play gracefully (error logged, queue advances)

### Multi-Server Awareness

Code paths updated for Spotify compatibility:
- **useSongUrl** — early return for Spotify
- **use-update-current-song** — early return for Spotify
- **fetchLocalLyrics** — returns `null` rather than throwing for unknown server ID
- **mpv-player / web-player** — skip timestamp interval for Spotify songs

Code paths **not yet updated** (Phase 2):
- **Discord RPC** — `use-discord-rpc.ts` should add `ServerType.SPOTIFY` branch (track metadata available directly on `Song` object)
- **Scrobbling** — `use-scrobble.ts` should skip for Spotify songs (Spotify handles its own Last.fm scrobbling)

### Native Addon (`@lox-audioserver/node-librespot`)
- Prebuilt `.node` file at `prebuilds/win32-x64-msvc/librespot_addon.node`
- Must be re-copied after `pnpm install` if installing a custom build:
  ```powershell
  $dst = ".\node_modules\.pnpm\@lox-audioserver+node-librespot@0.3.4\node_modules\@lox-audioserver\node-librespot"
  Copy-Item "E:\dev\node-librespot-src\target\release\librespot_addon.dll" "$dst\prebuilds\win32-x64-msvc\librespot_addon.node" -Force
  ```
- Loaded via `require()` at runtime in `librespot-player.ts` to prevent bundler issues

### Premium Requirement
Spotify Connect + librespot require a Spotify Premium subscription. The app:
1. Checks `user.product === 'premium'` after OAuth via `useSpotifyIsPremium()`
2. `useSpotifyPcmPlayer` and `SpotifyPlayer` init are gated behind `isPremium`
3. Browse (playlists, search) works for all subscribers — playback requires Premium

### Rate Limiting
- Playlist lists: `staleTime: 5 * 60 * 1000`
- Playlist tracks: `staleTime: 10 * 60 * 1000`
- Search: `staleTime: 5 * 60 * 1000`
- Single retry on 401 (token refresh); 429s are not yet explicitly handled (React Query's default retry)

---

## 8. Security Considerations

- **No client secret in renderer**: PKCE flow eliminates the need to embed a client secret. `SPOTIFY_CLIENT_ID` is public and safe to ship.
- **Token storage**: Access and refresh tokens stored in Zustand persist (IndexedDB). On Electron, within the app's user data directory — acceptable for a desktop app. Tokens are never logged.
- **Token refresh**: `getValidSpotifyToken()` refreshes if within 60s of expiry. `SpotifyApiClient` retries once on 401.
- **CORS**: Spotify API calls from the Electron renderer work without CORS issues. Web build may require a proxy.
- **librespot client ID**: `undefined` is passed as `clientId` to `startConnectDeviceWithToken`, causing librespot to use its built-in Spotify client ID. This ID is approved for Connect API access; custom app IDs are not (causes `400 Bad Request`).
- **Scopes**: Minimum required scopes requested. `user-modify-playback-state` required for play/pause/seek via Web API → librespot Connect device.

---

## 9. Future Phases

### Phase 2 — Seamless Experience
- **Unified search**: Single search bar queries both library and Spotify simultaneously, results merged and deduplicated
- **Discord RPC**: Add `ServerType.SPOTIFY` branch — use track metadata directly (no API call needed)
- **Scrobbling skip**: Add `ServerType.SPOTIFY` check in `use-scrobble.ts` to prevent double-scrobbling
- **Spotify favorites**: Like/unlike Spotify tracks from Feishin, sync favorite state
- **Album & Artist views**: Full Spotify album/artist browsing with detail pages
- **429 rate limit handling**: Exponential backoff on Spotify API rate limit responses
- **Crossfade**: Handle crossfade transitions at Spotify ↔ library queue boundaries

### Phase 3 — Deep Integration
- **Duplicate detection**: Match Spotify tracks to local library copies, prefer local playback for quality
- **Playlist sync**: Import Spotify playlists as local playlists (download metadata, match tracks)
- **Spotify Connect multi-device**: Show Feishin as a selectable Connect device from Spotify mobile
- **Queue persistence on reconnect**: Spotify songs resume correctly after token refresh on app restart

### Phase 4 — Power Features
- **Smart playlists**: Dynamic playlists mixing Spotify and library tracks based on rules
- **Recommendation engine**: Spotify recommendations API to complement library queue
- **Audio features**: Leverage Spotify's audio analysis (tempo, energy, danceability) for smart queue ordering


---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Codebase Integration Points](#2-codebase-integration-points)
3. [Phase 1 Feature Scope](#3-phase-1-feature-scope)
4. [Implementation Details](#4-implementation-details)
   - 4.1 [Spotify OAuth Flow](#41-spotify-oauth-flow)
   - 4.2 [Spotify API Client & Controller](#42-spotify-api-client--controller)
   - 4.3 [Type System Extensions](#43-type-system-extensions)
   - 4.4 [Web Playback SDK Integration](#44-web-playback-sdk-integration)
   - 4.5 [Spotify Feature Module (UI)](#45-spotify-feature-module-ui)
   - 4.6 [Mixed Queue Support](#46-mixed-queue-support)
   - 4.7 [Search Interface](#47-search-interface)
   - 4.8 [Routing & Navigation](#48-routing--navigation)
5. [File Structure](#5-file-structure)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [Migration & Compatibility Concerns](#7-migration--compatibility-concerns)
8. [Security Considerations](#8-security-considerations)
9. [Future Phases](#9-future-phases)

---

## 1. Architecture Overview

Feishin uses a **controller pattern** to abstract multiple server backends (Navidrome, Jellyfin, Subsonic) behind a unified `ControllerEndpoint` interface. Each server type has its own controller implementation, normalizer (server response → domain types), and authentication flow. The player consumes songs through a `useSongUrl` hook that resolves stream URLs per server type, and playback is handled by a dual `ReactPlayer` engine (WebPlayer) or native MPV.

Spotify integration must work **alongside** existing backends rather than replacing them. The key insight: Spotify cannot provide direct audio stream URLs — it requires the **Web Playback SDK** for playback control. This means Spotify is not just another "server" in the traditional sense; it's a **hybrid** — metadata comes from the Spotify Web API, but playback is delegated to the Spotify SDK player instance.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Feishin Renderer                       │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ Navidrome │  │ Jellyfin │  │  Spotify               │ │
│  │ Controller│  │Controller│  │  Controller             │ │
│  │  (REST)   │  │  (REST)  │  │  (Web API + OAuth)     │ │
│  └─────┬─────┘  └────┬─────┘  └────────────┬───────────┘ │
│        │              │                      │             │
│        ▼              ▼                      ▼             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Unified Queue (player.store)            │  │
│  │    QueueSong[] — mixed _serverType per song          │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                  │
│            ┌────────────┴────────────┐                    │
│            ▼                         ▼                    │
│  ┌──────────────────┐    ┌────────────────────────┐      │
│  │   WebPlayer       │    │  SpotifyPlayer          │      │
│  │   (ReactPlayer)   │    │  (Web Playback SDK)     │      │
│  │   Handles library │    │  Handles Spotify songs  │      │
│  │   songs           │    │                          │      │
│  └──────────────────┘    └────────────────────────┘      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Codebase Integration Points

These are the existing files and systems that Spotify integration touches:

| Area | Key Files | What Changes |
|------|-----------|--------------|
| **Server Types** | `src/shared/types/domain-types.ts` | Add `ServerType.SPOTIFY` enum value |
| **Song Type** | `src/shared/types/domain-types.ts` | No structural changes — Spotify songs normalize to existing `Song` type |
| **API Controller** | `src/renderer/api/controller.ts` | Register `spotify` in `ApiController` dispatch map |
| **Stream URL Hook** | `src/renderer/features/player/audio-player/hooks/use-stream-url.tsx` | Detect `_serverType === SPOTIFY`, skip URL resolution (SDK handles playback) |
| **Audio Players** | `src/renderer/features/player/components/audio-players.tsx` | Mount `SpotifyPlayer` component alongside `WebPlayer` |
| **Web Player** | `src/renderer/features/player/audio-player/web-player.tsx` | Skip playback for Spotify songs (delegate to SpotifyPlayer) |
| **Player Store** | `src/renderer/store/player.store.ts` | No structural changes — queue already supports mixed `_serverId` |
| **Auth Store** | `src/renderer/store/auth.store.ts` | Add Spotify-specific auth state (tokens, expiry) or create dedicated store |
| **Router** | `src/renderer/router/routes.ts`, `app-router.tsx` | Add Spotify tab routes |
| **Sidebar** | `src/renderer/features/sidebar/` | Add Spotify navigation entry |
| **Features** | `src/renderer/features/` | New `spotify/` feature module |
| **Settings** | `src/renderer/store/settings.store.ts` | Spotify-related preferences |
| **Discord RPC** | `src/renderer/features/discord-rpc/use-discord-rpc.ts` | Handle `_serverType === SPOTIFY` branch |

---

## 3. Phase 1 Feature Scope

### In Scope
- **Spotify OAuth 2.0 PKCE** login/logout (no client secret required in renderer)
- **Browse saved playlists** from the connected Spotify account
- **View playlist tracks** with metadata (title, artist, album, artwork)
- **Search Spotify catalog** (tracks, artists, albums) with basic UI
- **Playback via Web Playback SDK** — play, pause, skip, seek, volume
- **Mixed queue** — add Spotify tracks alongside Navidrome/Subsonic songs in the unified queue
- **Spotify tab** in sidebar for browsing Spotify content separately
- **Token refresh** — automatic access token renewal
- **Album art** for Spotify songs in queue/now-playing

### Out of Scope (Future Phases)
- Unified search across Spotify + library simultaneously
- Spotify song matching with local library duplicates
- Crossfade between Spotify ↔ library tracks
- Saving Spotify tracks to local library
- Spotify Connect (controlling other devices)
- Liking/saving Spotify tracks from Feishin
- Lyrics from Spotify

---

## 4. Implementation Details

### 4.1 Spotify OAuth Flow

**OAuth 2.0 Authorization Code with PKCE** — required for client-side apps without a backend secret.

#### Spotify Developer Setup
- Register app at https://developer.spotify.com/dashboard
- Set redirect URI: `feishin://spotify/callback` (Electron deep link) or `http://localhost:PORT/spotify/callback` (loopback for web)
- Required scopes:
  ```
  user-read-private
  user-read-email
  playlist-read-private
  playlist-read-collaborative
  streaming
  user-library-read
  user-read-playback-state
  user-modify-playback-state
  ```

#### Auth Flow (Electron)

1. Generate PKCE `code_verifier` (random 128-char string) and `code_challenge` (S256 hash)
2. Open Spotify auth URL in external browser or BrowserWindow:
   ```
   https://accounts.spotify.com/authorize?
     client_id={CLIENT_ID}
     &response_type=code
     &redirect_uri={REDIRECT_URI}
     &scope={SCOPES}
     &code_challenge_method=S256
     &code_challenge={CODE_CHALLENGE}
   ```
3. Intercept redirect via Electron `protocol.handle` or deep link handler
4. Exchange authorization code for tokens:
   ```
   POST https://accounts.spotify.com/api/token
   grant_type=authorization_code
   &code={AUTH_CODE}
   &redirect_uri={REDIRECT_URI}
   &client_id={CLIENT_ID}
   &code_verifier={CODE_VERIFIER}
   ```
5. Store `access_token`, `refresh_token`, `expires_in` in Zustand store (persisted)
6. Set up automatic refresh timer

#### Token Refresh
```
POST https://accounts.spotify.com/api/token
grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
&client_id={CLIENT_ID}
```

#### New Files
- `src/renderer/features/spotify/api/spotify-auth.ts` — PKCE helpers, token exchange, refresh logic
- `src/renderer/store/spotify-auth.store.ts` — Zustand store for Spotify tokens
- `src/main/features/core/spotify/` — Electron-side deep link / protocol handler

#### Electron Main Process (Deep Link)

Register custom protocol handler in `src/main/index.ts`:
```typescript
// Register feishin:// protocol for OAuth callback
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('feishin');
} else {
  app.setAsDefaultProtocolClient('feishin', process.execPath, [path.resolve(process.argv[1])]);
}

// Handle the callback URL
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('feishin://spotify/callback')) {
    mainWindow?.webContents.send('spotify-auth-callback', url);
  }
});
```

For Windows, handle via `second-instance` event since `open-url` is macOS-only:
```typescript
app.on('second-instance', (event, argv) => {
  const url = argv.find(arg => arg.startsWith('feishin://spotify/callback'));
  if (url) {
    mainWindow?.webContents.send('spotify-auth-callback', url);
  }
});
```

---

### 4.2 Spotify API Client & Controller

#### API Client

Thin wrapper over Spotify Web API with automatic token injection and refresh:

```typescript
// src/renderer/api/spotify/spotify-api-client.ts

class SpotifyApiClient {
  private baseUrl = 'https://api.spotify.com/v1';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = useSpotifyAuthStore.getState().accessToken;
    if (!token) throw new Error('Spotify not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (response.status === 401) {
      await refreshSpotifyToken();
      return this.request<T>(endpoint, options); // Retry once
    }

    if (!response.ok) throw new SpotifyApiError(response);
    return response.json();
  }

  // Playlist endpoints
  getUserPlaylists(limit = 50, offset = 0) { ... }
  getPlaylistTracks(playlistId: string, limit = 100, offset = 0) { ... }

  // Search
  search(query: string, types: string[], limit = 20, offset = 0) { ... }

  // Player state (for SDK coordination)
  getPlaybackState() { ... }
  getCurrentUser() { ... }

  // Library
  getUserSavedTracks(limit = 50, offset = 0) { ... }
  getUserSavedAlbums(limit = 50, offset = 0) { ... }
}
```

#### Spotify Controller

Implement a subset of the `ControllerEndpoint` interface — only the methods relevant for Phase 1:

```typescript
// src/renderer/api/spotify/spotify-controller.ts

const spotifyController: Partial<ControllerEndpoint> = {
  getPlaylistList: async ({ query }) => { ... },
  getPlaylistDetail: async ({ query }) => { ... },
  getPlaylistSongList: async ({ query }) => { ... },
  search: async ({ query }) => { ... },
  getStreamUrl: async ({ query }) => {
    // Return spotify: URI instead of HTTP URL
    // The SpotifyPlayer component will use this to play via SDK
    return `spotify:track:${query.id}`;
  },
  getImageUrl: ({ query }) => {
    // Spotify image URLs are direct HTTPS — return as-is
    return query.imageUrl;
  },
};
```

#### Normalizer

Convert Spotify API responses to Feishin domain types:

```typescript
// src/renderer/api/spotify/spotify-normalize.ts

const SPOTIFY_SERVER_ID = '__spotify__';

const normalizeSong = (track: SpotifyApi.TrackObject): Song => ({
  _itemType: LibraryItem.SONG,
  _serverId: SPOTIFY_SERVER_ID,
  _serverType: ServerType.SPOTIFY,
  id: track.id,
  name: track.name,
  albumId: track.album.id,
  album: track.album.name,
  artistName: track.artists.map(a => a.name).join(', '),
  artists: track.artists.map(a => ({
    id: a.id,
    name: a.name,
    imageUrl: null,
    imageId: null,
    userFavorite: false,
    userRating: null,
  })),
  albumArtistName: track.album.artists?.[0]?.name ?? '',
  albumArtists: track.album.artists?.map(a => ({
    id: a.id,
    name: a.name,
    imageUrl: null,
    imageId: null,
    userFavorite: false,
    userRating: null,
  })) ?? [],
  duration: track.duration_ms / 1000,
  trackNumber: track.track_number,
  discNumber: track.disc_number,
  releaseYear: track.album.release_date
    ? parseInt(track.album.release_date.substring(0, 4), 10)
    : null,
  releaseDate: track.album.release_date ?? null,
  imageUrl: track.album.images?.[0]?.url ?? null,
  imageId: null,
  bitRate: 0,
  channels: null,
  bitDepth: null,
  sampleRate: null,
  container: 'ogg',  // Spotify uses Ogg Vorbis
  playCount: 0,
  userFavorite: false,
  userRating: null,
  createdAt: '',
  updatedAt: '',
  lastPlayedAt: null,
  genres: [],
  tags: null,
  mbzRecordingId: null,
  gain: null,
  lyrics: null,
  comment: null,
});

const normalizePlaylist = (playlist: SpotifyApi.PlaylistObject): Playlist => ({
  _itemType: LibraryItem.PLAYLIST,
  id: playlist.id,
  name: playlist.name,
  description: playlist.description,
  songCount: playlist.tracks.total,
  duration: null,
  owner: playlist.owner.display_name,
  ownerId: playlist.owner.id,
  public: playlist.public,
  imageUrl: playlist.images?.[0]?.url ?? null,
  _serverId: SPOTIFY_SERVER_ID,
  _serverType: ServerType.SPOTIFY,
});
```

---

### 4.3 Type System Extensions

#### ServerType Enum

```diff
// src/shared/types/domain-types.ts

enum ServerType {
  JELLYFIN = 'jellyfin',
  NAVIDROME = 'navidrome',
  SUBSONIC = 'subsonic',
+ SPOTIFY = 'spotify',
}
```

#### ServerFeature Additions (optional, for capability gating)

```diff
enum ServerFeature {
  // ... existing features
+ SPOTIFY_PLAYBACK,
+ SPOTIFY_SEARCH,
+ SPOTIFY_PLAYLISTS,
}
```

#### Spotify-Specific Types

```typescript
// src/renderer/api/spotify/spotify-types.ts

interface SpotifyAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;  // Unix timestamp
  user: SpotifyUserProfile | null;
  isAuthenticated: boolean;
  isPremium: boolean;  // Web Playback SDK requires Premium
}

interface SpotifyUserProfile {
  id: string;
  displayName: string;
  email: string;
  imageUrl: string | null;
  product: 'premium' | 'free' | 'open';
}

interface SpotifyPlaybackState {
  deviceId: string | null;     // Web Playback SDK device ID
  isReady: boolean;
  isActive: boolean;
  position: number;            // Current position in ms
  duration: number;
  volume: number;
}
```

---

### 4.4 Web Playback SDK Integration

The Spotify Web Playback SDK is a JavaScript library that creates a virtual Spotify Connect device in the browser. It handles all DRM, streaming, and codec decoding internally — we just send it Spotify URIs and control play/pause/seek/volume.

#### SDK Loading

```typescript
// src/renderer/features/spotify/player/spotify-sdk-loader.ts

export function loadSpotifySDK(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Spotify) return resolve();

    window.onSpotifyWebPlaybackSDKReady = () => resolve();

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
  });
}
```

#### SpotifyPlayer Component

This component lives alongside `WebPlayer` and handles playback for songs where `_serverType === 'spotify'`:

```typescript
// src/renderer/features/spotify/player/spotify-player.tsx

export function SpotifyPlayer() {
  const playerRef = useRef<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const currentSong = useCurrentSong();
  const playerStatus = usePlayerStatus();
  const volume = useVolume();

  // Initialize SDK player on mount
  useEffect(() => {
    const initPlayer = async () => {
      await loadSpotifySDK();

      const player = new window.Spotify.Player({
        name: 'Feishin',
        getOAuthToken: async (cb) => {
          const token = await getValidSpotifyToken();
          cb(token);
        },
        volume: volume / 100,
      });

      player.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id);
        useSpotifyPlaybackStore.setState({ deviceId: device_id, isReady: true });
      });

      player.addListener('player_state_changed', (state) => {
        // Sync SDK state → Feishin player store
        // Handle track end → trigger next in queue
      });

      player.connect();
      playerRef.current = player;
    };

    initPlayer();
    return () => { playerRef.current?.disconnect(); };
  }, []);

  // React to queue changes — when current song is Spotify, play via SDK
  useEffect(() => {
    if (!currentSong || currentSong._serverType !== ServerType.SPOTIFY) return;
    if (!deviceId) return;

    // Transfer playback to this device and play the track
    spotifyApi.play(deviceId, [`spotify:track:${currentSong.id}`]);
  }, [currentSong?.id, currentSong?._serverType, deviceId]);

  // Sync play/pause state
  useEffect(() => {
    if (currentSong?._serverType !== ServerType.SPOTIFY) return;
    if (playerStatus === PlayerStatus.PLAYING) {
      playerRef.current?.resume();
    } else if (playerStatus === PlayerStatus.PAUSED) {
      playerRef.current?.pause();
    }
  }, [playerStatus, currentSong?._serverType]);

  // Sync volume
  useEffect(() => {
    playerRef.current?.setVolume(volume / 100);
  }, [volume]);

  return null; // No visible UI — playback only
}
```

#### Player Coordination Logic

The critical challenge: **when the queue transitions between a library song and a Spotify song (or vice versa), one player must stop and the other must start**.

```
Queue: [Library Song A] → [Spotify Song B] → [Library Song C]
                          ↑
                    Transition point:
                    1. WebPlayer stops
                    2. SpotifyPlayer starts playing Song B
                    3. On Song B end → SpotifyPlayer stops
                    4. WebPlayer starts Song C
```

This coordination happens in a new hook:

```typescript
// src/renderer/features/player/hooks/use-player-routing.ts

export function usePlayerRouting() {
  const currentSong = useCurrentSong();
  const previousSongType = useRef<ServerType | null>(null);

  useEffect(() => {
    const currentType = currentSong?._serverType ?? null;
    const prevType = previousSongType.current;

    if (prevType !== currentType) {
      // Transition between player engines
      if (prevType === ServerType.SPOTIFY) {
        // Stop Spotify SDK playback
        spotifyPlayerRef.current?.pause();
      } else if (prevType && currentType === ServerType.SPOTIFY) {
        // Stop WebPlayer (set its src to null or pause)
        // WebPlayer will naturally stop when useSongUrl returns null for Spotify songs
      }
    }

    previousSongType.current = currentType;
  }, [currentSong]);
}
```

#### Modifications to useSongUrl

```typescript
// src/renderer/features/player/audio-player/hooks/use-stream-url.tsx

// Add early return for Spotify songs — WebPlayer should not attempt to get a URL
if (song?._serverType === ServerType.SPOTIFY) {
  return { url: null, isLoading: false };
  // SpotifyPlayer component handles playback for these songs
}
```

---

### 4.5 Spotify Feature Module (UI)

#### Spotify Tab — Playlists View

```
src/renderer/features/spotify/
├── routes/
│   ├── spotify-home.tsx              # Main Spotify tab — shows playlists grid
│   ├── spotify-playlist-detail.tsx   # Playlist detail with track list
│   └── spotify-search.tsx            # Spotify search interface
├── components/
│   ├── spotify-connect-button.tsx    # OAuth login/disconnect button
│   ├── spotify-playlist-card.tsx     # Playlist thumbnail card
│   ├── spotify-track-list.tsx        # Track list with play/queue actions
│   └── spotify-search-bar.tsx        # Search input with type selector
├── api/
│   ├── spotify-auth.ts              # OAuth PKCE flow
│   ├── spotify-api-client.ts        # Web API wrapper
│   ├── spotify-controller.ts        # ControllerEndpoint implementation
│   ├── spotify-normalize.ts         # Response → domain type normalization
│   └── spotify-types.ts             # Spotify-specific TypeScript types
├── hooks/
│   ├── use-spotify-playlists.ts     # React Query hook for user playlists
│   ├── use-spotify-search.ts        # React Query hook for search
│   └── use-spotify-playback.ts      # Hook for SDK playback state
├── player/
│   ├── spotify-sdk-loader.ts        # Dynamic SDK script loading
│   └── spotify-player.tsx           # Web Playback SDK component
└── store/
    ├── spotify-auth.store.ts        # Token & user state (persisted)
    └── spotify-playback.store.ts    # SDK device state (transient)
```

#### Spotify Home Page

Shows a grid of the user's saved Spotify playlists. Clicking a playlist navigates to the detail view. A "Connect Spotify" button appears if not authenticated.

Layout mirrors the existing Playlists page (`src/renderer/features/playlists/`) with the same grid/table components from Mantine, reusing `VirtualGridAutoSizerContainer` or `VirtualTable` patterns.

#### Spotify Playlist Detail

Shows playlist metadata (name, description, cover art, owner) and a scrollable track list. Each track row has:
- Play button (replaces queue with this playlist starting at clicked track)
- Add to queue (next / last)
- Track number, title, artist, album, duration

#### Spotify Search

Simple search bar with results displayed in sections: Tracks, Albums, Artists (tracks only are actionable in Phase 1). Uses debounced input with React Query for caching.

---

### 4.6 Mixed Queue Support

The existing queue system in `player.store.ts` stores `QueueSong` objects keyed by `_uniqueId` in a flat dictionary. Each song already carries `_serverId` and `_serverType`. **The queue data structure itself is already compatible with mixed sources.**

#### What Needs To Change

1. **`useSongUrl` hook** — must gracefully handle `_serverType === SPOTIFY` by returning null (SpotifyPlayer handles playback independently).

2. **`audio-players.tsx`** — mount `SpotifyPlayer` alongside existing `WebPlayer`:
   ```tsx
   <WebPlayer ... />
   <SpotifyPlayer />   {/* New: handles Spotify songs in queue */}
   ```

3. **`web-player.tsx`** — when the current song is Spotify, WebPlayer should be idle (no src). The `useSongUrl` returning null achieves this naturally.

4. **Track end detection** — SpotifyPlayer must listen for the `player_state_changed` event from the SDK and trigger `mediaNext()` on the player store when a Spotify track finishes. This advances the queue regardless of whether the next song is Spotify or library.

5. **Seek, volume, play/pause** — the player store actions (`mediaPlay`, `mediaPause`, `setVolume`, `mediaSeekToTimestamp`) must be extended to also command the Spotify SDK when the current song is a Spotify track. This can be done via:
   - A `useEffect` in `SpotifyPlayer` that watches the player store state and relays to SDK, **or**
   - A middleware/subscriber on the Zustand store that detects Spotify songs and calls SDK methods

   The `useEffect` approach is simpler and recommended for Phase 1.

6. **Timestamp/progress** — SpotifyPlayer must feed playback position back to `useTimestampStoreBase` so the progress bar, lyrics sync, and seek bar work correctly. The SDK's `player_state_changed` event provides `position` — push it on an interval:
   ```typescript
   setInterval(async () => {
     const state = await player.getCurrentState();
     if (state) {
       useTimestampStore.setState({ currentTime: state.position / 1000 });
     }
   }, 500);
   ```

7. **Context menu actions** — "Add to queue", "Play next", "Play last" on Spotify tracks should call the same `addToQueueByType` actions with Spotify-normalized `Song` objects. No changes needed in the queue store itself.

---

### 4.7 Search Interface

#### Search Page (`/spotify/search`)

```
┌─────────────────────────────────────────────┐
│  🔍 [Search Spotify...                    ] │
│     ○ Tracks  ○ Albums  ○ Artists           │
├─────────────────────────────────────────────┤
│                                             │
│  Tracks                                     │
│  ┌─────┬──────────────┬────────┬──────────┐│
│  │  #  │ Title        │ Artist │ Duration ││
│  ├─────┼──────────────┼────────┼──────────┤│
│  │  1  │ Song Name    │ Artist │ 3:45     ││
│  │  2  │ Another Song │ Band   │ 4:12     ││
│  │ ... │              │        │          ││
│  └─────┴──────────────┴────────┴──────────┘│
│                                             │
│  Albums (click to expand tracks)            │
│  ┌────────────────────────────────────────┐ │
│  │ [Cover] Album Title — Artist Name      │ │
│  │ [Cover] Album Title — Artist Name      │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

#### API Usage

```
GET https://api.spotify.com/v1/search?q={query}&type=track,album,artist&limit=20&offset=0
```

- Debounce input by 300ms
- Cache results with React Query (staleTime: 5 min)
- Paginate with "Load more" or infinite scroll
- Track results are directly playable / queueable
- Album results expand to show tracks on click (Phase 1: navigate to album detail or inline expand)

---

### 4.8 Routing & Navigation

#### New Routes

```typescript
// Additions to src/renderer/router/routes.ts

enum AppRoute {
  // ... existing routes
  SPOTIFY = '/spotify',
  SPOTIFY_PLAYLISTS = '/spotify/playlists',
  SPOTIFY_PLAYLIST_DETAIL = '/spotify/playlists/:playlistId',
  SPOTIFY_SEARCH = '/spotify/search',
  SPOTIFY_CALLBACK = '/spotify/callback',  // OAuth redirect (web mode)
}
```

#### Sidebar Addition

Add a "Spotify" section in the sidebar below existing navigation. Only visible when Spotify is connected (or shows "Connect" CTA).

```
📚 Library
  Albums
  Artists
  Songs
  Genres
  Folders
📋 Playlists
📻 Radio
── ── ── ── ── ──
🎵 Spotify            ← New section
  Playlists
  Search
```

Implementation: Modify sidebar component to conditionally render Spotify section based on `useSpotifyAuthStore.getState().isAuthenticated`.

---

## 5. File Structure

```
src/
├── renderer/
│   ├── api/
│   │   └── spotify/
│   │       ├── spotify-api-client.ts
│   │       ├── spotify-controller.ts
│   │       ├── spotify-normalize.ts
│   │       └── spotify-types.ts
│   ├── features/
│   │   └── spotify/
│   │       ├── api/
│   │       │   └── spotify-auth.ts
│   │       ├── components/
│   │       │   ├── spotify-connect-button.tsx
│   │       │   ├── spotify-playlist-card.tsx
│   │       │   ├── spotify-search-bar.tsx
│   │       │   └── spotify-track-list.tsx
│   │       ├── hooks/
│   │       │   ├── use-spotify-playlists.ts
│   │       │   ├── use-spotify-playback.ts
│   │       │   └── use-spotify-search.ts
│   │       ├── player/
│   │       │   ├── spotify-player.tsx
│   │       │   └── spotify-sdk-loader.ts
│   │       ├── routes/
│   │       │   ├── spotify-home.tsx
│   │       │   ├── spotify-playlist-detail.tsx
│   │       │   └── spotify-search.tsx
│   │       └── store/
│   │           ├── spotify-auth.store.ts
│   │           └── spotify-playback.store.ts
│   ├── router/
│   │   ├── routes.ts                 (modified)
│   │   └── app-router.tsx            (modified)
│   └── store/
│       └── (no new stores here — Spotify stores live under features/spotify/store/)
├── shared/
│   └── types/
│       └── domain-types.ts           (modified — add ServerType.SPOTIFY)
├── main/
│   └── features/
│       └── core/
│           └── spotify/
│               └── protocol-handler.ts  (deep link handler for OAuth)
└── preload/
    └── spotify.ts                     (IPC bridge for OAuth callback)
```

---

## 6. Data Flow Diagrams

### OAuth Authentication

```
User clicks "Connect Spotify"
       │
       ▼
Generate PKCE code_verifier + code_challenge
       │
       ▼
Open browser: accounts.spotify.com/authorize?...
       │
       ▼
User approves → Redirect to feishin://spotify/callback?code=XXX
       │
       ▼
Electron intercepts deep link (protocol handler)
       │
       ▼
IPC → Renderer: 'spotify-auth-callback' with auth code
       │
       ▼
Exchange code for tokens: POST accounts.spotify.com/api/token
       │
       ▼
Store access_token + refresh_token in spotify-auth.store
       │
       ▼
Fetch user profile → Verify Premium status
       │
       ▼
Initialize Web Playback SDK → Get device_id
       │
       ▼
Ready for playback
```

### Playing a Spotify Song from Queue

```
User clicks play on Spotify track in playlist
       │
       ▼
spotifyNormalize(track) → Song { _serverType: SPOTIFY }
       │
       ▼
playerStore.addToQueueByType([song], Play.REPLACE_AND_PLAY)
       │
       ▼
Queue updated, currentSong changes
       │
       ▼
useSongUrl detects _serverType === SPOTIFY → returns null
       │
       ▼
WebPlayer has no src → idle
       │
       ▼
SpotifyPlayer detects currentSong._serverType === SPOTIFY
       │
       ▼
SDK.play({ uris: ['spotify:track:{id}'] })
       │
       ▼
Audio streams from Spotify CDN via SDK
       │
       ▼
SpotifyPlayer polls position → updates timestampStore
       │
       ▼
Progress bar, seek, play/pause all work via store sync
```

### Queue Transition: Spotify → Library

```
Spotify track ends
       │
       ▼
SDK fires 'player_state_changed' with paused=true, position=0
       │
       ▼
SpotifyPlayer detects track end → calls playerStore.mediaNext()
       │
       ▼
Queue advances → next song has _serverType: NAVIDROME
       │
       ▼
useSongUrl resolves stream URL from Navidrome
       │
       ▼
WebPlayer receives src → starts playback
       │
       ▼
SpotifyPlayer detects _serverType !== SPOTIFY → idle
```

---

## 7. Migration & Compatibility Concerns

### Existing Queue Persistence
The queue is persisted to IndexedDB. Spotify songs in a persisted queue will have `_serverType: 'spotify'`. On app restart:
- If Spotify is still authenticated → songs remain playable
- If Spotify token expired → refresh token flow runs automatically
- If user disconnected Spotify → Spotify songs in queue should display a "Spotify disconnected" indicator, skip on play attempts, or be auto-removed

### Multi-Server Awareness
Several existing code paths assume a single server type. Key areas to patch:
- **Discord RPC** (`use-discord-rpc.ts`): Add `ServerType.SPOTIFY` branch — use track metadata directly (no API call needed, data is on the Song object)
- **Remote/IPC**: When sending current song info to the main process, Spotify songs should be handled gracefully (no server-side fetching)
- **Scrobbling**: Spotify handles its own scrobbling to Last.fm — do not double-scrobble. Skip `scrobble()` controller call for Spotify songs.

### Premium Requirement
Spotify Web Playback SDK **requires a Spotify Premium subscription**. The app must:
1. Check `user.product === 'premium'` after OAuth
2. Show clear messaging if Free tier — allow browsing but disable playback
3. Gate "Play" and "Add to queue" actions behind Premium check

### Rate Limiting
Spotify Web API has rate limits (varies, typically ~100 requests/30 seconds). The React Query caching layer naturally throttles redundant requests. Add:
- `staleTime: 5 * 60 * 1000` (5 min) for playlist lists
- `staleTime: 30 * 60 * 1000` (30 min) for playlist track lists (less volatile)
- Retry with exponential backoff on 429 responses

---

## 8. Security Considerations

- **No client secret in renderer**: PKCE flow eliminates the need to embed a client secret. The `client_id` is public and safe to ship.
- **Token storage**: Access and refresh tokens stored in Zustand persist (IndexedDB). On Electron, this is within the app's user data directory — acceptable risk for desktop app. Do NOT log tokens.
- **Token refresh**: Refresh tokens before expiry (refresh at `expires_at - 60s`). Handle refresh failure gracefully (re-auth prompt).
- **CORS**: Spotify API calls from the renderer work in Electron (no CORS enforcement). For the web build, may need to proxy through a backend or use Spotify's CORS-enabled endpoints.
- **CSP**: The Web Playback SDK script (`sdk.scdn.co`) must be allowed in Content Security Policy. Update Electron's CSP headers if restrictive.
- **Scopes**: Request minimum required scopes. Do not request `user-modify-playback-state` unless needed for Phase 1 (it is — needed to transfer playback to SDK device).

---

## 9. Future Phases

### Phase 2 — Seamless Experience
- **Unified search**: Single search bar queries both library and Spotify simultaneously, with results merged and deduplicated
- **Crossfade support**: Handle crossfade transitions between Spotify ↔ library songs (requires pre-buffering SDK)
- **Spotify favorites**: Like/unlike Spotify tracks from Feishin, sync favorite state
- **Album & Artist views**: Full Spotify album/artist browsing with detail pages

### Phase 3 — Deep Integration
- **Duplicate detection**: Match Spotify tracks to local library copies, prefer local playback for quality
- **Playlist sync**: Import Spotify playlists as local playlists (download metadata, match tracks)
- **Spotify Connect**: Show Feishin as a Spotify Connect device, allow controlling from Spotify mobile app
- **Queue persistence to Spotify**: Save cross-source queues such that Spotify songs resume on reconnect
- **Offline indicator**: Show which Spotify songs require internet vs. local library songs available offline

### Phase 4 — Power Features
- **Smart playlists**: Create dynamic playlists mixing Spotify and library tracks based on rules (genre, mood, BPM)
- **Recommendation engine**: Use Spotify's recommendation API to suggest tracks that complement your library
- **Lyrics from Spotify**: Use Spotify's lyrics API as an additional lyrics source
- **Audio features**: Leverage Spotify's audio analysis (tempo, energy, danceability) for smart queue ordering
