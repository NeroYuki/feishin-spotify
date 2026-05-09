import type { WalkMode, WalkSettings } from '/@/renderer/features/spotify/hooks/use-genre-walk';
import { WALK_RANDOMNESS_POOLS } from '/@/renderer/features/spotify/components/everynoise/genre-scatter-helpers';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { Slider } from '/@/shared/components/slider/slider';
import { Text } from '/@/shared/components/text/text';

const RANDOMNESS_LABELS = ['Nearest', 'Low', 'Medium', 'High', 'Very High', 'Max'] as const;

interface Props {
    mode: WalkMode;
    settings: WalkSettings;
    walkedCount: number;
    onStartRandom: () => void;
    onStartRelated: () => void;
    onStop: () => void;
    onUpdateSettings: (patch: Partial<WalkSettings>) => void;
}

export function GenreWalkControls({
    mode,
    settings,
    walkedCount,
    onStartRandom,
    onStartRelated,
    onStop,
    onUpdateSettings,
}: Props) {
    const isActive = mode !== 'idle';

    return (
        <Group
            gap="xs"
            style={{ alignItems: 'center', flexWrap: 'nowrap' }}
        >
            {/* Walk mode buttons */}
            <Button
                size="xs"
                variant={mode === 'random' ? 'filled' : 'light'}
                onClick={isActive ? undefined : onStartRandom}
                style={{ opacity: mode === 'related' ? 0.4 : 1 }}
            >
                Random Walk
            </Button>

            <Button
                size="xs"
                variant={mode === 'related' ? 'filled' : 'light'}
                onClick={isActive ? undefined : onStartRelated}
                style={{ opacity: mode === 'random' ? 0.4 : 1 }}
            >
                Related Walk
            </Button>

            {isActive && (
                <Button
                    color="red"
                    size="xs"
                    variant="light"
                    onClick={onStop}
                >
                    Stop
                </Button>
            )}

            {isActive && (
                <Text isMuted size="xs">
                    {walkedCount} visited
                </Text>
            )}

            <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--mantine-color-default-border)', margin: '0 4px' }} />

            {/* Songs per genre */}
            <Group gap={4} style={{ alignItems: 'center', flexShrink: 0 }}>
                <Text isMuted size="xs" style={{ whiteSpace: 'nowrap' }}>Songs/genre</Text>
                <NumberInput
                    max={10}
                    min={1}
                    size="xs"
                    style={{ width: 64 }}
                    value={settings.songsPerGenre}
                    onChange={(v) => onUpdateSettings({ songsPerGenre: typeof v === 'number' ? Math.max(1, Math.min(10, v)) : 1 })}
                />
            </Group>

            {/* Max duration per song */}
            <Group gap={4} style={{ alignItems: 'center', flexShrink: 0 }}>
                <Text isMuted size="xs" style={{ whiteSpace: 'nowrap' }}>Limit</Text>
                <NumberInput
                    max={30}
                    min={0}
                    size="xs"
                    style={{ width: 64 }}
                    value={settings.maxSongDuration}
                    onChange={(v) => onUpdateSettings({ maxSongDuration: typeof v === 'number' ? Math.max(0, Math.min(30, v)) : 0 })}
                />
                <Text isMuted size="xs">{settings.maxSongDuration === 0 ? 'full' : 's'}</Text>
            </Group>

            {/* Randomness slider — only meaningful for related walk */}
            <Group gap={4} style={{ alignItems: 'center', flexShrink: 0, minWidth: 260 }}>
                <div style={{ display: 'flex', flexShrink: 0, gap: 4, width: 148 }}>
                    <Text isMuted size="xs" style={{ whiteSpace: 'nowrap' }}>Wander:</Text>
                    <Text isMuted size="xs" style={{ display: 'inline-block', minWidth: 60, whiteSpace: 'nowrap' }}>
                        {RANDOMNESS_LABELS[settings.randomness]}
                    </Text>
                    <Text isMuted size="xs" style={{ display: 'inline-block', minWidth: 40, opacity: 0.5, whiteSpace: 'nowrap' }}>
                        ±{WALK_RANDOMNESS_POOLS[settings.randomness]}
                    </Text>
                </div>
                <Slider
                    max={5}
                    min={0}
                    size="xs"
                    step={1}
                    style={{ flex: 1, minWidth: 80 }}
                    value={settings.randomness}
                    onChange={(v) => onUpdateSettings({ randomness: v })}
                />
            </Group>
        </Group>
    );
}
