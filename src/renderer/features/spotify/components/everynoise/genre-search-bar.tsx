import { useCallback, useMemo, useState } from 'react';

import type { GenreEntry } from '/@/renderer/features/spotify/api/everynoise-types';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

interface Props {
    genres: GenreEntry[];
    onSelect: (genre: GenreEntry) => void;
}

const MAX_SUGGESTIONS = 8;

export function GenreSearchBar({ genres, onSelect }: Props) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const suggestions = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return genres
            .filter((g) => g.genre.toLowerCase().includes(q))
            .sort((a, b) => {
                const aStarts = a.genre.toLowerCase().startsWith(q) ? 0 : 1;
                const bStarts = b.genre.toLowerCase().startsWith(q) ? 0 : 1;
                if (aStarts !== bStarts) return aStarts - bStarts;
                return b.popularity - a.popularity;
            })
            .slice(0, MAX_SUGGESTIONS);
    }, [genres, query]);

    const handleSelect = useCallback(
        (genre: GenreEntry) => {
            setQuery('');
            setIsOpen(false);
            onSelect(genre);
        },
        [onSelect],
    );

    return (
        <div style={{ position: 'relative' }}>
            <TextInput
                placeholder="Search genres…"
                value={query}
                onBlur={() => setTimeout(() => setIsOpen(false), 150)}
                onChange={(e) => {
                    setQuery(e.currentTarget.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
            />
            {isOpen && suggestions.length > 0 && (
                <Stack
                    gap={0}
                    style={{
                        background: 'var(--mantine-color-body)',
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: 6,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                        left: 0,
                        maxHeight: 280,
                        overflowY: 'auto',
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        zIndex: 200,
                    }}
                >
                    {suggestions.map((g) => (
                        <div
                            key={g.genre}
                            style={{
                                cursor: 'pointer',
                                padding: '8px 12px',
                            }}
                            onMouseDown={() => handleSelect(g)}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLDivElement).style.background =
                                    'var(--mantine-color-default-hover)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                            }}
                        >
                            <Text size="sm">{g.genre}</Text>
                        </div>
                    ))}
                </Stack>
            )}
        </div>
    );
}
