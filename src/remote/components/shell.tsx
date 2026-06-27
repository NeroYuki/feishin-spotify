import { AppShell, Flex, Grid, Image, SegmentedControl } from '@mantine/core';
import { useState } from 'react';

import { ImageButton } from '/@/remote/components/buttons/image-button';
import { ReconnectButton } from '/@/remote/components/buttons/reconnect-button';
import { ThemeButton } from '/@/remote/components/buttons/theme-button';
import { QueueView } from '/@/remote/components/queue-view';
import { RemoteContainer } from '/@/remote/components/remote-container';
import { SearchView } from '/@/remote/components/search-view';
import { useConnected } from '/@/remote/store';
import { Center } from '/@/shared/components/center/center';
import { Group } from '/@/shared/components/group/group';
import { Spinner } from '/@/shared/components/spinner/spinner';

type Tab = 'now-playing' | 'queue' | 'search';

export const Shell = () => {
    const connected = useConnected();
    const [activeTab, setActiveTab] = useState<Tab>('now-playing');

    return (
        <AppShell h="100vh" padding="md" w="100vw">
            <AppShell.Header style={{ background: 'var(--theme-colors-surface)' }}>
                <Grid px="md" py="sm">
                    <Grid.Col span={4}>
                        <Flex
                            align="center"
                            direction="row"
                            h="100%"
                            justify="flex-start"
                            style={{
                                justifySelf: 'flex-start',
                            }}
                        >
                            <Image fit="contain" height={32} src="/favicon.ico" width={32} />
                        </Flex>
                    </Grid.Col>
                    <Grid.Col span={8}>
                        <Group gap="sm" justify="flex-end" wrap="nowrap">
                            <ReconnectButton />
                            <ImageButton />
                            <ThemeButton />
                        </Group>
                    </Grid.Col>
                </Grid>
                <Flex px="md" style={{ paddingBottom: 'var(--mantine-spacing-xs)' }}>
                    <SegmentedControl
                        data={[
                            { label: 'Now Playing', value: 'now-playing' },
                            { label: 'Queue', value: 'queue' },
                            { label: 'Search', value: 'search' },
                        ]}
                        fullWidth
                        onChange={(value) => setActiveTab(value as Tab)}
                        size="xs"
                        value={activeTab}
                    />
                </Flex>
            </AppShell.Header>
            <AppShell.Main style={{ paddingTop: 90, height: '100%' }}>
                {connected ? (
                    <>
                        {activeTab === 'now-playing' && <RemoteContainer />}
                        {activeTab === 'queue' && <QueueView />}
                        {activeTab === 'search' && <SearchView />}
                    </>
                ) : (
                    <Center h="100vh" w="100vw">
                        <Spinner />
                    </Center>
                )}
            </AppShell.Main>
        </AppShell>
    );
};
