# Spotify Integration — Phase 2 Spec

> **Status**: Planning  
> **Prerequisite**: Phase 1 complete (OAuth, librespot, playlists, search, artist/album pages, PCM buffering, play controls)

---

## 1. Scope

Three user-facing features:

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Enhanced Search** | Search returns tracks, albums, artists, and playlists in tabbed results |
| 2 | **Library Save / Unsave** | Heart button on tracks, albums, artists, and playlists to save/remove from Spotify library |
| 3 | **Liked Tracks tab** | New sidebar entry — lists the user's saved tracks (`/me/tracks`) with infinite scroll |

---

## 2. Confirmed Spotify API Endpoints

All endpoints require an active OAuth access token (`Authorization: Bearer <token>`).

### 2.1 Search

```
GET /search
  ?q=<query>
  &type=track,album,artist,playlist
  &limit=20
  &offset=0
```

- `type` accepts any combination of `track`, `album`, `artist`, `playlist`
- Response contains `tracks.items`, `albums.items`, `artists.items`, `playlists.items` — all paged
- Required scope: none (public content); user-specific results need appropriate scopes
- Ref: https://developer.spotify.com/documentation/web-api/reference/search

### 2.2 Save Items to Library

```
PUT /me/library
  ?uris=spotify:track:{id},spotify:album:{id},spotify:playlist:{id},spotify:user:{id}
```

- Accepts comma-separated Spotify URIs in query param `uris` (max 40)
- Supported types for save/remove: `track`, `album`, `episode`, `show`, `audiobook`, `user`, `playlist`
- **Artists are NOT supported** by `/me/library` — use the legacy Follow endpoint (§2.4) instead
- Required scopes: `user-library-modify`, `user-follow-modify`, `playlist-modify-public`
- Returns: `200 OK`, empty body
- Ref: https://developer.spotify.com/documentation/web-api/reference/save-library-items

### 2.3 Remove Items from Library

```
DELETE /me/library
  ?uris=spotify:track:{id},spotify:album:{id},...
```

- Same URI format and type restrictions as PUT `/me/library`
- Required scopes: `user-library-modify`, `user-follow-modify`, `playlist-modify-public`
- Returns: `200 OK`, empty body
- Ref: https://developer.spotify.com/documentation/web-api/reference/remove-library-items

### 2.4 Follow / Unfollow Artist

```
PUT  /me/following?type=artist&ids={id1},{id2}
DELETE /me/following?type=artist&ids={id1},{id2}
```

- Required scope: `user-follow-modify`
- Max 50 IDs per request

### 2.5 Check Saved Items (unified, preferred)

```
GET /me/library/contains
  ?uris=spotify:track:{id},spotify:album:{id},spotify:artist:{id},spotify:playlist:{id}
```

- Returns array of booleans in the same order as the `uris` param (max 40)
- Supports `artist` URI type (even though save/remove does not — artist saved state comes from Follow)
- Required scopes: `user-library-read`, `user-follow-read`, `playlist-read-private`
- Ref: https://developer.spotify.com/documentation/web-api/reference/check-library-contains

### 2.6 Get User's Saved Tracks

```
GET /me/tracks
  ?limit=50
  &offset=0
  &market=from_token
```

- Returns paginated `SavedTrackObject[]` — each has `added_at` (ISO 8601) and `track` (full TrackObject)
- Limit range: 1–50; offset max 1000
- Required scope: `user-library-read`
- Ref: https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks

---

## 3. Required OAuth Scope Additions

The Phase 1 scope list must be extended with:

```
user-library-read
user-library-modify
user-follow-read
user-follow-modify
playlist-read-private
```

These are additive — existing tokens remain valid; users will be re-prompted on next auth.

---

## 4. Feature 1: Enhanced Search

### 4.1 Changes to `useSpotifySearch`

- Expand search query to include `type=track,album,artist,playlist`
- Return `{ songs, albums, artists, playlists, total }` instead of just `{ songs, total }`
- Add normalizers for search result shapes (albums already exist; artists need the simplified search shape)

### 4.2 Changes to `spotify-search.tsx`

- Replace flat track list with `<Tabs>` (tracks / albums / artists / playlists)
- Each tab shows an appropriate list component:
  - **Tracks** — existing `SpotifyTrackList`
  - **Albums** — grid/list of album cards (image, name, artist, year) → navigates to `SPOTIFY_ALBUM_DETAIL`
  - **Artists** — grid/list of artist cards (image, name) → navigates to `SPOTIFY_ARTIST_DETAIL`
  - **Playlists** — same card used in `spotify-home.tsx` → navigates to `SPOTIFY_PLAYLIST_DETAIL`
- Tab headers show result counts when available
- Genre grid stays visible in the default (empty query) state

### 4.3 New Types Required

`spotify-types.ts` — add `SpotifySearchArtist` (simplified artist shape returned by search, which includes `images` and `genres` unlike `SpotifySimplifiedArtist`).

The current `SpotifySearchResults` type in `spotify-types.ts` already has `artists` and `albums` paged fields — they just need to be consumed by the search hook.

---

## 5. Feature 2: Library Save / Unsave

### 5.1 API Client Methods (`spotify-api-client.ts`)

```typescript
// Save one or more items (tracks, albums, playlists, users)
saveLibraryItems(uris: string[]): Promise<void>
  // PUT /me/library?uris=...

// Remove one or more items
removeLibraryItems(uris: string[]): Promise<void>
  // DELETE /me/library?uris=...

// Check if items are saved (max 40 URIs)
checkLibraryContains(uris: string[]): Promise<boolean[]>
  // GET /me/library/contains?uris=...

// Follow artist (save)
followArtist(artistId: string): Promise<void>
  // PUT /me/following?type=artist&ids={artistId}

// Unfollow artist (unsave)
unfollowArtist(artistId: string): Promise<void>
  // DELETE /me/following?type=artist&ids={artistId}

// Check if artist is followed
checkFollowingArtist(artistId: string): Promise<boolean>
  // GET /me/following/contains?type=artist&ids={artistId}
  // Returns boolean[] — take [0]
```

### 5.2 `SpotifyLikeButton` Component

New shared component `src/renderer/features/spotify/components/spotify-like-button.tsx`:

```tsx
interface SpotifyLikeButtonProps {
  uri: string;           // full Spotify URI e.g. "spotify:track:xxx"
  isArtist?: boolean;    // use follow/unfollow instead of library endpoints
  size?: 'xs' | 'sm' | 'md';
}
```

- On mount: calls `checkLibraryContains([uri])` (or `checkFollowingArtist` for artists) to load initial saved state
- Shows a heart `ActionIcon` — filled when saved, outlined when not
- On click: optimistic toggle + API call with rollback on error
- Uses React Query `queryKey: ['spotify', 'saved', uri]` for cache invalidation

### 5.3 Placement

| Location | Component | URI type |
|----------|-----------|----------|
| `TrackRow` in `SpotifyTrackList` | after the queue buttons | `spotify:track:{id}` |
| `SpotifyAlbumDetailContent` header | next to album title | `spotify:album:{id}` |
| `SpotifyArtistDetailContent` header | next to artist name | `spotify:artist:{id}` (follow) |
| `PlaylistCard` in `spotify-home.tsx` | overlay or row end | `spotify:playlist:{id}` |
| `SpotifyPlaylistDetailContent` header | next to playlist title | `spotify:playlist:{id}` |

---

## 6. Feature 3: Liked Tracks Tab

### 6.1 New Route

```
AppRoute.SPOTIFY_LIKED_TRACKS = '/spotify/liked'
```

Sidebar entry: "Liked Songs" with a heart icon, inside the Spotify accordion.

### 6.2 New Hook `use-spotify-liked-tracks.ts`

```typescript
useSpotifyLikedTracks()
// GET /me/tracks?limit=50&offset={page * 50}
// useInfiniteQuery — keyed by ['spotify', 'liked-tracks']
// Returns Song[] pages via normalizeSpotifyTrack(item.track)
```

### 6.3 New Route File `spotify-liked-tracks.tsx`

- Header: heart icon + "Liked Songs" title + total count
- Body: `SpotifyTrackList` with `onAlbumClick` and `onArtistClick` nav callbacks
- Infinite scroll: "Load more" button (same pattern as `spotify-home.tsx`)
- Cache invalidated when `SpotifyLikeButton` saves/removes a track

---

## 7. File Changes Summary

| File | Change |
|------|--------|
| `spotify-types.ts` | Add `SpotifySearchArtist`, `SpotifySavedTrack` |
| `spotify-api-client.ts` | Add 6 new methods (§5.1) |
| `spotify-normalize.ts` | Add `normalizeSpotifySearchArtist` |
| `use-spotify-search.ts` | Expand result shape to include albums/artists/playlists |
| `spotify-search.tsx` | Replace track-only list with 4-tab layout |
| `spotify-like-button.tsx` | New component |
| `spotify-track-list.tsx` | Add `SpotifyLikeButton` to `TrackRow` |
| `spotify-album-detail.tsx` | Add `SpotifyLikeButton` to header |
| `spotify-artist-detail.tsx` | Add `SpotifyLikeButton` to header |
| `spotify-home.tsx` | Add `SpotifyLikeButton` to `PlaylistCard` |
| `spotify-playlist-detail.tsx` | Add `SpotifyLikeButton` to header |
| `use-spotify-liked-tracks.ts` | New hook |
| `spotify-liked-tracks.tsx` | New route |
| `routes.ts` | Add `SPOTIFY_LIKED_TRACKS` |
| `app-router.tsx` | Register new route |
| `sidebar.tsx` | Add "Liked Songs" sidebar item |
| `spotify-auth.ts` | Add new scopes to OAuth request |

---

## 8. API Scope Prompt Strategy

New scopes are requested at auth time. If the user already has a stored token that does not include the new scopes:
- The like/save buttons will silently fail with a 403
- On first 403, prompt the user to re-authenticate to enable saving features
- Alternatively, include all scopes from the start (preferred — avoids mid-session re-auth)

---

## 9. Open Questions

| Question | Decision |
|----------|----------|
| Should "save album" use `/me/library` or the legacy `/me/albums` endpoint? | Use modern unified `/me/library?uris=spotify:album:{id}` |
| Does `/me/library/contains` support `spotify:artist:` for check? | **Yes** — confirmed in API docs |
| Does `PUT /me/library` support `spotify:artist:` for save? | **No** — use `PUT /me/following?type=artist` instead |
| Liked tracks page: infinite scroll or virtual list? | "Load more" button for simplicity (consistent with home/playlist pages) |
| Should the liked tracks page show `added_at` date? | Yes, as a secondary line in the track row (optional, small) |
