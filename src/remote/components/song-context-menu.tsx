import { useCallback } from 'react';
import { Menu } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

import {
    useSetActiveTab,
    useSetModalView,
    useRequestSimilarSongs,
    useRequestSameArtist,
    useRequestSameAlbum,
    useSend,
} from '/@/remote/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Song } from '/@/shared/types/domain-types';

interface SongContextMenuProps {
    song: Song;
    /** When true, renders as a kebab button. When false, render nothing (caller uses onContextMenu/onLongPress). */
    showButton?: boolean;
    /** Force the kebab button to show regardless of screen width (for Now Playing view). */
    forceShow?: boolean;
}

export const SongContextMenu = ({ song, showButton = true, forceShow = false }: SongContextMenuProps) => {
    const send = useSend();
    const requestSimilarSongs = useRequestSimilarSongs();
    const requestSameArtist = useRequestSameArtist();
    const requestSameAlbum = useRequestSameAlbum();
    const setActiveTab = useSetActiveTab();
    const setModalView = useSetModalView();
    const isNarrow = useMediaQuery('(max-width: 768px)');

    const handlePlayNow = useCallback(() => {
        send({ event: 'queue-add', items: [song], playType: 'now' } as any);
    }, [song, send]);

    const handlePlayNext = useCallback(() => {
        send({ event: 'queue-add', items: [song], playType: 'next' } as any);
    }, [song, send]);

    const handlePlayLast = useCallback(() => {
        send({ event: 'queue-add', items: [song], playType: 'last' } as any);
    }, [song, send]);

    const handleSimilarSongs = useCallback(() => {
        requestSimilarSongs(song);
        setActiveTab('suggestions');
    }, [song, requestSimilarSongs, setActiveTab]);

    const handleSameArtist = useCallback(() => {
        requestSameArtist(song.artistName);
        setModalView('same-artist');
    }, [song.artistName, requestSameArtist, setModalView]);

    const handleSameAlbum = useCallback(() => {
        if (song.album) {
            requestSameAlbum(song.album);
            setModalView('same-album');
        }
    }, [song.album, requestSameAlbum, setModalView]);

    // On narrow screens, don't render the visible kebab button (unless forced).
    // The parent should use onContextMenu + the static openContextMenu helper.
    if (!showButton || (!forceShow && isNarrow)) return null;

    return (
        <Menu position="bottom-end" shadow="md" width={200}>
            <Menu.Target>
                <ActionIcon
                    icon="ellipsisVertical"
                    iconProps={{ size: 16 }}
                    size="sm"
                    tooltip={{ label: 'More options' }}
                    variant="subtle"
                />
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item leftSection={<span style={{ fontSize: 14 }}>▶</span>} onClick={handlePlayNow}>
                    Play now
                </Menu.Item>
                <Menu.Item leftSection={<span style={{ fontSize: 14 }}>⏭</span>} onClick={handlePlayNext}>
                    Play next
                </Menu.Item>
                <Menu.Item leftSection={<span style={{ fontSize: 14 }}>⏬</span>} onClick={handlePlayLast}>
                    Add to end
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<span style={{ fontSize: 14 }}>🔀</span>} onClick={handleSimilarSongs}>
                    Get similar songs
                </Menu.Item>
                <Menu.Item leftSection={<span style={{ fontSize: 14 }}>👤</span>} onClick={handleSameArtist}>
                    Songs from same artist
                </Menu.Item>
                {song.album && (
                    <Menu.Item leftSection={<span style={{ fontSize: 14 }}>💿</span>} onClick={handleSameAlbum}>
                        Songs from same album
                    </Menu.Item>
                )}
            </Menu.Dropdown>
        </Menu>
    );
};