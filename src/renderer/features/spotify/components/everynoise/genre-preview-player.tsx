import type { PreviewPlayerState } from '/@/renderer/features/spotify/hooks/use-genre-preview-player';
import type { GenreArtist } from '/@/renderer/features/spotify/api/everynoise-types';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Text } from '/@/shared/components/text/text';

function parseSampleSong(sampleSong: string): { artist: string; title: string } {
    const match = sampleSong.match(/^(.+?)\s*"(.+)"$/);
    return match
        ? { artist: match[1].trim(), title: match[2].trim() }
        : { artist: sampleSong, title: '' };
}

interface Props {
    artists: GenreArtist[] | null;
    state: PreviewPlayerState;
    onPlay: () => void;
    onPause: () => void;
    onSkip: () => void;
}

export function GenrePreviewPlayer({ artists, state, onPlay, onPause, onSkip }: Props) {
    const current =
        state.currentArtistIndex !== null ? artists?.[state.currentArtistIndex] : null;

    const { artist, title } = current
        ? parseSampleSong(current.sample_song)
        : { artist: '', title: '' };

    const isPlaying = state.status === 'playing';
    const isLoading = state.status === 'loading';
    const hasContent = state.status !== 'idle';

    return (
        <Group
            align="center"
            gap="sm"
            px="md"
            py="xs"
            style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 6,
                minHeight: 48,
            }}
            wrap="nowrap"
        >
            <ActionIcon
                disabled={!artists || artists.length === 0}
                loading={isLoading}
                size="md"
                variant="subtle"
                onClick={isPlaying ? onPause : onPlay}
            >
                <Icon icon={isPlaying ? 'mediaPause' : 'mediaPlay'} size="md" />
            </ActionIcon>

            <div style={{ flex: 1, minWidth: 0 }}>
                {hasContent && current ? (
                    <>
                        <Text overflow="hidden" size="sm">
                            {title || current.sample_song}
                        </Text>
                        <Text isMuted overflow="hidden" size="xs">
                            {artist}
                        </Text>
                        {/* Progress bar */}
                        <div
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: 2,
                                height: 2,
                                marginTop: 4,
                                overflow: 'hidden',
                                width: '100%',
                            }}
                        >
                            <div
                                style={{
                                    background: 'var(--mantine-color-primary-5, #1db954)',
                                    height: '100%',
                                    transition: 'width 0.3s linear',
                                    width: `${state.progress * 100}%`,
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <Text isMuted size="xs">
                        No preview available
                    </Text>
                )}
            </div>

            <ActionIcon
                disabled={!artists || artists.length <= 1}
                size="md"
                tooltip={{ label: 'Skip' }}
                variant="subtle"
                onClick={onSkip}
            >
                <Icon icon="mediaNext" size="md" />
            </ActionIcon>
        </Group>
    );
}
