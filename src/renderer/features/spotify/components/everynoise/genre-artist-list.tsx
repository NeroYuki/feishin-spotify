import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import { normalizeSpotifyTrack } from '/@/renderer/api/spotify/spotify-normalize';
import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import type { GenreArtist } from '/@/renderer/features/spotify/api/everynoise-types';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useCurrentServer } from '/@/renderer/store';
import type { PreviewPlayerState } from '/@/renderer/features/spotify/hooks/use-genre-preview-player';
import { AppRoute } from '/@/renderer/router/routes';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { ServerType } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';
import { toast } from '/@/shared/components/toast/toast';

function parseSampleSong(sampleSong: string): { artist: string; title: string } {
    const match = sampleSong.match(/^(.+?)\s*"(.+)"$/);
    return match
        ? { artist: match[1].trim(), title: match[2].trim() }
        : { artist: sampleSong, title: '' };
}

interface Props {
    artists: GenreArtist[];
    playerState: PreviewPlayerState;
    onPlayPreview: (index: number) => void;
}

export function GenreArtistList({ artists, playerState, onPlayPreview }: Props) {
    const server = useCurrentServer();
    const navigate = useNavigate();
    const player = usePlayer();
    const [queuingIndex, setQueuingIndex] = useState<number | null>(null);

    const handleDownload = useCallback(
        async (entry: GenreArtist) => {
            // Same as command palette external song play: fetch track, normalize
            // with ext-spotify- ID, and play — player streams via /rest/stream.view.
            // Override _serverType so the web player handles it instead of Spotify player.
            try {
                const track = await spotifyApiClient.getTrack(entry.track_id);
                const song = normalizeSpotifyTrack(track);
                const extSong = {
                    ...song,
                    _serverId: server?.id || '',
                    _serverType: ServerType.NAVIDROME as const,
                    container: 'navidrome' as const,
                    id: `ext-spotify-${entry.track_id}`,
                };
                player.addToQueueByData([extSong], Play.NOW);
                toast.show({ message: `Downloading "${song.name}"`, title: 'Download' });
            } catch {
                toast.error({ message: 'Failed to start download' });
            }
        },
        [player],
    );

    const handleAddToQueue = useCallback(
        async (entry: GenreArtist, index: number) => {
            setQueuingIndex(index);
            try {
                let track;
                if (entry.track_id) {
                    track = await spotifyApiClient.getTrack(entry.track_id);
                } else {
                    const { artist, title } = parseSampleSong(entry.sample_song);
                    const query = title ? `track:${title} artist:${artist}` : artist;
                    const results = await spotifyApiClient.search(query, ['track'], 1, 0);
                    track = results.tracks?.items?.[0];
                    if (!track) {
                        toast.warn({
                            message: `"${title || entry.sample_song}" by ${artist}`,
                            title: 'Track not found on Spotify',
                        });
                        return;
                    }
                }
                const song = normalizeSpotifyTrack(track);
                player.addToQueueByData([song], Play.LAST);
                toast.show({ message: `Added "${song.name}" to queue`, title: 'Queue' });
            } catch {
                toast.error({ message: 'Failed to add track to queue' });
            } finally {
                setQueuingIndex(null);
            }
        },
        [player],
    );

    const handleOpenArtist = useCallback(
        (artistId: string) => {
            navigate(AppRoute.SPOTIFY_ARTIST_DETAIL.replace(':artistId', artistId));
        },
        [navigate],
    );

    return (
        <Stack gap={0}>
            {artists.map((entry, index) => {
                const isPlaying =
                    playerState.currentArtistIndex === index && playerState.status === 'playing';
                const isLoading =
                    playerState.currentArtistIndex === index && playerState.status === 'loading';

                const { artist, title } = parseSampleSong(entry.sample_song);

                return (
                    <Group
                        key={`${entry.artist_id}-${index}`}
                        align="center"
                        gap="sm"
                        px="xs"
                        py={6}
                        style={{
                            background:
                                playerState.currentArtistIndex === index
                                    ? 'rgba(255,255,255,0.05)'
                                    : 'transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                        wrap="nowrap"
                    >
                        {/* Preview play/loading indicator */}
                        <ActionIcon
                            disabled={!entry.preview_url}
                            loading={isLoading}
                            size="sm"
                            variant="subtle"
                            onClick={() => onPlayPreview(index)}
                        >
                            <Icon icon={isPlaying ? 'volumeMax' : 'mediaPlay'} size="sm" />
                        </ActionIcon>

                        {/* Artist + song info */}
                        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                            <Text overflow="hidden" size="sm">
                                {title || entry.sample_song}
                            </Text>
                            <Text isMuted overflow="hidden" size="xs">
                                {artist}
                            </Text>
                        </Stack>

                        {/* Open artist */}
                        <ActionIcon
                            size="sm"
                            tooltip={{ label: 'Open artist' }}
                            variant="subtle"
                            onClick={() => handleOpenArtist(entry.artist_id)}
                        >
                            <Icon icon="user" size="sm" />
                        </ActionIcon>

                        {/* Download (only if track_id available) */}
                        {entry.track_id && (
                            <ActionIcon
                                size="sm"
                                tooltip={{ label: 'Download' }}
                                variant="subtle"
                                onClick={() => handleDownload(entry)}
                            >
                                <Icon icon="download" size="sm" />
                            </ActionIcon>
                        )}

                        {/* Add to queue */}
                        <ActionIcon
                            loading={queuingIndex === index}
                            size="sm"
                            tooltip={{ label: 'Add to queue' }}
                            variant="subtle"
                            onClick={() => handleAddToQueue(entry, index)}
                        >
                            <Icon icon="mediaNext" size="sm" />
                        </ActionIcon>
                    </Group>
                );
            })}
        </Stack>
    );
}
