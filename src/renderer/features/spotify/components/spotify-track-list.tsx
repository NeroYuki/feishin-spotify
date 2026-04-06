import formatDuration from 'format-duration';
import { useCallback } from 'react';

import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

interface SpotifyTrackListProps {
    songs: Song[];
}

interface TrackRowProps {
    index: number;
    song: Song;
    onPlay: (song: Song, playType: Play) => void;
}

const TrackRow = ({ index, song, onPlay }: TrackRowProps) => {
    return (
        <Group
            align="center"
            gap="md"
            px="sm"
            py="xs"
            style={{
                borderBottom: '1px solid var(--mantine-color-dark-6)',
                cursor: 'default',
            }}
            wrap="nowrap"
        >
            <Text isMuted size="sm" style={{ minWidth: 24, textAlign: 'right' }}>
                {index + 1}
            </Text>
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Text overflow="hidden" size="sm">
                    {song.name}
                </Text>
                <Text isMuted overflow="hidden" size="xs">
                    {song.artistName}
                </Text>
            </Stack>
            <Text isMuted overflow="hidden" size="sm" style={{ maxWidth: 180 }}>
                {song.album}
            </Text>
            <Text isMuted size="sm" style={{ flexShrink: 0 }}>
                {formatDuration(song.duration)}
            </Text>
            <Group gap="xs" style={{ flexShrink: 0 }}>
                <ActionIcon
                    icon="mediaPlay"
                    iconProps={{ size: 'sm' }}
                    size="xs"
                    tooltip={{ label: 'Play now', openDelay: 300 }}
                    variant="subtle"
                    onClick={() => onPlay(song, Play.NOW)}
                />
                <ActionIcon
                    icon="mediaPlayNext"
                    iconProps={{ size: 'sm' }}
                    size="xs"
                    tooltip={{ label: 'Play next', openDelay: 300 }}
                    variant="subtle"
                    onClick={() => onPlay(song, Play.NEXT)}
                />
                <ActionIcon
                    icon="mediaPlayLast"
                    iconProps={{ size: 'sm' }}
                    size="xs"
                    tooltip={{ label: 'Add to queue', openDelay: 300 }}
                    variant="subtle"
                    onClick={() => onPlay(song, Play.LAST)}
                />
            </Group>
        </Group>
    );
};

export const SpotifyTrackList = ({ songs }: SpotifyTrackListProps) => {
    const player = usePlayer();

    const handlePlay = useCallback(
        (song: Song, playType: Play) => {
            player.addToQueueByData([song], playType);
        },
        [player],
    );

    if (songs.length === 0) {
        return (
            <Text isMuted ta="center" py="xl">
                No tracks found
            </Text>
        );
    }

    return (
        <Stack gap={0}>
            {songs.map((song, index) => (
                <TrackRow
                    key={song.id}
                    index={index}
                    song={song}
                    onPlay={handlePlay}
                />
            ))}
        </Stack>
    );
};
