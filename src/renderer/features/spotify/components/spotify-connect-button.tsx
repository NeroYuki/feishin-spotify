import isElectron from 'is-electron';
import { IpcRendererEvent } from 'electron';
import { useEffect, useRef, useState } from 'react';

import {
    disconnectSpotify,
    handleSpotifyCallback,
    startSpotifyAuth,
} from '/@/renderer/features/spotify/api/spotify-auth';
import {
    useSpotifyIsAuthenticated,
    useSpotifyUser,
} from '/@/renderer/features/spotify/store/spotify-auth.store';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { TextInput } from '/@/shared/components/text-input/text-input';

export const SpotifyConnectButton = () => {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const user = useSpotifyUser();
    const [showManual, setShowManual] = useState(false);
    const [manualUrl, setManualUrl] = useState('');
    const [manualError, setManualError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Register the IPC listener for the OAuth callback (Electron only).
    // Runs once on mount; cleaned up on unmount.
    useEffect(() => {
        if (!isElectron()) return;

        const handler = (_event: IpcRendererEvent, url: string) => {
            handleSpotifyCallback(url);
        };

        const removeListener = window.api.utils.spotifyAuthCallback(handler);
        return removeListener;
    }, []);

    const handleManualSubmit = async () => {
        setManualError('');
        try {
            await handleSpotifyCallback(manualUrl.trim());
            setShowManual(false);
            setManualUrl('');
        } catch (e: unknown) {
            setManualError(e instanceof Error ? e.message : String(e));
        }
    };

    if (isAuthenticated && user) {
        return (
            <Group align="center" gap="md">
                <Stack gap={2}>
                    <Text fw={500}>{user.displayName || user.id}</Text>
                    <Text isMuted size="sm">
                        Connected to Spotify
                    </Text>
                </Stack>
                <Button size="xs" variant="subtle" onClick={disconnectSpotify}>
                    Disconnect
                </Button>
            </Group>
        );
    }

    if (showManual) {
        return (
            <Stack gap="xs">
                <Text size="sm">
                    After authorizing in the browser, copy the full redirect URL from the address bar and paste it here.
                </Text>
                <TextInput
                    ref={inputRef}
                    placeholder="feishin-dev://spotify/callback?code=..."
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.currentTarget.value)}
                />
                {manualError && (
                    <Text c="red" size="xs">
                        {manualError}
                    </Text>
                )}
                <Group gap="xs">
                    <Button size="xs" variant="filled" onClick={handleManualSubmit}>
                        Submit
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => { setShowManual(false); setManualError(''); }}>
                        Cancel
                    </Button>
                </Group>
            </Stack>
        );
    }

    return (
        <Stack gap="xs">
            <Button size="sm" variant="filled" onClick={startSpotifyAuth}>
                Connect Spotify
            </Button>
            {import.meta.env.DEV && (
                <Button size="xs" variant="subtle" onClick={() => setShowManual(true)}>
                    Paste callback URL manually (dev)
                </Button>
            )}
        </Stack>
    );
};
