import type { CanvasTransform, GenreEntry, SpatialIndex } from '/@/renderer/features/spotify/api/everynoise-types';

// ---------------------------------------------------------------------------
// Colour conversion
// ---------------------------------------------------------------------------

export function hsvToCss(h: number, s: number, v: number): string {
    // h: 0-360, s: 0-1, v: 0-1
    // Boost brightness so colors remain readable on a dark background.
    // The source data has V ≈ 0.3–0.9; we remap so V=0.5 → ~0.85 (more visible).
    const vBoosted = Math.min(1, v * 1.8);
    const c = vBoosted * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = vBoosted - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const ri = Math.round((r + m) * 255);
    const gi = Math.round((g + m) * 255);
    const bi = Math.round((b + m) * 255);
    return `rgb(${ri},${gi},${bi})`;
}

// ---------------------------------------------------------------------------
// Font size from popularity (1–61)
// ---------------------------------------------------------------------------

const MIN_FONT = 9;
const MAX_FONT = 26;
const MAX_POP = 61;

export function fontSizeForPopularity(popularity: number): number {
    return MIN_FONT + (popularity / MAX_POP) * (MAX_FONT - MIN_FONT);
}

// ---------------------------------------------------------------------------
// LOD thresholds
// ---------------------------------------------------------------------------

export function isVisibleAtScale(_popularity: number, _scale: number): boolean {
    return true; // Always render all genres
}

// ---------------------------------------------------------------------------
// World dimensions — fixed virtual canvas that genres are plotted onto.
// The screen canvas is a viewport into this world; use pan/zoom to navigate.
// Wider than tall to spread genres horizontally (matching Every Noise aesthetics).
// ---------------------------------------------------------------------------
export const WORLD_W = 12000;
export const WORLD_H = 5000;

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

/** Map world coords [0,1] to canvas pixel coords */
export function worldToCanvas(
    wx: number,
    wy: number,
    _canvasW: number,
    _canvasH: number,
    transform: CanvasTransform,
): { x: number; y: number } {
    const x = wx * WORLD_W * transform.scale + transform.offsetX;
    const y = wy * WORLD_H * transform.scale + transform.offsetY;
    return { x, y };
}

/** Map canvas pixel coords to world coords [0,1] */
export function canvasToWorld(
    cx: number,
    cy: number,
    _canvasW: number,
    _canvasH: number,
    transform: CanvasTransform,
): { wx: number; wy: number } {
    const wx = (cx - transform.offsetX) / (WORLD_W * transform.scale);
    const wy = (cy - transform.offsetY) / (WORLD_H * transform.scale);
    return { wx, wy };
}

// ---------------------------------------------------------------------------
// Spatial index hit-test
// ---------------------------------------------------------------------------

/** Returns the genre whose label bounding-box contains (cx, cy), or null */
export function hitTest(
    cx: number,
    cy: number,
    canvasW: number,
    canvasH: number,
    transform: CanvasTransform,
    index: SpatialIndex,
    textWidthCache: Map<string, number>,
    ctx: CanvasRenderingContext2D,
): GenreEntry | null {
    const all = hitTestAll(cx, cy, canvasW, canvasH, transform, index, textWidthCache, ctx);
    return all[0] ?? null;
}

/** Returns ALL genres whose label bounding-boxes contain (cx, cy) — for overlap cycling */
export function hitTestAll(
    cx: number,
    cy: number,
    canvasW: number,
    canvasH: number,
    transform: CanvasTransform,
    index: SpatialIndex,
    textWidthCache: Map<string, number>,
    ctx: CanvasRenderingContext2D,
): GenreEntry[] {
    const results: GenreEntry[] = [];
    const { wx, wy } = canvasToWorld(cx, cy, canvasW, canvasH, transform);
    if (wx < 0 || wx > 1 || wy < 0 || wy > 1) return results;

    const col = Math.min(Math.floor(wx * index.cols), index.cols - 1);
    const row = Math.min(Math.floor(wy * index.rows), index.rows - 1);

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= index.rows || c < 0 || c >= index.cols) continue;
            for (const g of index.grid[r][c].genres) {
                if (!isVisibleAtScale(g.popularity, transform.scale)) continue;

                const fontSize = fontSizeForPopularity(g.popularity) * transform.scale;
                const cacheKey = `${g.genre}|${Math.round(fontSize)}`;
                let w = textWidthCache.get(cacheKey);
                if (w === undefined) {
                    ctx.font = `${fontSize}px sans-serif`;
                    w = ctx.measureText(g.genre).width;
                    textWidthCache.set(cacheKey, w);
                }

                const { x: gx, y: gy } = worldToCanvas(g.organic_index, g.atmospheric_index, canvasW, canvasH, transform);
                if (
                    cx >= gx - w / 2 &&
                    cx <= gx + w / 2 &&
                    cy >= gy - fontSize * 0.8 &&
                    cy <= gy + fontSize * 0.25
                ) {
                    results.push(g);
                }
            }
        }
    }
    return results;
}

// ---------------------------------------------------------------------------
// Build transform for zoom-to-world-point
// ---------------------------------------------------------------------------

export function zoomToPoint(
    canvasW: number,
    canvasH: number,
    wx: number,
    wy: number,
    targetScale: number,
): CanvasTransform {
    const newScale = Math.max(0.1, Math.min(20, targetScale));
    const offsetX = canvasW / 2 - wx * WORLD_W * newScale;
    const offsetY = canvasH / 2 - wy * WORLD_H * newScale;
    return { offsetX, offsetY, scale: newScale };
}

// ---------------------------------------------------------------------------
// Directional neighbour — for keyboard navigation
// ---------------------------------------------------------------------------

/** Find the closest genre in the given cardinal direction from `current`. */
export function findNeighborInDirection(
    current: GenreEntry,
    genres: GenreEntry[],
    direction: 'down' | 'left' | 'right' | 'up',
): GenreEntry | null {
    const cx = current.organic_index;
    const cy = current.atmospheric_index;
    let best: GenreEntry | null = null;
    let bestDist = Infinity;

    for (const g of genres) {
        if (g.genre === current.genre) continue;
        const dx = g.organic_index - cx;
        const dy = g.atmospheric_index - cy;

        const valid =
            direction === 'right' ? dx > 0
            : direction === 'left' ? dx < 0
            : direction === 'down' ? dy > 0
            : dy < 0; // up

        if (!valid) continue;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
            bestDist = dist;
            best = g;
        }
    }
    return best;
}

// ---------------------------------------------------------------------------
// Nearest-unvisited — for related walk
// ---------------------------------------------------------------------------

/** Pool sizes per randomness level (0–5) */
export const WALK_RANDOMNESS_POOLS = [1, 5, 10, 25, 50, 100] as const;

/**
 * Returns up to `count` unvisited genres closest to `current`, sorted by
 * ascending distance. `walkedSet` should contain genre names already visited.
 */
export function findNearestUnvisited(
    current: GenreEntry,
    genres: GenreEntry[],
    walkedSet: Set<string>,
    count: number,
): GenreEntry[] {
    const cx = current.organic_index;
    const cy = current.atmospheric_index;

    return genres
        .filter((g) => g.genre !== current.genre && !walkedSet.has(g.genre))
        .map((g) => ({ dist: (g.organic_index - cx) ** 2 + (g.atmospheric_index - cy) ** 2, genre: g }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, count)
        .map((item) => item.genre);
}
