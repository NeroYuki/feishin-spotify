import { useCallback } from 'react';
import { Modal } from '@mantine/core';
import formatDuration from 'format-duration';

import {
    useModalView,
    useSetModalView,
    useSameArtistSongs,
    useSameArtistName,
    useSameArtistLoading,
    useSameArtistTruncated,
    useSameAlbumSongs,
    useSameAlbumName,
    useSameAlbumLoading,
    useSameAlbumTruncated,
    useSend,
} from '/@/remote/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Song } from '/@/shared/types/domain-types';

export const SameArtistAlbumModal = () => {
    const modalView = useModalView();
    const setModalView = useSetModalView();
    const send = useSend();

    const artistSongs = useSameArtistSongs();
    const artistName = useSameArtistName();
    const artistLoading = useSameArtistLoading();
    const artistTruncated = useSameArtistTruncated();

    const albumSongs = useSameAlbumSongs();
    const albumName = useSameAlbumName();
    const albumLoading = useSameAlbumLoading();
    const albumTruncated = useSameAlbumTruncated();

    const isArtist = modalView === 'same-artist';
    const isAlbum = modalView === 'same-album';
    const open = isArtist || isAlbum;

    const songs = isArtist ? artistSongs : albumSongs;
    const name = isArtist ? artistName : albumName;
    const loading = isArtist ? artistLoading : albumLoading;
    const truncated = isArtist ? artistTruncated : albumTruncated;
    const title = isArtist ? `Songs by ${name}` : `Songs from ${name}`;

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
        <Modal
            onClose={() => setModalView(null)}
            opened={open}
            size="lg"
            title={title}
        >
            {truncated && (
                <Text isMuted mb="sm" size="xs">
                    ⚠ Showing 100 random results (more than 100 songs found)
                </Text>
            )}
            <Stack gap={0} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {loading && (
                    <Center py="lg">
                        <Text isMuted size="sm">Loading...</Text>
                    </Center>
                )}
                {!loading && songs.length === 0 && (
                    <Center py="lg">
                        <Text isMuted size="sm">No songs found</Text>
                    </Center>
                )}
                {songs.map((song) => (
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
                                    <Text isMuted size="xs" style={{ flexShrink: 0 }}>🟢</Text>
                                )}
                                {isExternal(song.id) && !isSpotify(song.id) && (
                                    <Text isMuted size="xs" style={{ flexShrink: 0 }}>🌐</Text>
                                )}
                                <Text size="sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {song.name}
                                </Text>
                            </Group>
                            <Group gap={4} wrap="nowrap">
                                <Text isMuted size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {song.artistName}
                                </Text>
                                {song.duration > 0 && (
                                    <Text isMuted size="xs" style={{ flexShrink: 0 }}>
                                        {formatDuration(song.duration)}
                                    </Text>
                                )}
                            </Group>
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
        </Modal>
    );
};