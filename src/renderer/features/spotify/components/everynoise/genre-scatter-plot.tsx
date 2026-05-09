import { useCallback, useEffect, useRef } from 'react';

import { useColorScheme } from '/@/renderer/themes/use-app-theme';
import type { CanvasTransform, GenreEntry, SpatialIndex } from '/@/renderer/features/spotify/api/everynoise-types';
import {
    WORLD_H,
    WORLD_W,
    canvasToWorld,
    fontSizeForPopularity,
    hitTest,
    hitTestAll,
    hsvToCss,
    isVisibleAtScale,
    worldToCanvas,
    zoomToPoint,
} from '/@/renderer/features/spotify/components/everynoise/genre-scatter-helpers';

interface Props {
    genres: GenreEntry[];
    spatialIndex: SpatialIndex | null;
    selectedGenre: GenreEntry | null;
    highlightedGenres?: Set<string>;
    searchMatch?: GenreEntry | null;
    onHover: (genre: GenreEntry | null, canvasX: number, canvasY: number) => void;
    onSelect: (genre: GenreEntry) => void;
    onDeselect?: () => void;
    width: number;
    height: number;
}


const MIN_SCALE = 0.08;
const MAX_SCALE = 20;
const ZOOM_FACTOR = 1.15;

export function GenreScatterPlot({
    genres,
    spatialIndex,
    selectedGenre,
    highlightedGenres,
    searchMatch,
    onHover,
    onSelect,
    onDeselect,
    width,
    height,
}: Props) {
    const colorScheme = useColorScheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const transformRef = useRef<CanvasTransform>({ offsetX: 0, offsetY: 0, scale: 1 });
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const animFrameRef = useRef<number>(0);
    const textWidthCacheRef = useRef<Map<string, number>>(new Map());
    const colourCacheRef = useRef<Map<string, string>>(new Map());
    const needsRedrawRef = useRef(true);
    const hasInitRef = useRef(false);
    // Theme-aware colors used in the render loop
    const bgColorRef = useRef('#111115');
    const labelHighlightRef = useRef('#000000');
    // Overlap click cycling: track last-click position and candidate list
    const lastClickRef = useRef<{ candidates: GenreEntry[]; cx: number; cy: number; idx: number } | null>(null);

    // Stable refs for props used inside the render loop
    const genresRef = useRef(genres);
    genresRef.current = genres;
    const selectedRef = useRef(selectedGenre);
    selectedRef.current = selectedGenre;
    const highlightedRef = useRef(highlightedGenres);
    highlightedRef.current = highlightedGenres;
    const spatialRef = useRef(spatialIndex);
    spatialRef.current = spatialIndex;
    const onHoverRef = useRef(onHover);
    onHoverRef.current = onHover;

    // Sync theme colors into refs so the render loop always uses current values
    useEffect(() => {
        bgColorRef.current = colorScheme === 'dark' ? '#111115' : '#f5f4f0';
        labelHighlightRef.current = colorScheme === 'dark' ? '#ffffff' : '#111111';
        needsRedrawRef.current = true;
    }, [colorScheme]);

    // Initial fit-to-screen — waits until ResizeObserver gives us real dimensions
    useEffect(() => {
        if (hasInitRef.current || width <= 0 || height <= 0) return;
        hasInitRef.current = true;
        const fitScale = Math.min(width / WORLD_W, height / WORLD_H);
        const offsetX = (width - WORLD_W * fitScale) / 2;
        const offsetY = (height - WORLD_H * fitScale) / 2;
        transformRef.current = { offsetX, offsetY, scale: fitScale };
        needsRedrawRef.current = true;
    }, [width, height]);

    // Resize
    useEffect(() => {
        needsRedrawRef.current = true;
    }, [width, height]);

    // Colour lookup with memoization
    const getColour = useCallback((entry: GenreEntry): string => {
        const [h, s, v] = entry.color;
        const key = `${h},${s},${v}`;
        let c = colourCacheRef.current.get(key);
        if (!c) {
            c = hsvToCss(h, s, v);
            colourCacheRef.current.set(key, c);
        }
        return c;
    }, []);

    // Main render function
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !needsRedrawRef.current) return;
        needsRedrawRef.current = false;

        const t = transformRef.current;
        const W = canvas.width;
        const H = canvas.height;
        const genreList = genresRef.current;

        const selected = selectedRef.current;
        const highlighted = highlightedRef.current;

        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = bgColorRef.current;
        ctx.fillRect(0, 0, W, H);

        // ---- Related genre lines pass (behind labels) ----
        if (selected && selected.related_genres.length > 0) {
            const { x: sx, y: sy } = worldToCanvas(selected.organic_index, selected.atmospheric_index, W, H, t);
            for (const rel of selected.related_genres) {
                const target = genreList.find((g) => g.genre === rel.genre);
                if (!target) continue;
                const { x: tx, y: ty } = worldToCanvas(target.organic_index, target.atmospheric_index, W, H, t);
                const lineW = Math.max(0.5, Math.min(3, parseInt(rel.count, 10) / 25));
                ctx.save();
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = getColour(selected);
                ctx.lineWidth = lineW;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
                ctx.restore();
            }
        }

        // ---- Labels pass ----
        for (const g of genreList) {
            if (!isVisibleAtScale(g.popularity, t.scale)) continue;

            const { x, y } = worldToCanvas(g.organic_index, g.atmospheric_index, W, H, t);
            // Culling
            if (x < -200 || x > W + 200 || y < -50 || y > H + 50) continue;

            const fontSize = fontSizeForPopularity(g.popularity) * t.scale;
            const cacheKey = `${g.genre}|${Math.round(fontSize * 10)}`;
            if (!textWidthCacheRef.current.has(cacheKey)) {
                ctx.font = `${fontSize}px sans-serif`;
                textWidthCacheRef.current.set(cacheKey, ctx.measureText(g.genre).width);
            }

            const isSelected = selected?.genre === g.genre;
            const isHovered = hoveredRef.current?.genre === g.genre;
            const isHighlighted = highlighted?.has(g.genre) ?? false;
            const isRelated = selected?.related_genres.some((r) => r.genre === g.genre) ?? false;

            ctx.font = `${(isSelected || isHovered) ? 'bold ' : ''}${fontSize}px sans-serif`;
            ctx.textBaseline = 'alphabetic';

            let colour = getColour(g);
            let alpha = 1.0;

            if (selected) {
                if (isSelected || isHovered) {
                    alpha = 1.0;
                } else if (isRelated) {
                    alpha = 0.9;
                } else {
                    alpha = 0.3;
                }
            } else if (isHighlighted || isHovered) {
                alpha = 1.0;
            }

            ctx.globalAlpha = alpha;

            if (isSelected) {
                // Draw outline/glow behind selected genre
                ctx.save();
                ctx.shadowColor = colour;
                ctx.shadowBlur = 8;
                ctx.fillStyle = labelHighlightRef.current;
                ctx.fillText(g.genre, x - textWidthCacheRef.current.get(cacheKey)! / 2, y);
                ctx.restore();
            } else {
                ctx.fillStyle = colour;
                ctx.fillText(g.genre, x - textWidthCacheRef.current.get(cacheKey)! / 2, y);
            }

            ctx.globalAlpha = 1.0;
        }
    }, [getColour]);

    // Track hovered genre inside the render loop without causing re-renders
    const hoveredRef = useRef<GenreEntry | null>(null);
    const wrappedOnHover = useCallback((genre: GenreEntry | null, cx: number, cy: number) => {
        hoveredRef.current = genre;
        needsRedrawRef.current = true;
        onHoverRef.current(genre, cx, cy);
    }, []);

    // RAF loop
    useEffect(() => {
        const loop = () => {
            render();
            animFrameRef.current = requestAnimationFrame(loop);
        };
        animFrameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [render]);

    // Force redraw when props change
    useEffect(() => {
        needsRedrawRef.current = true;
    }, [genres, selectedGenre, highlightedGenres, searchMatch, width, height]);

    // ---- Zoom to search match ----
    useEffect(() => {
        if (!searchMatch) return;
        const targetScale = 6;
        const target = zoomToPoint(
            width,
            height,
            searchMatch.organic_index,
            searchMatch.atmospheric_index,
            targetScale,
        );
        // Animate over ~20 frames
        const start = { ...transformRef.current };
        const steps = 20;
        let step = 0;
        const tick = () => {
            step++;
            const p = step / steps;
            transformRef.current = {
                offsetX: start.offsetX + (target.offsetX - start.offsetX) * p,
                offsetY: start.offsetY + (target.offsetY - start.offsetY) * p,
                scale: start.scale + (target.scale - start.scale) * p,
            };
            needsRedrawRef.current = true;
            if (step < steps) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [searchMatch, width, height]);

    // ---- Wheel zoom ----
    // Must use addEventListener with { passive: false } — React's synthetic onWheel is
    // passive by default in modern browsers, which prevents calling preventDefault().
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const t = transformRef.current;
        const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor));
        const { wx, wy } = canvasToWorld(cx, cy, canvas.width, canvas.height, t);
        const newOffsetX = cx - wx * WORLD_W * newScale;
        const newOffsetY = cy - wy * WORLD_H * newScale;
        transformRef.current = { offsetX: newOffsetX, offsetY: newOffsetY, scale: newScale };
        needsRedrawRef.current = true;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // ---- Pan ----
    const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return;
        isPanningRef.current = false;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;

        const DRAG_THRESHOLD = 5;
        if (e.buttons === 1 && (isPanningRef.current || Math.hypot(dx, dy) > DRAG_THRESHOLD)) {
            isPanningRef.current = true;
            transformRef.current = {
                ...transformRef.current,
                offsetX: transformRef.current.offsetX + e.movementX,
                offsetY: transformRef.current.offsetY + e.movementY,
            };
            panStartRef.current = { x: e.clientX, y: e.clientY };
            needsRedrawRef.current = true;
            wrappedOnHover(null, 0, 0);
            return;
        }

        // Hit test for hover tooltip
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !spatialRef.current) return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const hit = hitTest(
            cx,
            cy,
            canvas.width,
            canvas.height,
            transformRef.current,
            spatialRef.current,
            textWidthCacheRef.current,
            ctx,
        );
        wrappedOnHover(hit, cx, cy);
    }, [wrappedOnHover]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (isPanningRef.current) {
            isPanningRef.current = false;
            return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !spatialRef.current) return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        // Overlap cycling: same position as last click → cycle candidates
        const SAME_POS_THRESHOLD = 8;
        const last = lastClickRef.current;
        if (
            last &&
            Math.abs(cx - last.cx) < SAME_POS_THRESHOLD &&
            Math.abs(cy - last.cy) < SAME_POS_THRESHOLD &&
            last.candidates.length > 1
        ) {
            const nextIdx = (last.idx + 1) % last.candidates.length;
            lastClickRef.current = { ...last, idx: nextIdx };
            onSelect(last.candidates[nextIdx]!);
            return;
        }

        // Fresh hit-test: collect all overlapping genres
        const candidates = hitTestAll(
            cx,
            cy,
            canvas.width,
            canvas.height,
            transformRef.current,
            spatialRef.current,
            textWidthCacheRef.current,
            ctx,
        );
        if (candidates.length > 0) {
            lastClickRef.current = { candidates, cx, cy, idx: 0 };
            onSelect(candidates[0]!);
        } else {
            lastClickRef.current = null;
            onDeselect?.();
        }
    }, [onSelect, onDeselect]);

    return (
        <canvas
            ref={canvasRef}
            height={height}
            style={{ cursor: 'crosshair', display: 'block' }}
            width={width}
            onPointerDown={onPointerDown}
            onPointerLeave={() => wrappedOnHover(null, 0, 0)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        />
    );
}
