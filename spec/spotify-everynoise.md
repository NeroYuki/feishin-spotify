# Every Noise at Once — Genre Scatter Plot Integration

> **Status**: ✅ Implemented  
> **Prerequisite**: Phase 1 complete (OAuth, librespot, playlists, search, playback)  
> **Data Source**: Local JSON files derived from Every Noise at Once

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Schema](#2-data-schema)
3. [Feature Scope](#3-feature-scope)
4. [Architecture & File Structure](#4-architecture--file-structure)
5. [Implementation Details](#5-implementation-details)
   - 5.1 [Data Loading Strategy](#51-data-loading-strategy)
   - 5.2 [Scatter Plot Canvas](#52-scatter-plot-canvas)
   - 5.3 [Genre Tooltip](#53-genre-tooltip)
   - 5.4 [Genre Detail Sidebar](#54-genre-detail-sidebar)
   - 5.5 [Preview Audio Player](#55-preview-audio-player)
   - 5.6 [Related Genres Lines](#56-related-genres-lines-deferred)
   - 5.7 [Navigation & External Links](#57-navigation--external-links)
   - 5.8 [Add to Queue Integration](#58-add-to-queue-integration)
   - 5.9 [Genre Walk Modes](#59-genre-walk-modes)
   - 5.10 [Keyboard Navigation](#510-keyboard-navigation)
6. [Routing & Sidebar Entry](#6-routing--sidebar-entry)
7. [Performance Considerations](#7-performance-considerations)
8. [UI/UX Design Notes](#8-uiux-design-notes)
9. [Design Decisions](#9-design-decisions)
10. [Bug Fixes & Implementation Notes](#10-bug-fixes--implementation-notes)

---

## 1. Overview

A full-page scatter plot visualization of ~6,435 Spotify genres, inspired by [Every Noise at Once](https://everynoise.com/). Each genre is plotted by its **organic index** (x-axis) and **atmospheric index** (y-axis), coloured by its HSV colour value, and sized by popularity. Clicking a genre opens a detail sidebar with description, top 50 artists/songs, a playable preview player, related-genre navigation, and integration with the existing Spotify queue system.

The map is rendered onto a virtual 12,000 × 5,000 world space; the screen is a viewport that can be panned and zoomed. All 6,435 genre labels render at all zoom levels (no LOD culling). Walk modes let the player automatically tour genres — either randomly across the full map or by nearest-neighbour exploration — with configurable songs-per-genre and per-song time limits.

---

## 2. Data Schema

### `data/spotify_genres.json` — 6,435 entries, ~5 MB

Each entry:

```jsonc
{
  "genre": "pop",                          // Unique genre label (display name + lookup key)
  "sample_song": "Bebe Rexha \"One in a Million\"", // Representative sample song string
  "color": [46.99, 0.959, 0.510],         // HSV triplet: H (0-360), S (0-1), V (0-1)
  "organic_index": 0.219,                 // X-axis position (0 = left/mechanical, 1 = right/organic)
  "atmospheric_index": 0.488,             // Y-axis position (0 = top/dense, 1 = bottom/atmospheric)
  "popularity": 61,                        // Popularity score (1–61), determines label size
  "preview_url": "https://p.scdn.co/...", // 30-second preview for the representative sample song
  "spotify_playlist": "https://embed.spotify.com/?uri=spotify:playlist:6gS3HhOiI17QNojjPuPzqc",
                                           // Reference playlist embed URL (contains spotify URI)
  "desc": "Pop music is a genre ...",     // Multi-sentence human description
  "related_genres": [                      // Ordered list of related genres with co-occurrence count
    { "genre": "dance pop", "count": "70" },
    { "genre": "post-teen pop", "count": "26" }
  ]
}
```

### `data/spotify_genres_artists_top50.json` — 6,435 entries, ~78 MB

Each entry contains up to 50 artist/song entries per genre:

```jsonc
{
  "genre": "pop",                          // FK → spotify_genres.json
  "artists": [
    {
      "sample_song": "Taylor Swift \"Cruel Summer\"",
      "artist": "Taylor Swift",
      "preview_url": "https://p.scdn.co/mp3-preview/...",
      "artist_id": "06HL4z0CvFAxyc27GXpf02",
      "track_id": "1lTBkwEm0wim9RsMXqtqWy"  // OPTIONAL — present on ~7,445 of ~321,750 artist entries
    }
  ]
}
```

**Note on `track_id`**: Only ~2.3% of artist entries include `track_id`. When present, it enables a direct track fetch for "Add to Queue". When absent, an optimistic search by artist name + song title is used as fallback (see §5.8). Both paths produce a fully normalized `Song` object for the queue.

---

## 3. Feature Scope

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 1 | **Scatter plot canvas** with 6,435 genre labels (pan, zoom, search-to-zoom) | P0 | ✅ |
| 2 | **Hover tooltip** — genre name, sample song, description excerpt | P0 | ✅ |
| 3 | **Genre detail sidebar** (Drawer) — full description, reference playlist, related genres | P0 | ✅ |
| 4 | **Artist/track list** in sidebar — top 50 artists loaded on-demand from artists JSON | P0 | ✅ |
| 5 | **30-second preview player** — randomly plays preview snippets, indicates current song | P0 | ✅ |
| 6 | **Related genre lines** — draw connecting lines from selected genre to its related genres | P1 | ❌ Deferred |
| 7 | **Navigate to Spotify** — open artist in-app; add track to queue | P1 | ✅ |
| 8 | **Add to queue** — add tracks to queue via librespot (direct + optimistic search fallback) | P1 | ✅ |
| 9 | **Genre search** — text input highlights matching genre, zoom-to on select | P1 | ✅ |
| 10 | **Colour legend / axis labels** — explain organic ↔ mechanical, dense ↔ atmospheric | P2 | ❌ Deferred |
| 11 | **Genre walk modes** — Random Walk / Related Walk auto-tour of genres | ➕ Added | ✅ |
| 12 | **WASD / arrow-key navigation** — move to nearest genre in a direction | ➕ Added | ✅ |
| 13 | **Overlap click cycling** — repeated click on dense area cycles overlapping genres | ➕ Added | ✅ |
| 14 | **Deselect by clicking empty canvas** — closes sidebar without pressing Esc | ➕ Added | ✅ |

---

## 4. Architecture & File Structure

### New Files

```
src/renderer/features/spotify/routes/
  spotify-everynoise.tsx              # Route page component (canvas + sidebar layout)

src/renderer/features/spotify/components/
  everynoise/
    genre-scatter-plot.tsx            # Main HTML5 Canvas scatter plot (pan/zoom/render)
    genre-scatter-helpers.ts          # Coordinate math, spatial index, HSV→CSS, walk helpers
    genre-tooltip.tsx                 # Hover tooltip overlay (positioned via pointer coords)
    genre-detail-sidebar.tsx          # Right-side Drawer with genre info + artist list
    genre-artist-list.tsx             # Scrollable artist/track list inside sidebar
    genre-preview-player.tsx          # Preview player UI (progress bar, play/pause/skip)
    genre-search-bar.tsx              # Search input with autocomplete dropdown
    genre-walk-controls.tsx           # Toolbar row: walk mode buttons + settings inputs

src/renderer/features/spotify/hooks/
  use-genre-data.ts                   # Load + index genre JSON (main thread, one-time)
  use-genre-artists.ts                # Fetch per-genre artists from IndexedDB
  use-genre-artists-indexer.ts        # Manages Web Worker lifecycle for IDB import
  use-genre-preview-player.ts         # Audio preview state machine (play/pause/random next)
  use-genre-walk.ts                   # Walk mode state machine (random / related)

src/renderer/features/spotify/workers/
  genre-artists-worker.ts             # Web Worker: stream-parse JSON → IndexedDB

src/renderer/features/spotify/api/
  everynoise-types.ts                 # TypeScript interfaces for genre & artist data
```

**Note**: `genre-related-lines.tsx` was not created — related-genre line rendering is deferred.

### Modified Files

| File | Change |
|------|--------|
| `src/renderer/router/routes.ts` | Added `SPOTIFY_EVERYNOISE = '/spotify/everynoise'` |
| `src/renderer/router/app-router.tsx` | Added lazy route for `SpotifyEveryNoisePage` |
| `src/renderer/features/sidebar/components/sidebar.tsx` | Added "Genre Map" entry under Spotify section |
| `electron.vite.config.ts` | Added web worker bundle entry for `genre-artists-worker.ts` |
| `src/renderer/features/spotify/api/spotify-api-client.ts` | Added `getTrack(id)` method |

---

## 5. Implementation Details

### 5.1 Data Loading Strategy

**Genre data** (`spotify_genres.json`, ~5 MB):
- Fetched at runtime via `fetch(new URL('./spotify_genres.json', location.href).href)` — the absolute URL avoids blob-URL resolution failures in the Electron preload context.
- On load, builds a `Map<string, GenreEntry>` for O(1) lookup and a grid-based `SpatialIndex` (50×50 cells) for hit-testing.
- All four derived values (`genres`, `index`, `map`, `isLoaded`) are managed as proper React `useState` in `useGenreData` — not `useMemo` — so re-renders fire correctly when the async fetch completes.
- Module-level singleton (`cachedGenres` / `fetchPromise`) ensures the 5 MB fetch and parse happens exactly once per app session.

**Artist data** (`spotify_genres_artists_top50.json`, ~78 MB):
- **Not loaded into memory.** Indexed into IndexedDB by a Web Worker on first visit.
- Worker receives the absolute asset URL via postMessage (`new URL('./spotify_genres_artists_top50.json', location.href).href`) — required because workers run in a blob URL context where relative paths fail.
- Subsequent lookups: `tx.objectStore('genre-artists').get(genreName)` — O(1), non-blocking.
- Import runs in background; scatter plot is fully usable during indexing. Sidebar shows a loading indicator per-genre when not yet indexed.
- A `dataVersion` key in IDB detects staleness. Progress is posted back every ~100 genres.

**IndexedDB Schema**:
```
Database: feishin-everynoise (version 1)

Object Store: genre-artists
  keyPath: "genre"
  value: GenreArtist[]

Object Store: meta
  key: "importStatus"   → { done: boolean, progress: number, totalGenres: number }
  key: "dataVersion"    → hash/timestamp for cache invalidation
```

### 5.2 Scatter Plot Canvas

**Rendering approach**: HTML5 Canvas 2D (no external charting library).

Rationale: 6,435 text labels is too many for DOM-based rendering (SVG or divs would choke). Canvas with manual text drawing handles this well, with viewport-bounds culling for labels outside the visible area.

#### World Space

```
WORLD_W = 12,000 px (virtual)
WORLD_H =  5,000 px (virtual)

organic_index   [0, 1]  → X = organic_index × WORLD_W
atmospheric_index [0, 1] → Y = atmospheric_index × WORLD_H

Screen canvas = viewport into this world.
Transform = { scale, offsetX, offsetY }
```

The world dimensions are wider than tall to spread genres horizontally, matching the original Every Noise at Once layout aesthetics.

#### Canvas Architecture

```
┌─────────────────────────────────────────────────────┐
│  <canvas> — full page minus toolbar height           │
│                                                      │
│  Initial view: fit-to-screen (Math.min(W/12000,      │
│                H/5000) as initial scale)             │
│                                                      │
│  Zoom: MIN_SCALE=0.08, MAX_SCALE=20                  │
│  ZOOM_FACTOR=1.15 per wheel tick                     │
│                                                      │
│  Each genre:                                         │
│    ctx.fillText(genre.genre, canvasX, canvasY)       │
│    font-size = fontSizeForPopularity(pop) * scale    │
│    fillStyle = hsvToCss(h, s, v)                     │
│                                                      │
│  Render passes (back → front):                       │
│    1. Background clear                               │
│    2. Genre labels (all, with alpha by state)        │
│    3. Selected genre label (full alpha, bold)        │
│    4. Hovered genre label (full alpha, bold)         │
│                                                      │
│  Culling: skip genres outside visible viewport       │
│  LOD: DISABLED — all 6,435 genres render at all      │
│       zoom levels                                    │
└─────────────────────────────────────────────────────┘
```

#### Pan & Zoom

- **Wheel zoom**: `canvas.addEventListener('wheel', handler, {passive: false})` — must be non-passive to call `preventDefault()`. Zoom is centered on pointer world position using `WORLD_W/WORLD_H` for offset math (not `canvas.width/height`).
- **Click-drag pan**: `onPointerDown` → `onPointerMove` → update `offsetX/offsetY`.
- Initial fit-to-screen fires once after the ResizeObserver delivers the first real container dimensions (`width > 0 && height > 0`). A `hasInitRef` guard prevents re-running on subsequent resize events.

#### Font Size from Popularity

```typescript
const MIN_FONT = 9;
const MAX_FONT = 26;
const MAX_POP  = 61;

fontSizeForPopularity(pop) = MIN_FONT + (pop / MAX_POP) * (MAX_FONT - MIN_FONT)
```

Scaled by `transform.scale` at render time.

#### Colour Conversion

Genre `color` is `[H, S, V]` where H ∈ [0, 360], S ∈ [0, 1], V ∈ [0, 1].

Source data has V ≈ 0.3–0.9. A brightness boost is applied so low-V colours remain readable on dark backgrounds:

```typescript
function hsvToCss(h: number, s: number, v: number): string {
    const vBoosted = Math.min(1, v * 1.8);   // V=0.5 → ~0.85
    // standard HSV → RGB, return `rgb(r, g, b)`
}
```

#### Overlap Click Cycling

Dense areas may have multiple genre labels overlapping at the same pixel. A `hitTestAll` function returns **all** genres whose bounding box contains the click point. A `lastClickRef` tracks the last click position and candidate array; repeated clicks within 8px cycle through all candidates (mod-wrap).

#### Deselect by Clicking Empty Canvas

The `onPointerUp` handler calls an `onDeselect` callback when `hitTestAll` returns an empty array (click hit no genre). This closes the sidebar and deselects without requiring the Esc key.

### 5.3 Genre Tooltip

A lightweight HTML overlay (`position: absolute` inside the canvas container) positioned at the pointer. Rendered as a Mantine `Paper` via `genre-tooltip.tsx`.

**Trigger**: `onPointerMove` → spatial-index lookup → if hitting a genre, update `hoveredRef` + set `needsRedrawRef=true`. State is stored in a non-React ref (`hoveredRef`) to avoid re-renders on every pointer-move; a single `useState` is only used for the React-rendered tooltip content.

**Content**:
- **Genre name** (bold)
- **Sample song** (one-liner)
- **Description** (first ~150 chars + "…")

**Behaviour**:
- Shows immediately on hover — no dwell debounce.
- Cleared by `onPointerLeave` on the canvas element (`wrappedOnHover(null, 0, 0)`), so the tooltip disappears when the pointer exits the canvas.
- Does NOT appear while panning (`isPanningRef` check).
- Works while the sidebar Drawer is open — the Drawer uses `withOverlay={false}` (see §5.4) so the canvas receives pointer events normally.
- Hovered genre renders at full alpha (`1.0`) and bold even when another genre is currently selected.

### 5.4 Genre Detail Sidebar

Opens when the user **clicks** a genre label on the scatter plot. Closed by clicking the × button, pressing Esc, or clicking empty canvas space.

**Component**: Mantine `Drawer` (right-side), ~400px wide.

**Critical prop**: `withOverlay={false}` — the default Mantine Drawer overlay is a full-screen backdrop that absorbs pointer events, which would block hover/click on the canvas. Removing it lets the canvas receive all pointer events while the Drawer is open.

**Layout**: Drawer body uses `overflow: hidden` to prevent a double-scrollbar situation:

```
Drawer body (flex column, overflow: hidden)
  ├── Sticky top block (Stack, no scroll)
  │     ├── Genre name + colour swatch + popularity badge
  │     ├── Full description text
  │     ├── "Open Playlist" button
  │     ├── "Start Related Walk" button
  │     ├── Preview player (now-playing, progress, controls)
  │     └── Indexing progress bar (shown while IDB worker runs)
  └── ScrollArea (flex: 1, single scrollable region)
        ├── Top 50 Artists / Songs list
        └── Related Genres list
```

**Sections**:

1. **Genre Header**: Genre name (large), HSV colour swatch, popularity badge
2. **Description**: Full `desc` text
3. **Reference Playlist**: Extracts playlist ID from `spotify_playlist` field; "Open Playlist" button navigates in-app to `SPOTIFY_PLAYLIST_DETAIL` route
4. **Related Walk button**: "Start Related Walk from here" — starts a `related` walk mode beginning at this genre
5. **Now Playing Preview**: Shows current artist/song, progress, play/pause/skip controls; volume synced to main player
6. **Top 50 Artists** (scrollable): Play preview, Add to Queue, Open Artist actions per row
7. **Related Genres** (scrollable): Clickable; clicking a related genre briefly closes and re-opens the sidebar for that genre (80ms timeout), animating the scatter plot to the new position

### 5.5 Preview Audio Player

A separate lightweight audio player for preview snippets. Does NOT use the main librespot pipeline — preview URLs are standard MP3 URLs played with a plain `HTMLAudioElement`.

#### State Machine

```
  IDLE ──(genre selected)──> auto-picks random artist with preview_url
                                      │
                                      v
                                  LOADING
                                      │
                                   (canplay)
                                      │
                                      v
                                  PLAYING ──(ended / maxDuration timer)──> pick next random
                                      │
                                   (user pause)
                                      │
                                      v
                                  PAUSED
                                      │
                               (sidebar close)
                                      v
                                   IDLE
```

#### Behaviour

- When a genre is selected and the sidebar opens, **auto-starts** a random preview from the genre's artist list.
- When the current snippet ends (natural end or `maxDuration` timeout), picks another random artist's preview.
- User can pause, resume, or skip to the next random preview.
- The sidebar highlights which artist/song row is currently playing.
- When the sidebar closes or a different genre is selected, stops playback.
- **Volume**: `usePlayerVolume() / 100` — preview volume follows the main player volume setting.
- **`maxDuration`**: Optional number of seconds; a `setTimeout` auto-skips the track if it has been playing for that long. Enabled by the Walk controls "Limit" input (0 = play full clip).
- **`onSongEnd` callback**: Fired on both natural end and `maxDuration` timeout. Used by `useGenreWalk` to count songs heard per genre before advancing to the next.

#### Hook: `useGenrePreviewPlayer`

```typescript
function useGenrePreviewPlayer(
    artists: GenreArtist[] | null,
    volume?: number,          // default 1.0
    onSongEnd?: () => void,   // called on natural end OR maxDuration skip
    maxDuration?: number,     // 0 = no limit; >0 = seconds
): {
    state: PreviewPlayerState;
    play: () => void;
    pause: () => void;
    playIndex: (index: number) => void;
    stop: () => void;
}
```

Uses a single `HTMLAudioElement` ref. The `maxDuration` `setTimeout` ref is cleared on each new song and on `stop()` to prevent timer leaks.

### 5.6 Related Genres Lines (Deferred)

**Status**: ❌ Not implemented.

The original plan was to draw lines on the canvas from the selected genre to each `related_genres` entry. This was deprioritised in favour of the walk modes (§5.9) which provide a more interactive way to explore related genres. The sidebar already lists related genres as clickable links.

If implemented in future:
- Draw lines in a separate canvas render pass **before** text labels (so lines appear behind labels).
- Line opacity proportional to `count`; colour from selected genre's HSV with reduced alpha.
- `genre-related-lines.tsx` was not created.

### 5.7 Navigation & External Links

**Open Artist (in-app)**:
```typescript
navigate(AppRoute.SPOTIFY_ARTIST_DETAIL.replace(':artistId', artistId));
```
Each artist row in the sidebar has an "Open Artist" icon button.

**Open Playlist (in-app)**:
```typescript
const playlistId = genre.spotify_playlist.match(/spotify:playlist:([\w]+)/)?.[1];
navigate(AppRoute.SPOTIFY_PLAYLIST_DETAIL.replace(':playlistId', playlistId));
```
"Open Playlist" button in the sticky top section of the sidebar.

**Open Track externally**: Not included in the initial implementation. Tracks can be added to queue instead (see §5.8).

### 5.8 Add to Queue Integration

Every artist row in the sidebar has an "Add to Queue" button. Both cases produce a normalized `Song` for `player.addToQueueByData([song], Play.LAST)`.

#### Case 1: `track_id` is present

```typescript
const track = await spotifyApiClient.getTrack(entry.track_id);
const song = normalizeSpotifyTrack(track);
player.addToQueueByData([song], Play.LAST);
```

`getTrack(id)` — added to `SpotifyApiClient` as `GET /v1/tracks/{id}`.

#### Case 2: `track_id` is absent — Optimistic Search Fallback

```typescript
function parseSampleSong(sampleSong: string): { artist: string; title: string } {
    // 'Taylor Swift "Cruel Summer"' → { artist: 'Taylor Swift', title: 'Cruel Summer' }
    const match = sampleSong.match(/^(.+?)\s*"(.+)"$/);
    return match
        ? { artist: match[1].trim(), title: match[2].trim() }
        : { artist: sampleSong, title: '' };
}

const { artist, title } = parseSampleSong(entry.sample_song);
const query = title ? `track:${title} artist:${artist}` : artist;
const results = await spotifyApiClient.search(query, ['track'], 1, 0);
const track = results.tracks?.items?.[0];
if (!track) {
    toast.warn({ title: 'Track not found on Spotify', message: `"${title}" by ${artist}` });
    return;
}
```

A toast confirms success or warns on failure. A loading spinner indicates per-row queue activity.

### 5.9 Genre Walk Modes

A walk mode state machine (`use-genre-walk.ts`) auto-tours through genres, playing preview audio at each stop.

#### Walk Types

| Mode | Description |
|------|-------------|
| **Random Walk** | Picks a random unvisited genre from the full 6,435 list. When all genres have been visited, resets the visited set and continues. |
| **Related Walk** | Starts from the currently selected genre (or random if none). Each advance picks the nearest unvisited genre by Euclidean world-space distance, with a configurable randomness pool. |

#### Walk Settings

| Setting | Control | Range | Default |
|---------|---------|-------|---------|
| `songsPerGenre` | "Songs/genre" number input | 1–10 | 2 |
| `maxSongDuration` | "Limit" number input | 0–30 s (0=full) | 0 |
| `randomness` | "Wander" slider | 0–5 | 0 |

#### Wander Slider (Related Walk only)

Controls the candidate pool size for neighbor selection in related mode:

```
WALK_RANDOMNESS_POOLS = [1, 5, 10, 25, 50, 100]
Labels: ['Nearest', 'Low', 'Medium', 'High', 'Very High', 'Max']
```

At `randomness=0` (Nearest), the walk always moves to the *closest* unvisited neighbor. Higher values pick randomly from a larger pool of near neighbors, increasing map coverage at the cost of spatial coherence.

#### Walk UI (`genre-walk-controls.tsx`)

A single toolbar row beneath the search bar:

```
[Random Walk] [Related Walk] [Stop] · 42 visited
│─────────────────────────────│
Songs/genre [2▲▼]  Limit [0▲▼] full
Wander: Nearest ±1  [─────────●────]
```

- "Random Walk" / "Related Walk" buttons toggle `filled` variant when that mode is active; the other dims to 40% opacity.
- "Stop" (red) appears only when a walk is active.
- Visited count updates live.
- Closing the sidebar also stops an active walk.

#### Hook API

```typescript
function useGenreWalk(): {
    currentWalkGenre: GenreEntry | null;
    mode: WalkMode;                          // 'idle' | 'random' | 'related'
    onSongEnded: () => void;                 // call from preview player's onSongEnd
    settings: WalkSettings;
    startRandom: (genres: GenreEntry[]) => void;
    startRelated: (from: GenreEntry | null, genres: GenreEntry[]) => void;
    stop: () => void;
    updateSettings: (patch: Partial<WalkSettings>) => void;
    walkedCount: number;
}
```

The route watches `currentWalkGenre` with a `useEffect` and calls `setSelectedGenre` + `setSearchMatch` to animate the scatter plot to each new genre.

---

### 5.10 Keyboard Navigation

When a genre is selected, WASD and arrow keys navigate to the nearest genre in a cardinal direction:

```
W / ↑  — move to nearest genre above (lower atmospheric_index)
S / ↓  — move to nearest genre below (higher atmospheric_index)
A / ←  — move to nearest genre to the left (lower organic_index)
D / →  — move to nearest genre to the right (higher organic_index)
```

**Implementation** (`findNeighborInDirection` in `genre-scatter-helpers.ts`):
- Filters genres to those in the correct axis direction from the current genre.
- Among qualifying genres, finds the one with the smallest Euclidean world-space distance.
- No movement if no genre exists in that direction.

**Guard**: Keyboard events are ignored when focus is in an `<input>` or `<textarea>` to avoid interfering with typing in the search bar.

A subtle overlay hint in the bottom-left corner of the canvas reads _"WASD / ↑↓←→ to navigate nearby genres"_ and is visible only while a genre is selected.

### Route

| Constant | Path | Component |
|----------|------|-----------|
| `SPOTIFY_EVERYNOISE` | `/spotify/everynoise` | `SpotifyEveryNoisePage` |

Add to `src/renderer/router/routes.ts` and `app-router.tsx` (lazy-loaded).

### Sidebar

Add an "Every Noise" or "Genre Map" entry under the Spotify section in the sidebar. This follows the data-driven sidebar system in `settings.store.ts`:

- Add `SidebarItem.SPOTIFY_EVERYNOISE` to the `SidebarItem` enum (if using enum) or add a new entry to the default sidebar items array.
- Icon suggestion: a scatter-plot / grid icon, or a music waveform icon.

---

## 7. Performance Considerations

| Concern | Mitigation |
|---------|------------|
| **6,435 labels on canvas** | Viewport-bounds culling: skip genres whose canvas coords fall outside the visible rect. |
| **Hover hit-testing on 6,435 items** | 50×50 grid spatial index. ~9 cells checked per pointer move (~5–20 genres). |
| **78 MB artists JSON** | IndexedDB pre-index via Web Worker. First-run import ~10–30 s; progress shown in toolbar. O(1) per-genre lookup thereafter. |
| **Canvas redraw on pan/zoom** | RAF loop with `needsRedrawRef` dirty flag. Redraws only when transform changes or selection/hover state changes. |
| **Text measurement** | `ctx.measureText()` results cached in `Map<string, number>` keyed by `"genre|fontSize"`. |
| **Preview audio** | Single `HTMLAudioElement` instance reused across all previews. No Web Audio overhead. |
| **LOD** | Disabled. All 6,435 genres are rendered at all zoom levels. Culling is sufficient at full zoom-out. |
| **Memory** | ~5 MB genre data in memory (two arrays + two Maps). Artist data ~15–40 KB per genre loaded on demand from IDB. ~78 MB persisted in IDB (disk, not RAM). |
| **Walk state** | Walk advances are driven by the `onSongEnd` callback chain — no polling timers; negligible CPU overhead. |

### IndexedDB Import Worker

`src/renderer/features/spotify/workers/genre-artists-worker.ts`:

```
Input:  data/spotify_genres_artists_top50.json (78 MB, bundled as static asset)
Output: IndexedDB "feishin-everynoise" → "genre-artists" object store

Steps:
1. Check IDB meta store for dataVersion. If matches current version, exit early.
2. Fetch the monolithic JSON file from the app's static assets.
3. Stream-parse the JSON array (using a streaming JSON parser or chunked JSON.parse).
4. For each genre entry, put { genre, artists } into the "genre-artists" object store.
5. Update meta store: importStatus = { done: true, progress: 6435, totalGenres: 6435 }.
6. Post progress messages to main thread during import (every ~100 genres).
```

**Hook: `useGenreArtistsIndexer`**:
- Spawns the worker on first mount of the Every Noise page.
- Exposes `{ isIndexing: boolean, progress: number, totalGenres: number, isReady: boolean }`.
- Worker is terminated after import completes.

**Hook: `useGenreArtists(genre: string)`**:
- Reads from IDB: `db.transaction('genre-artists').objectStore('genre-artists').get(genre)`.
- Returns `{ data: GenreArtist[] | null, isLoading: boolean }`.
- If the genre hasn't been indexed yet (worker still running), shows a loading state in the sidebar.

---

## 8. UI/UX Design Notes

### Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  [Search: ________________]  6,435 genres · scroll to zoom         │  ← Row 1
│  [Random Walk] [Related Walk]  Songs/genre [2] Limit [0] Wander:  │  ← Row 2
│  Nearest ±1 [──●──────────]                                        │
├──────────────────────────────────────────┬─────────────────────────┤
│                                          │  Genre Detail Drawer    │
│         Canvas Scatter Plot              │  (withOverlay=false)    │
│                                          │                         │
│   ← mechanical           organic →       │  [Genre Name] ████ P61  │
│                                          │  Full description text  │
│   dense ↑                                │  [Open Playlist ↗]      │
│         │                                │  [Start Related Walk]   │
│         │   • pop                        │  ─────────────────      │
│         │          • rock                │  ▶ Taylor Swift —       │
│         │    • dance pop                 │    Cruel Summer [───]   │
│         │                • metal         │  ─────────────────      │
│         │                                │  Top 50 Artists:  ↕     │
│   atmospheric ↓                          │  1. Taylor Swift ▶ ⊕    │
│                                          │  2. The Weeknd   ▶ ⊕    │
│  WASD / ↑↓←→ to navigate nearby genres  │  ...                    │
│  (shown when genre selected)             │  Related Genres:        │
│                                          │  • dance pop (70)       │
│                                          │  • post-teen pop (26)   │
└──────────────────────────────────────────┴─────────────────────────┘
```

### Interaction Summary

| Action | Result |
|--------|--------|
| **Hover** genre label | Tooltip with name, sample song, description excerpt |
| **Click** genre label | Open detail sidebar, start preview playback |
| **Click** empty canvas | Deselect genre, close sidebar |
| **Repeated click** dense area | Cycles through overlapping genre candidates |
| **Scroll wheel** | Zoom in/out centered on pointer |
| **Click-drag** canvas | Pan the viewport |
| **Type in search** | Filter genres, autocomplete dropdown, select → animate zoom-to-genre |
| **WASD / arrow keys** | Navigate to nearest genre in that cardinal direction (when genre selected) |
| **Click "Open Playlist"** | Navigate to in-app `SPOTIFY_PLAYLIST_DETAIL` page |
| **Click artist row ▶** | Play that artist's preview snippet |
| **Click artist row ⊕** | Add track to queue (direct fetch or optimistic search fallback) |
| **Click artist name** | Navigate to in-app `SPOTIFY_ARTIST_DETAIL` page |
| **Click related genre** | Animate to that genre, open its sidebar |
| **Click "Start Related Walk"** | Start related walk mode from current genre |
| **Walk controls toolbar** | Start/stop random or related walk, tune songs/genre, time limit, wander |
| **Close sidebar / Esc** | Stop preview audio; stop active walk |

### Theming

- Canvas background: use the app's current theme background colour (`--bg-canvas` or similar CSS variable).
- Genre label colours: use the HSV colour from data — these are designed to be visible on dark backgrounds.
- Ensure light theme compatibility: may need to darken labels or add a subtle text shadow.

---

## 9. Design Decisions

| # | Decision | Detail |
|---|----------|--------|
| 1 | **Preview audio is independent from the main player** | Uses a separate `HTMLAudioElement`. Main librespot playback continues unaffected. |
| 2 | **Selecting a genre does NOT stop/pause the main player** | Preview audio plays alongside main playback. Both can be paused independently. |
| 3 | **Scatter plot does NOT require Spotify auth for viewing** | The map and previews are viewable without auth (data is static, preview URLs are public CDN). "Add to Queue" is gated behind auth. |
| 4 | **First-run IDB import shows inline progress** | "Indexing artists: N / 6,435" text in the toolbar Row 1. Scatter plot is fully navigable during import. Sidebar shows a loading spinner for genres not yet indexed. Disappears permanently once complete. |
| 5 | **`withOverlay={false}` on the Drawer** | Default Mantine Drawer renders a full-screen backdrop that absorbs all pointer events, blocking hover and click on the canvas while the sidebar is open. Removing the overlay is mandatory. |
| 6 | **World space 12,000 × 5,000** | Wider than tall to spread the genre names horizontally. `MIN_SCALE=0.08` allows fitting the entire world on the screen at once. |
| 7 | **LOD disabled** | The original plan for LOD thresholds (`popularity >= 30 / 15 / all`) was too aggressive — it hid nearly all genres at typical zoom levels. Disabled in favour of simply rendering all 6,435 labels with viewport-bounds culling. |
| 8 | **Walk modes over related-genre lines** | Genre walk (§5.9) provides a more engaging exploration mechanism than static connecting lines. Lines are deferred. |
| 9 | **IDB worker uses absolute URL** | `new URL('./spotify_genres_artists_top50.json', location.href).href` — Web Workers run in a blob URL context; relative paths would fail to resolve. The absolute URL is computed in the renderer thread and passed via postMessage. |
| 10 | **Drawer body `overflow: hidden`** | Prevents the Drawer body from becoming its own scrollable container alongside the inner `ScrollArea`, which would create two visible scrollbars. |

---

## 10. Bug Fixes & Implementation Notes

Issues encountered and resolved during implementation.

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Passive wheel error | React `onWheel` is passive by default; can't call `preventDefault()` | `canvas.addEventListener('wheel', h, {passive: false})` |
| IDB worker fetch fails | `fetch('./...')` in a Web Worker resolves relative to the blob URL | Build absolute URL in renderer with `new URL(...)`, pass via postMessage |
| Dark genre colors invisible | Source HSV has V ≈ 0.3–0.5, too dark on dark background | `vBoosted = Math.min(1, v * 1.8)` |
| All genres culled by LOD | `popularity >= 30` filtered ~95% of genres at default zoom | `isVisibleAtScale` unconditionally returns `true` |
| Black canvas on first load | `useEffect([])` fired before ResizeObserver; `useMemo` read stale module vars | `hasInitRef` guard + `useEffect([width, height])` + proper `useState` for all data |
| Canvas initialised at default size | `useState({h:600, w:900})` triggered `hasInitRef` before real dimensions | Changed default to `{h:0, w:0}` |
| Zoom anchors to top-left corner | Wheel offset math used `canvas.width/height` after world-space refactor | Changed to `WORLD_W/WORLD_H` |
| Volume too loud | Preview player not connected to main volume | `usePlayerVolume() / 100` passed to hook |
| Song duration limit ignored | `maxSongDuration` not threaded through prop chain | Added prop to `GenreDetailSidebar`, passed from route |
| Wander slider label jitters layout | Variable-width text label shifted the slider on each value change | Fixed-width `div` wrappers (148px total split: 60px name + 40px pool size) |
| Hover tooltip blocked by sidebar | Mantine Drawer default backdrop absorbs all pointer events | `withOverlay={false}` |
| Tooltip stuck on canvas leave | No `pointerleave` handler | `onPointerLeave={() => wrappedOnHover(null, 0, 0)}` |
| Hovered genre invisible when genre selected | Selected genre fades non-selected to `alpha=0.3`, including hovered genre | Hovered genre always renders at `alpha=1.0`, bold |
| Double scrollbar in sidebar | Drawer body was also scrollable in addition to inner `ScrollArea` | `overflow: 'hidden'` on Drawer body styles |

---

## Appendix A: New Dependency Candidates

| Library | Purpose | Needed? |
|---------|---------|---------|
| None (raw Canvas 2D) | Scatter plot rendering | ✅ Use built-in |
| `fuse.js` | Fuzzy genre search | Not needed — simple `includes()` on 6,435 items is instant |

---

## Appendix B: Spotify API Endpoints Used

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/v1/tracks/{id}` | Fetch full track for "Add to Queue" when `track_id` is present | Yes |
| GET | `/v1/search?q=...&type=track&limit=1` | Optimistic search fallback when `track_id` is absent | Yes |

The `search` endpoint was already implemented in `SpotifyApiClient`. The `getTrack(id)` method was added as part of this feature.
