import debounce from 'lodash/debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import formatDuration from 'format-duration';
import { Menu } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

import {
    useRandomSongs,
    useRandomSongsLoading,
    useRequestRandomSongs,
    useSearch,
    useSearchLoading,
    useSearchQuery,
    useSearchResults,
    useSend,
    useSpotifySearchOnce,
    useSetActiveTab,
    useSetModalView,
    useRequestSimilarSongs,
    useRequestSameArtist,
    useRequestSameAlbum,
} from '/@/remote/store';
import { SongContextMenu } from '/@/remote/components/song-context-menu';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Song } from '/@/shared/types/domain-types';
import spotifyLogoIcon from '/@/shared/components/icon/spotify_logo_icon.svg';

export const SearchView = () => {
    const searchQuery = useSearchQuery();
    const searchResults = useSearchResults();
    const searchLoading = useSearchLoading();
    const search = useSearch();
    const spotifySearchOnce = useSpotifySearchOnce();
    const send = useSend();
    const randomSongs = useRandomSongs();
    const randomSongsLoading = useRandomSongsLoading();
    const requestRandomSongs = useRequestRandomSongs();
    const setActiveTab = useSetActiveTab();
    const setModalView = useSetModalView();
    const requestSimilarSongs = useRequestSimilarSongs();
    const requestSameArtist = useRequestSameArtist();
    const requestSameAlbum = useRequestSameAlbum();
    const [localQuery, setLocalQuery] = useState(searchQuery);
    const [contextTarget, setContextTarget] = useState<Song | null>(null);
    const isNarrow = useMediaQuery('(max-width: 768px)');

    // Load random songs on mount when search is empty
    useEffect(() => {
        if (!searchQuery && randomSongs.length === 0) {
            requestRandomSongs();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const debouncedSearch = useMemo(
        () => debounce((query: string) => { search(query); }, 1000),
        [search],
    );

    const handleQueryChange = useCallback(
        (value: string) => {
            setLocalQuery(value);
            if (value.trim().length >= 2) {
                debouncedSearch(value.trim());
            } else if (!value.trim()) {
                debouncedSearch.cancel();
                search('');
            }
        },
        [debouncedSearch, search],
    );

    const handleSpotifySearch = useCallback(() => {
        if (localQuery.trim().length >= 2) {
            spotifySearchOnce(localQuery.trim());
        }
    }, [localQuery, spotifySearchOnce]);

    const handlePlayNow = useCallback((song: Song) => {
        send({ event: 'queue-add', items: [song], playType: 'now' } as any);
    }, [send]);

    const handlePlayNext = useCallback((song: Song) => {
        send({ event: 'queue-add', items: [song], playType: 'next' } as any);
    }, [send]);

    const handlePlayLast = useCallback((song: Song) => {
        send({ event: 'queue-add', items: [song], playType: 'last' } as any);
    }, [send]);

    // Context menu actions (for long-press on mobile)
    const handleSimilarSongs = useCallback((song: Song) => {
        requestSimilarSongs(song);
        setActiveTab('suggestions');
    }, [requestSimilarSongs, setActiveTab]);

    const handleSameArtist = useCallback((song: Song) => {
        requestSameArtist(song.artistName);
        setModalView('same-artist');
    }, [requestSameArtist, setModalView]);

    const handleSameAlbum = useCallback((song: Song) => {
        if (song.album) {
            requestSameAlbum(song.album);
            setModalView('same-album');
        }
    }, [requestSameAlbum, setModalView]);

    const isExternal = (id: string) => id?.startsWith('ext-');
    const isSpotify = (id: string) => id?.startsWith('ext-spotify-');

    const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchSongRef = useRef<Song | null>(null);

    const clearTouchTimer = useCallback(() => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
    }, []);

    const handleTouchStart = useCallback((song: Song) => {
        if (!isNarrow) return;
        touchSongRef.current = song;
        clearTouchTimer();
        touchTimerRef.current = setTimeout(() => {
            if (touchSongRef.current) {
                setContextTarget(touchSongRef.current);
            }
        }, 500);
    }, [isNarrow, clearTouchTimer]);

    const handleTouchEnd = useCallback(() => {
        clearTouchTimer();
    }, [clearTouchTimer]);

    const handleTouchMove = useCallback(() => {
        // Only cancel if the timer hasn't fired yet (finger movement cancels long-press)
        clearTouchTimer();
    }, [clearTouchTimer]);

    const renderSongRow = (song: Song) => (
        <Group
            key={song.id}
            align="center"
            gap="xs"
            px="sm"
            py="xs"
            onContextMenu={(e) => {
                e.preventDefault();
                setContextTarget(song);
            }}
            onTouchStart={() => handleTouchStart(song)}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onTouchMove={handleTouchMove}
            style={{
                borderRadius: 'var(--mantine-radius-sm)',
                cursor: isNarrow ? 'pointer' : undefined,
                flexShrink: 0,
            }}
            wrap="nowrap"
        >
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Group gap={4} wrap="nowrap">
                    {isSpotify(song.id) && (
                        <img alt="Spotify" src={spotifyLogoIcon} style={{ flexShrink: 0, height: 14, width: 14 }} />
                    )}
                    {isExternal(song.id) && !isSpotify(song.id) && (
                        <Text isMuted size="xs" style={{ flexShrink: 0 }}>🌐</Text>
                    )}
                    <Text size="sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song.name}
                    </Text>
                </Group>
                <Text isMuted size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {song.artistName} {song.album ? `· ${song.album}` : ''}
                </Text>
            </Stack>
            <Group gap={4} wrap="nowrap" align="center">
                {song.duration > 0 && (
                    <Text isMuted size="xs" style={{ flexShrink: 0 }}>
                        {formatDuration(song.duration)}
                    </Text>
                )}
                <ActionIcon icon="mediaPlay" iconProps={{ size: 16 }} onClick={() => handlePlayNow(song)} size="sm" tooltip={{ label: 'Play now' }} variant="subtle" />
                <ActionIcon icon="mediaPlayNext" iconProps={{ size: 16 }} onClick={() => handlePlayNext(song)} size="sm" tooltip={{ label: 'Play next' }} variant="subtle" />
                <ActionIcon icon="mediaPlayLast" iconProps={{ size: 16 }} onClick={() => handlePlayLast(song)} size="sm" tooltip={{ label: 'Add to end of queue' }} variant="subtle" />
                <SongContextMenu song={song} />
            </Group>
        </Group>
    );

    return (
        <Stack gap="sm" h="100%">
            <Group gap="xs" wrap="nowrap">
                <TextInput
                    autoFocus
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Search tracks..."
                    style={{ flex: 1 }}
                    value={localQuery}
                />
                <ActionIcon
                    onClick={handleSpotifySearch}
                    size="sm"
                    tooltip={{ label: 'Search Spotify' }}
                    variant="subtle"
                >
                    <img alt="Spotify" src={spotifyLogoIcon} style={{ height: 18, width: 18 }} />
                </ActionIcon>
            </Group>
            <Stack gap={0} style={{ flex: 1, overflowY: 'auto' }}>
                {searchLoading && (
                    <Center py="lg">
                        <Text isMuted size="sm">Searching...</Text>
                    </Center>
                )}
                {!searchLoading && searchQuery && searchResults.length === 0 && (
                    <Center py="lg">
                        <Text isMuted size="sm">No results found</Text>
                    </Center>
                )}
                {!searchQuery && !searchLoading && (
                    <Stack gap="xs">
                        <Group gap="xs" px="sm" wrap="nowrap">
                            <Text fw={600} size="sm">Random picks</Text>
                            <ActionIcon icon="refresh" iconProps={{ size: 14 }} loading={randomSongsLoading} onClick={requestRandomSongs} size="xs" tooltip={{ label: 'Refresh' }} variant="subtle" />
                        </Group>
                        {randomSongs.map(renderSongRow)}
                    </Stack>
                )}
                {searchResults.map(renderSongRow)}
            </Stack>
            {/* Mobile long-press context menu */}
            {isNarrow && contextTarget && (
                <Menu
                    onClose={() => setContextTarget(null)}
                    opened={!!contextTarget}
                    position="bottom"
                    shadow="md"
                    width={200}
                >
                    <Menu.Target>
                        <div style={{ height: 0, width: 0 }} />
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item onClick={() => { handlePlayNow(contextTarget); setContextTarget(null); }}>
                            ▶ Play now
                        </Menu.Item>
                        <Menu.Item onClick={() => { handlePlayNext(contextTarget); setContextTarget(null); }}>
                            ⏭ Play next
                        </Menu.Item>
                        <Menu.Item onClick={() => { handlePlayLast(contextTarget); setContextTarget(null); }}>
                            ⏬ Add to end
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item onClick={() => { handleSimilarSongs(contextTarget); setContextTarget(null); }}>
                            🔀 Get similar songs
                        </Menu.Item>
                        <Menu.Item onClick={() => { handleSameArtist(contextTarget); setContextTarget(null); }}>
                            👤 Songs from same artist
                        </Menu.Item>
                        {contextTarget.album && (
                            <Menu.Item onClick={() => { handleSameAlbum(contextTarget); setContextTarget(null); }}>
                                💿 Songs from same album
                            </Menu.Item>
                        )}
                    </Menu.Dropdown>
                </Menu>
            )}
        </Stack>
    );
};