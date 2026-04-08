import { CSSProperties } from 'react';

import type { GenreEntry } from '/@/renderer/features/spotify/api/everynoise-types';
import { hsvToCss } from '/@/renderer/features/spotify/components/everynoise/genre-scatter-helpers';

interface Props {
    genre: GenreEntry;
    canvasX: number;
    canvasY: number;
}

export function GenreTooltip({ genre, canvasX, canvasY }: Props) {
    const colour = hsvToCss(...genre.color);
    const excerpt = genre.desc.length > 120 ? `${genre.desc.slice(0, 120)}…` : genre.desc;

    // Keep the tooltip within viewport by flipping sides
    const flipX = canvasX > window.innerWidth - 280;
    const flipY = canvasY > window.innerHeight - 140;

    const style: CSSProperties = {
        background: 'rgba(22,22,26,0.96)',
        borderLeft: `3px solid ${colour}`,
        borderRadius: 6,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        color: '#e5e5e5',
        fontSize: 13,
        left: flipX ? canvasX - 270 : canvasX + 16,
        maxWidth: 260,
        padding: '8px 12px',
        pointerEvents: 'none',
        position: 'fixed',
        top: flipY ? canvasY - 130 : canvasY + 8,
        zIndex: 9999,
    };

    return (
        <div style={style}>
            <div style={{ color: colour, fontWeight: 700, marginBottom: 3 }}>{genre.genre}</div>
            <div style={{ color: '#aaa', fontSize: 11, marginBottom: 4 }}>{genre.sample_song}</div>
            {excerpt && <div style={{ lineHeight: 1.4 }}>{excerpt}</div>}
        </div>
    );
}
