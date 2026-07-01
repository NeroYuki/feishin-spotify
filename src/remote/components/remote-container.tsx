import formatDuration from 'format-duration';
import debounce from 'lodash/debounce';
import { useCallback } from 'react';
import { RiPauseFill, RiPlayFill, RiVolumeUpFill } from 'react-icons/ri';
import { useMediaQuery } from '@mantine/hooks';

import { PlayerImage } from '/@/remote/components/player-image';
import { WrappedSlider } from '/@/remote/components/wrapped-slider';
import { SongContextMenu } from '/@/remote/components/song-context-menu';
import { useInfo, useSend, useShowImage } from '/@/remote/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { Rating } from '/@/shared/components/rating/rating';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Tooltip } from '/@/shared/components/tooltip/tooltip';
import { PlayerRepeat, PlayerStatus } from '/@/shared/types/types';

export const RemoteContainer = () => {
    const { position, repeat, shuffle, song, status, volume } = useInfo();
    const send = useSend();
    const showImage = useShowImage();
    const isMobile = useMediaQuery('(max-width: 600px)');

    const id = song?.id;

    const setRating = useCallback(
        (rating: number) => {
            send({ event: 'rating', id: id!, rating });
        },
        [send, id],
    );

    const debouncedSetRating = debounce(setRating, 400);

    const isExternal = id?.startsWith('ext-');
    const isSpotify = id?.startsWith('ext-spotify-');

    const albumArtSection = showImage ? (
        <Flex
            align="center"
            justify="center"
            style={isMobile ? { aspectRatio: '1', width: '100%', maxWidth: 320, alignSelf: 'center' } : { flex: '0 0 40%', maxWidth: 360 }}
        >
            <div style={isMobile ? { width: '100%', height: '100%', display: 'flex' } : { width: '100%' }}>
                <PlayerImage src={song?.imageUrl} />
            </div>
        </Flex>
    ) : null;

    const infoSection = (
        <Stack gap={isMobile ? 'xs' : 'sm'} style={isMobile ? { width: '100%' } : { flex: 1, minWidth: 0 }}>
            {id ? (
                <>
                    <Group gap="xs" justify="space-between" wrap="nowrap">
                        <Group gap={4} wrap="nowrap">
                            {isSpotify && (
                                <Text isMuted size="xs" style={{ flexShrink: 0 }}>🟢</Text>
                            )}
                            {isExternal && !isSpotify && (
                                <Text isMuted size="xs" style={{ flexShrink: 0 }}>🌐</Text>
                            )}
                        </Group>
                        {song && <SongContextMenu song={song} forceShow />}
                    </Group>
                    <Text
                        fw={700}
                        size={isMobile ? 'lg' : 'xl'}
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
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {song.artistName}
                    </Text>
                    {song.album && (
                        <Text
                            isMuted
                            size="sm"
                            style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {song.album}
                        </Text>
                    )}
                    <Group gap="md">
                        {song.releaseDate && (
                            <Text isMuted size="xs">{new Date(song.releaseDate).toLocaleDateString()}</Text>
                        )}
                        {song.duration > 0 && (
                            <Text isMuted size="xs">{formatDuration(song.duration)}</Text>
                        )}
                        <Text isMuted size="xs">Plays: {song.playCount || 0}</Text>
                    </Group>
                </>
            ) : (
                <Stack align="center" gap="xs" py="md">
                    <Text fw={600} size="lg">No track playing</Text>
                    <Text isMuted size="sm">Queue a song from Search or Suggestions</Text>
                </Stack>
            )}

            <Group gap={0} grow>
                <ActionIcon
                    disabled={!id}
                    icon="favorite"
                    iconProps={{ fill: song?.userFavorite ? 'primary' : 'default' }}
                    onClick={() => { if (!id) return; send({ event: 'favorite', favorite: !song.userFavorite, id }); }}
                    tooltip={{ label: song?.userFavorite ? 'Unfavorite' : 'Favorite' }}
                    variant="transparent"
                />
                {(song?._serverType === 'navidrome' || song?._serverType === 'subsonic') && (
                    <div style={{ margin: 'auto' }}>
                        <Tooltip label="Double click to clear" openDelay={1000}>
                            <Rating
                                onChange={debouncedSetRating}
                                onDoubleClick={() => debouncedSetRating(0)}
                                style={{ margin: 'auto' }}
                                value={song.userRating ?? 0}
                            />
                        </Tooltip>
                    </div>
                )}
            </Group>

            <Group gap="xs" grow>
                <ActionIcon
                    disabled={!id}
                    icon="mediaPrevious"
                    iconProps={{ fill: 'default', size: 'lg' }}
                    onClick={() => send({ event: 'previous' })}
                    tooltip={{ label: 'Previous track' }}
                    variant="default"
                />
                <ActionIcon
                    disabled={!id}
                    onClick={() => {
                        if (status === PlayerStatus.PLAYING) send({ event: 'pause' });
                        else if (status === PlayerStatus.PAUSED) send({ event: 'play' });
                    }}
                    tooltip={{ label: id && status === PlayerStatus.PLAYING ? 'Pause' : 'Play' }}
                    variant="filled"
                >
                    {id && status === PlayerStatus.PLAYING ? (
                        <RiPauseFill size={30} />
                    ) : (
                        <RiPlayFill size={30} />
                    )}
                </ActionIcon>
                <ActionIcon
                    disabled={!id}
                    icon="mediaNext"
                    iconProps={{ fill: 'default', size: 'lg' }}
                    onClick={() => send({ event: 'next' })}
                    tooltip={{ label: 'Next track' }}
                    variant="default"
                />
            </Group>

            <Group gap="xs" grow>
                <ActionIcon
                    icon="mediaShuffle"
                    iconProps={{ fill: shuffle ? 'primary' : 'default', size: 'lg' }}
                    onClick={() => send({ event: 'shuffle' })}
                    tooltip={{ label: shuffle ? 'Shuffle on' : 'Shuffle off' }}
                    variant="default"
                />
                <ActionIcon
                    icon={repeat === undefined || repeat === PlayerRepeat.ONE ? 'mediaRepeatOne' : 'mediaRepeat'}
                    iconProps={{
                        fill: repeat !== undefined && repeat !== PlayerRepeat.NONE ? 'primary' : 'default',
                        size: 'lg',
                    }}
                    onClick={() => send({ event: 'repeat' })}
                    tooltip={{
                        label: `Repeat ${repeat === PlayerRepeat.ONE ? 'One' : repeat === PlayerRepeat.ALL ? 'all' : 'none'}`,
                    }}
                    variant="default"
                />
            </Group>

            <Stack gap="lg">
                {id && position !== undefined && (
                    <WrappedSlider
                        label={(value) => formatDuration(value * 1e3)}
                        leftLabel={formatDuration(position * 1e3)}
                        max={song.duration / 1e3}
                        onChangeEnd={(e) => send({ event: 'position', position: e })}
                        rightLabel={formatDuration(song.duration)}
                        value={position}
                    />
                )}
                <WrappedSlider
                    leftLabel={<RiVolumeUpFill size={20} />}
                    max={100}
                    onChangeEnd={(e) => send({ event: 'volume', volume: e })}
                    rightLabel={<Text fw={600} size="xs">{volume ?? 0}</Text>}
                    value={volume ?? 0}
                />
            </Stack>
        </Stack>
    );

    // Desktop: 2-column layout (art left, info right)
    // Mobile: 1-column layout (art top, info bottom)
    if (isMobile) {
        return (
            <Stack align="center" gap="sm" h="100%" style={{ overflowY: 'auto', paddingTop: 0 }}>
                {albumArtSection}
                {infoSection}
            </Stack>
        );
    }

    return (
        <Group align="flex-start" gap="md" h="100%" style={{ overflowY: 'auto', paddingTop: 0 }} wrap="nowrap">
            {albumArtSection}
            {infoSection}
        </Group>
    );
};
