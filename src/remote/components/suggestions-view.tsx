import { useCallback, useMemo, useState } from 'react';
import formatDuration from 'format-duration';
import debounce from 'lodash/debounce';
import { Autocomplete } from '@mantine/core';

import {
    useRequestSimilarSongs,
    useSend,
    useSimilarSongs,
    useSimilarSongsLoading,
    useSimilarSongsSeed,
    useSuggestSearch,
    useSuggestSearchResults,
} from '/@/remote/store';
import { SongContextMenu } from '/@/remote/components/song-context-menu';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Song } from '/@/shared/types/domain-types';
import spotifyLogoIcon from '/@/shared/components/icon/spotify_logo_icon.svg';

export const SuggestionsView = () => {
    const similarSongs = useSimilarSongs();
    const similarSongsSeed = useSimilarSongsSeed();
    const similarSongsLoading = useSimilarSongsLoading();
    const requestSimilarSongs = useRequestSimilarSongs();
    const send = useSend();
    const suggestSearch = useSuggestSearch();
    const suggestSearchResults = useSuggestSearchResults();

    const [searchText, setSearchText] = useState('');

    // Debounced search to populate autocomplete from suggestSearchResults
    const debouncedAutocomplete = useMemo(
        () => debounce((query: string) => { if (query.trim().length >= 2) suggestSearch(query); }, 600),
        [suggestSearch],
    );

    const handleAutocompleteChange = useCallback((value: string) => {
        setSearchText(value);
        debouncedAutocomplete(value);
    }, [debouncedAutocomplete]);

    // Build autocomplete data from suggest search results
    const autocompleteData = useMemo(() => {
        return suggestSearchResults.slice(0, 8).map((s) => ({
            label: `${s.name} — ${s.artistName}`,
            value: s.id,
        }));
    }, [suggestSearchResults]);

    const handleSelectSong = useCallback((value: string) => {
        const match = suggestSearchResults.find((s) => s.id === value);
        if (match) {
            setSearchText(match.name);
            requestSimilarSongs(match);
        }
    }, [suggestSearchResults, requestSimilarSongs]);

    const handlePlayNow = useCallback((song: Song) => {
        send({ event: 'queue-add', items: [song], playType: 'now' } as any);
    }, [send]);

    const handlePlayNext = useCallback((song: Song) => {
        send({ event: 'queue-add', items: [song], playType: 'next' } as any);
    }, [send]);

    const handlePlayLast = useCallback((song: Song) => {
        send({ event: 'queue-add', items: [song], playType: 'last' } as any);
    }, [send]);

    const isExternal = (id: string) => id?.startsWith('ext-');
    const isSpotify = (id: string) => id?.startsWith('ext-spotify-');

    return (
        <Stack gap="sm" h="100%">
            <Autocomplete
                data={autocompleteData}
                limit={8}
                onChange={handleAutocompleteChange}
                onOptionSubmit={handleSelectSong}
                placeholder="Search for a song to find similar..."
                value={searchText}
            />
            {similarSongsSeed && (
                <Text isMuted size="xs">
                    Similar to: <strong>{similarSongsSeed.name}</strong>
                    {similarSongsSeed.artistName && ` by ${similarSongsSeed.artistName}`}
                </Text>
            )}
            <Stack gap={0} style={{ flex: 1, overflowY: 'auto' }}>
                {similarSongsLoading && (
                    <Center py="lg">
                        <Text isMuted size="sm">Finding similar songs...</Text>
                    </Center>
                )}
                {!similarSongsLoading && similarSongsSeed && similarSongs.length === 0 && (
                    <Center py="lg">
                        <Text isMuted size="sm">No similar songs found</Text>
                    </Center>
                )}
                {!similarSongsSeed && !similarSongsLoading && (
                    <Center py="lg">
                        <Stack align="center" gap="xs">
                            <Text isMuted size="lg">Suggestions</Text>
                            <Text isMuted size="sm">Search for a song to discover similar tracks</Text>
                        </Stack>
                    </Center>
                )}
                {similarSongs.map((song) => (
                    <Group
                        key={song.id}
                        align="center"
                        gap="xs"
                        px="sm"
                        py="xs"
                        style={{
                            borderRadius: 'var(--mantine-radius-sm)',
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
                ))}
            </Stack>
        </Stack>
    );
};