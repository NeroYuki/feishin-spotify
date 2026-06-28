import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useGenreData } from '/@/renderer/features/spotify/hooks/use-genre-data';
import { useGenreArtistsIndexer } from '/@/renderer/features/spotify/hooks/use-genre-artists-indexer';
import { useGenreWalk } from '/@/renderer/features/spotify/hooks/use-genre-walk';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { GenreScatterPlot } from '/@/renderer/features/spotify/components/everynoise/genre-scatter-plot';
import { GenreTooltip } from '/@/renderer/features/spotify/components/everynoise/genre-tooltip';
import { GenreDetailSidebar } from '/@/renderer/features/spotify/components/everynoise/genre-detail-sidebar';
import { GenreSearchBar } from '/@/renderer/features/spotify/components/everynoise/genre-search-bar';
import { GenreWalkControls } from '/@/renderer/features/spotify/components/everynoise/genre-walk-controls';
import { findNeighborInDirection } from '/@/renderer/features/spotify/components/everynoise/genre-scatter-helpers';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { SpotifyConnectButton } from '/@/renderer/features/spotify/components/spotify-connect-button';
import { useColorScheme } from '/@/renderer/themes/use-app-theme';
import type { GenreEntry } from '/@/renderer/features/spotify/api/everynoise-types';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Group } from '/@/shared/components/group/group';

// Measure available canvas area
function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
    const [size, setSize] = useState({ height: 0, width: 0 });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const measure = () => {
            const rect = el.getBoundingClientRect();
            setSize((prev) => {
                if (prev.width === rect.width && prev.height === rect.height) return prev;
                return { height: rect.height, width: rect.width };
            });
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);

    return size;
}

export default function SpotifyEveryNoisePage() {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { genres, index: spatialIndex, map: genreMap, isLoaded } = useGenreData();
    const { isIndexing, progress, totalGenres } = useGenreArtistsIndexer();
    const walk = useGenreWalk();

    const [selectedGenre, setSelectedGenre] = useState<GenreEntry | null>(null);
    const [hoveredGenre, setHoveredGenre] = useState<GenreEntry | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [searchMatch, setSearchMatch] = useState<GenreEntry | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const { width, height } = useContainerSize(containerRef);

    // When walk advances to a new genre, select it and zoom to it
    const prevWalkGenreRef = useRef<GenreEntry | null>(null);
    useEffect(() => {
        if (!walk.currentWalkGenre) return;
        if (walk.currentWalkGenre === prevWalkGenreRef.current) return;
        prevWalkGenreRef.current = walk.currentWalkGenre;
        setSelectedGenre(walk.currentWalkGenre);
        setSearchMatch(walk.currentWalkGenre);
    }, [walk.currentWalkGenre]);

    // When walk stops, keep selection but clear the prevWalkGenre tracking
    useEffect(() => {
        if (walk.mode === 'idle') prevWalkGenreRef.current = null;
    }, [walk.mode]);

    const handleHover = useCallback((genre: GenreEntry | null, cx: number, cy: number) => {
        setHoveredGenre(genre);
        if (genre) setTooltipPos({ x: cx, y: cy });
    }, []);

    const handleSelect = useCallback((genre: GenreEntry) => {
        setSelectedGenre(genre);
        setSearchMatch(null);
    }, []);

    const handleSidebarClose = useCallback(() => {
        setSelectedGenre(null);
        if (walk.mode !== 'idle') walk.stop();
    }, [walk]);

    const handleRelatedGenreClick = useCallback(
        (genreName: string) => {
            const found = genreMap.get(genreName);
            if (found) {
                setSelectedGenre(null);
                setTimeout(() => {
                    setSelectedGenre(found);
                    setSearchMatch(found);
                }, 80);
            }
        },
        [genreMap],
    );

    const handleSearchSelect = useCallback((genre: GenreEntry) => {
        setSearchMatch(genre);
        setSelectedGenre(genre);
    }, []);

    const handleStartRelatedWalk = useCallback(
        (fromGenre: GenreEntry) => {
            walk.startRelated(fromGenre, genres);
        },
        [walk, genres],
    );

    // WASD / Arrow key navigation when a genre is selected
    useEffect(() => {
        if (!selectedGenre || genres.length === 0) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const dirMap: Record<string, 'down' | 'left' | 'right' | 'up'> = {
                a: 'left', A: 'left', ArrowLeft: 'left',
                d: 'right', D: 'right', ArrowRight: 'right',
                w: 'up', W: 'up', ArrowUp: 'up',
                s: 'down', S: 'down', ArrowDown: 'down',
            };
            const dir = dirMap[e.key];
            if (!dir) return;
            e.preventDefault();
            const neighbor = findNeighborInDirection(selectedGenre, genres, dir);
            if (neighbor) {
                setSelectedGenre(neighbor);
                setSearchMatch(neighbor);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [selectedGenre, genres]);

    if (!isAuthenticated) {
        return (
            <AnimatedPage>
                <Stack align="center" justify="center" style={{ height: '100%' }}>
                    <Text size="lg">Connect to Spotify to explore genres</Text>
                    <SpotifyConnectButton />
                </Stack>
            </AnimatedPage>
        );
    }

    if (!isLoaded) {
        return (
            <AnimatedPage>
                <Stack align="center" justify="center" style={{ height: '100%' }}>
                    <Spinner />
                    <Text isMuted size="sm">Loading genre data…</Text>
                </Stack>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Top toolbar */}
                <div
                    style={{
                        background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)',
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                        gap: 6,
                        padding: '6px 12px',
                        zIndex: 10,
                    }}
                >
                    {/* Row 1: search + genre count */}
                    <Group gap="md" style={{ alignItems: 'center' }}>
                        <div style={{ maxWidth: 320, width: '100%' }}>
                            <GenreSearchBar
                                genres={genres}
                                onSelect={handleSearchSelect}
                            />
                        </div>
                        <Text isMuted size="xs">
                            {genres.length.toLocaleString()} genres · scroll to zoom · drag to pan
                        </Text>
                        {isIndexing && (
                            <Text isMuted size="xs">
                                Indexing artists: {progress} / {totalGenres}
                            </Text>
                        )}
                    </Group>

                    {/* Row 2: walk controls */}
                    <GenreWalkControls
                        mode={walk.mode}
                        settings={walk.settings}
                        walkedCount={walk.walkedCount}
                        onStartRandom={() => walk.startRandom(genres)}
                        onStartRelated={() => walk.startRelated(selectedGenre, genres)}
                        onStop={walk.stop}
                        onUpdateSettings={walk.updateSettings}
                    />
                </div>

                {/* Canvas area */}
                <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <GenreScatterPlot
                        genres={genres}
                        height={height}
                        searchMatch={searchMatch}
                        selectedGenre={selectedGenre}
                        spatialIndex={spatialIndex}
                        width={width}
                        onHover={handleHover}
                        onSelect={handleSelect}
                        onDeselect={handleSidebarClose}
                    />

                    {/* Hover tooltip */}
                    {hoveredGenre && (
                        <GenreTooltip
                            canvasX={tooltipPos.x}
                            canvasY={tooltipPos.y}
                            genre={hoveredGenre}
                        />
                    )}

                    {/* Keyboard navigation hint — only visible when a genre is selected */}
                    {selectedGenre && (
                        <div
                            style={{
                                background: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.75)',
                                borderRadius: 6,
                                bottom: 10,
                                color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                                fontSize: 11,
                                left: 10,
                                lineHeight: 1.5,
                                padding: '4px 8px',
                                pointerEvents: 'none',
                                position: 'absolute',
                                userSelect: 'none',
                            }}
                        >
                            WASD / ↑↓←→ to navigate nearby genres
                        </div>
                    )}
                </div>
            </div>

            {/* Genre detail sidebar */}
            <GenreDetailSidebar
                genre={selectedGenre}
                indexingProgress={progress}
                isIndexing={isIndexing}
                maxSongDuration={walk.settings.maxSongDuration}
                totalGenres={totalGenres}
                onClose={handleSidebarClose}
                onRelatedGenreClick={handleRelatedGenreClick}
                onSongEnd={walk.mode !== 'idle' ? walk.onSongEnded : undefined}
                onStartRelatedWalk={handleStartRelatedWalk}
            />
        </AnimatedPage>
    );
}
