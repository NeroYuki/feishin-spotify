import debounce from 'lodash/debounce';
import { useCallback, useMemo, useState } from 'react';

import {
    useSearch,
    useSearchLoading,
    useSearchQuery,
    useSearchResults,
    useSend,
} from '/@/remote/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Song } from '/@/shared/types/domain-types';

export const SearchView = () => {
    const searchQuery = useSearchQuery();
    const searchResults = useSearchResults();
    const searchLoading = useSearchLoading();
    const search = useSearch();
    const send = useSend();
    const [localQuery, setLocalQuery] = useState(searchQuery);

    const debouncedSearch = useMemo(
        () =>
            debounce((query: string) => {
                search(query);
            }, 400),
        [search],
    );

    const handleQueryChange = useCallback(
        (value: string) => {
            setLocalQuery(value);
            if (value.trim().length >= 2) {
                debouncedSearch(value.trim());
            } else if (!value.trim()) {
                search('');
            }
        },
        [debouncedSearch, search],
    );

    const handlePlayNow = useCallback(
        (song: Song) => {
            send({
                event: 'queue-add',
                items: [song],
                playType: 'now',
            } as any);
        },
        [send],
    );

    const handlePlayNext = useCallback(
        (song: Song) => {
            send({
                event: 'queue-add',
                items: [song],
                playType: 'next',
            } as any);
        },
        [send],
    );

    const handlePlayLast = useCallback(
        (song: Song) => {
            send({
                event: 'queue-add',
                items: [song],
                playType: 'last',
            } as any);
        },
        [send],
    );

    return (
        <Stack gap="sm" h="100%">
            <TextInput
                autoFocus
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search tracks..."
                value={localQuery}
            />
            <Stack gap={0} style={{ flex: 1, overflowY: 'auto' }}>
                {searchLoading && (
                    <Center py="lg">
                        <Text isMuted size="sm">
                            Searching...
                        </Text>
                    </Center>
                )}
                {!searchLoading && searchQuery && searchResults.length === 0 && (
                    <Center py="lg">
                        <Text isMuted size="sm">
                            No results found
                        </Text>
                    </Center>
                )}
                {!searchQuery && !searchLoading && (
                    <Center py="lg">
                        <Text isMuted size="sm">
                            Search for a track to play
                        </Text>
                    </Center>
                )}
                {searchResults.map((song) => (
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
                            <Text
                                size="sm"
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {song.name}
                            </Text>
                            <Text
                                isMuted
                                size="xs"
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {song.artistName} {song.album ? `· ${song.album}` : ''}
                            </Text>
                        </Stack>
                        <Group gap={4} wrap="nowrap">
                            <ActionIcon
                                icon="mediaPlay"
                                iconProps={{ size: 16 }}
                                onClick={() => handlePlayNow(song)}
                                size="sm"
                                tooltip={{ label: 'Play now' }}
                                variant="subtle"
                            />
                            <ActionIcon
                                icon="mediaPlayNext"
                                iconProps={{ size: 16 }}
                                onClick={() => handlePlayNext(song)}
                                size="sm"
                                tooltip={{ label: 'Play next' }}
                                variant="subtle"
                            />
                            <ActionIcon
                                icon="mediaPlayLast"
                                iconProps={{ size: 16 }}
                                onClick={() => handlePlayLast(song)}
                                size="sm"
                                tooltip={{ label: 'Add to end of queue' }}
                                variant="subtle"
                            />
                        </Group>
                    </Group>
                ))}
            </Stack>
        </Stack>
    );
};
