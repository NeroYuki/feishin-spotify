import formatDuration from 'format-duration';
import { useCallback } from 'react';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { SpotifyLikeButton } from '/@/renderer/features/spotify/components/spotify-like-button';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useCurrentServer } from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { LibraryItem, ServerType, Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

interface SpotifyTrackListProps {
    onAlbumClick?: (albumId: string) => void;
    onArtistClick?: (artistId: string) => void;
    songs: Song[];
}

interface TrackRowProps {
    index: number;
    serverId: string | undefined;
    song: Song;
    onAlbumClick?: (albumId: string) => void;
    onArtistClick?: (artistId: string) => void;
    onPlay: (song: Song, playType: Play) => void;
}

const TrackRow = ({ index, serverId, song, onAlbumClick, onArtistClick, onPlay }: TrackRowProps) => {
    const handleDownload = useCallback(() => {
        if (!serverId) return;
        // Same as command palette external song play: add to queue with ext-spotify- ID,
        // the player will stream via /rest/stream.view with no Save As dialog.
        // Override _serverId and _serverType so the web player uses the navidrome proxy.
        const extSong: Song = {
            ...song,
            _serverId: serverId,
            _serverType: ServerType.NAVIDROME,
            container: 'navidrome' as Song['container'],
            id: `ext-spotify-${song.id}`,
        };
        onPlay(extSong, Play.NOW);
    }, [song, serverId, onPlay]);
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
            <ItemImage
                enableDebounce={false}
                enableViewport={false}
                id={song.imageId}
                imageContainerProps={{ style: { borderRadius: 4, flexShrink: 0, height: 40, width: 40 } }}
                itemType={LibraryItem.SONG}
                src={song.imageUrl}
            />
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Text overflow="hidden" size="sm">
                    {song.name}
                </Text>
                <Text
                    isMuted
                    overflow="hidden"
                    size="xs"
                    style={onArtistClick ? { cursor: 'pointer' } : undefined}
                    onClick={
                        onArtistClick && song.artists?.[0]?.id
                            ? () => onArtistClick(song.artists![0].id)
                            : undefined
                    }
                >
                    {song.artistName}
                </Text>
            </Stack>
            <Text
                isMuted
                overflow="hidden"
                size="sm"
                style={{
                    maxWidth: 180,
                    ...(onAlbumClick ? { cursor: 'pointer' } : {}),
                }}
                onClick={
                    onAlbumClick && song.albumId
                        ? () => onAlbumClick(song.albumId!)
                        : undefined
                }
            >
                {song.album}
            </Text>
            <Text isMuted size="sm" style={{ flexShrink: 0 }}>
                {formatDuration(song.duration)}
            </Text>
            <Group gap="xs" style={{ flexShrink: 0 }}>
                <SpotifyLikeButton uri={`spotify:track:${song.id}`} />
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
                <ActionIcon
                    icon="download"
                    iconProps={{ size: 'sm' }}
                    size="xs"
                    tooltip={{ label: 'Download', openDelay: 300 }}
                    variant="subtle"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleDownload();
                    }}
                />
            </Group>
        </Group>
    );
};

export const SpotifyTrackList = ({ onAlbumClick, onArtistClick, songs }: SpotifyTrackListProps) => {
    const player = usePlayer();
    const server = useCurrentServer();

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
            <Group gap="sm" pb="sm" px="sm">
                <Button
                    leftSection={<Icon icon="mediaPlay" size="sm" />}
                    size="xs"
                    variant="filled"
                    onClick={() => player.addToQueueByData(songs, Play.NOW)}
                >
                    Play All
                </Button>
                <Button
                    leftSection={<Icon icon="mediaPlayLast" size="sm" />}
                    size="xs"
                    variant="subtle"
                    onClick={() => player.addToQueueByData(songs, Play.LAST)}
                >
                    Queue All
                </Button>
            </Group>
            {songs.map((song, index) => (
                <TrackRow
                    key={song.id}
                    index={index}
                    serverId={server?.id}
                    onAlbumClick={onAlbumClick}
                    onArtistClick={onArtistClick}
                    song={song}
                    onPlay={handlePlay}
                />
            ))}
        </Stack>
    );
};
