import { useCallback, useEffect } from 'react';
import formatDuration from 'format-duration';

import { useQueue, useRequestQueue, useSend } from '/@/remote/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

export const QueueView = () => {
    const queue = useQueue();
    const send = useSend();
    const requestQueue = useRequestQueue();

    useEffect(() => {
        requestQueue();
    }, [requestQueue]);

    const handlePlay = useCallback(
        (index: number) => {
            send({ event: 'queue-play', index } as any);
        },
        [send],
    );

    const handleRemove = useCallback(
        (id: string) => {
            send({ event: 'queue-remove', ids: [id] } as any);
        },
        [send],
    );

    if (!queue || queue.items.length === 0) {
        return (
            <Center h="100%">
                <Stack align="center" gap="sm">
                    <Text isMuted size="lg">
                        Queue is empty
                    </Text>
                    <Text isMuted size="sm">
                        Play something from the Search tab
                    </Text>
                </Stack>
            </Center>
        );
    }

    return (
        <Stack gap={0} h="100%" style={{ overflowY: 'auto' }}>
            {queue.items.map((song, index) => {
                const isCurrent = index === queue.index;
                return (
                    <Group
                        key={song._uniqueId || song.id}
                        align="center"
                        gap="xs"
                        onClick={() => handlePlay(index)}
                        px="sm"
                        py="xs"
                        style={{
                            background: isCurrent ? 'var(--theme-colors-primary-translucent)' : undefined,
                            borderRadius: 'var(--mantine-radius-sm)',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }}
                        wrap="nowrap"
                    >
                        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                fw={isCurrent ? 600 : 400}
                                size="sm"
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {isCurrent ? '▶ ' : ''}{song.name}
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
                                {song.artistName}
                            </Text>
                        </Stack>
                        {song.duration > 0 && (
                            <Text isMuted size="xs" style={{ flexShrink: 0 }}>
                                {formatDuration(song.duration)}
                            </Text>
                        )}
                        <ActionIcon
                            icon="delete"
                            iconProps={{ size: 14 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(song.id);
                            }}
                            size="xs"
                            tooltip={{ label: 'Remove from queue' }}
                            variant="transparent"
                        />
                    </Group>
                );
            })}
        </Stack>
    );
};
