import { forwardRef, useImperativeHandle, useState } from 'react';

import {
    audioMuseAIClient,
    AudioMuseTrack,
} from '/@/renderer/api/audiomuse-ai/audiomuse-ai-client';
import { useCurrentServer, useCurrentServerWithCredential } from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Checkbox } from '/@/shared/components/checkbox/checkbox';
import { Group } from '/@/shared/components/group/group';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Select } from '/@/shared/components/select/select';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Textarea } from '/@/shared/components/textarea/textarea';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { toast } from '/@/shared/components/toast/toast';

export type SonicMethod =
    | 'instant'
    | 'lyric-search'
    | 'sem-grove'
    | 'song-alchemy'
    | 'song-path'
    | 'sonic-fingerprint'
    | 'text-search';

interface AlchemyItem {
    id: string;
    label: string;
    op: 'ADD' | 'SUBTRACT';
    type: 'artist' | 'song';
}

export interface SonicAnalysisPlaylistFormRef {
    getResults: () => AudioMuseTrack[];
}

interface SonicAnalysisPlaylistFormProps {
    onResultsChange?: (tracks: AudioMuseTrack[]) => void;
}

const METHOD_LABELS: Record<SonicMethod, string> = {
    instant: 'Instant Playlist (AI)',
    'lyric-search': 'Lyric Search',
    'sem-grove': 'SemGrove Search (By Song)',
    'song-alchemy': 'Song Alchemy',
    'song-path': 'Song Path',
    'sonic-fingerprint': 'Sonic Fingerprint (Personal)',
    'text-search': 'Text Search',
};

const METHOD_OPTIONS = Object.entries(METHOD_LABELS).map(([value, label]) => ({
    label,
    value,
}));

// Debounced track search hook
function useTrackSearch(baseUrl: string | undefined, token: string | undefined) {
    const [results, setResults] = useState<AudioMuseTrack[]>([]);
    const [loading, setLoading] = useState(false);

    const search = async (query: string) => {
        if (!baseUrl || !query || query.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const tracks = await audioMuseAIClient.searchTracks({
                baseUrl,
                limit: 20,
                query,
                token: token || '',
            });
            setResults(tracks);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return { loading, results, search };
}

// Small component: song search picker that returns an AudioMuseTrack
function SongPicker({
    label,
    onSelect,
    selected,
    baseUrl,
    token,
}: {
    baseUrl: string | undefined;
    label: string;
    onSelect: (track: AudioMuseTrack) => void;
    selected: AudioMuseTrack | null;
    token: string | undefined;
}) {
    const [query, setQuery] = useState('');
    const { results, search } = useTrackSearch(baseUrl, token);
    const [showDropdown, setShowDropdown] = useState(false);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        setShowDropdown(true);
        search(val);
    };

    const handleSelect = (track: AudioMuseTrack) => {
        onSelect(track);
        setQuery('');
        setShowDropdown(false);
    };

    return (
        <Stack gap={4}>
            <Text size="sm">{label}</Text>
            {selected && (
                <Group gap="xs">
                    <Text size="sm" fw={600}>
                        {selected.title}
                    </Text>
                    <Text size="sm" c="dimmed">
                        – {selected.author}
                    </Text>
                    <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={() => onSelect(null as any)}
                    >
                        ✕
                    </ActionIcon>
                </Group>
            )}
            {!selected && (
                <div style={{ position: 'relative' }}>
                    <TextInput
                        placeholder="Search by title or artist…"
                        value={query}
                        onChange={(e) => handleQueryChange(e.currentTarget.value)}
                        onFocus={() => query && setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    />
                    {showDropdown && results.length > 0 && (
                        <div
                            style={{
                                background: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
                                border: '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
                                borderRadius: 4,
                                left: 0,
                                maxHeight: 200,
                                overflowY: 'auto',
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                zIndex: 200,
                            }}
                        >
                            {results.map((t) => (
                                <div
                                    key={t.item_id}
                                    onMouseDown={() => handleSelect(t)}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '6px 10px',
                                    }}
                                >
                                    <Text size="sm">{t.title}</Text>
                                    <Text size="xs" c="dimmed">
                                        {t.author} {t.album ? `· ${t.album}` : ''}
                                    </Text>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Stack>
    );
}

// Alchemy item row
function AlchemyItemRow({
    item,
    onRemove,
    onToggleOp,
}: {
    item: AlchemyItem;
    onRemove: () => void;
    onToggleOp: () => void;
}) {
    return (
        <Group gap="xs" wrap="nowrap">
            <Button
                size="compact-xs"
                variant={item.op === 'ADD' ? 'filled' : 'outline'}
                color={item.op === 'ADD' ? 'blue' : 'red'}
                onClick={onToggleOp}
                style={{ minWidth: 70 }}
            >
                {item.op}
            </Button>
            <Text size="sm" style={{ flex: 1 }}>
                {item.label}
            </Text>
            <Text size="xs" c="dimmed">
                ({item.type})
            </Text>
            <ActionIcon size="xs" variant="subtle" color="red" onClick={onRemove}>
                ✕
            </ActionIcon>
        </Group>
    );
}

export const SonicAnalysisPlaylistForm = forwardRef<
    SonicAnalysisPlaylistFormRef,
    SonicAnalysisPlaylistFormProps
>(({ onResultsChange }, ref) => {
    const server = useCurrentServer();
    const serverWithCredential = useCurrentServerWithCredential();
    const baseUrl = server?.audioMuseAIUrl;
    const token = server?.audioMuseAIToken || '';

    const [method, setMethod] = useState<SonicMethod>('instant');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<AudioMuseTrack[]>([]);

    // Shared song count
    const [songCount, setSongCount] = useState<number>(100);

    // Instant Playlist state
    const [instantPrompt, setInstantPrompt] = useState('');

    // Song Path state
    const [pathStart, setPathStart] = useState<AudioMuseTrack | null>(null);
    const [pathEnd, setPathEnd] = useState<AudioMuseTrack | null>(null);
    const [pathSteps, setPathSteps] = useState<number>(10);
    const [pathFixSize, setPathFixSize] = useState<boolean>(false);

    // Song Alchemy state
    const [alchemyItems, setAlchemyItems] = useState<AlchemyItem[]>([]);
    const [alchemyQuery, setAlchemyQuery] = useState('');
    const [alchemyN, setAlchemyN] = useState<number>(50);
    const [alchemyTemperature, setAlchemyTemperature] = useState<number>(1.0);
    const [alchemySubtractDistance, setAlchemySubtractDistance] = useState<number>(0);
    const { results: alchemySearchResults, search: alchemySearch } = useTrackSearch(
        baseUrl,
        token,
    );
    const [showAlchemyDropdown, setShowAlchemyDropdown] = useState(false);

    // Text Search state
    const [textQuery, setTextQuery] = useState('');
    const [textLimit, setTextLimit] = useState<number>(50);

    // Lyric Search state
    const [lyricQuery, setLyricQuery] = useState('');
    const [lyricLimit, setLyricLimit] = useState<number>(50);

    // SemGrove Search state
    const [semGroveSong, setSemGroveSong] = useState<AudioMuseTrack | null>(null);

    // Sonic Fingerprint state
    const [fingerprintN, setFingerprintN] = useState<number>(100);

    useImperativeHandle(ref, () => ({
        getResults: () => results,
    }));

    const setAndNotify = (tracks: AudioMuseTrack[]) => {
        setResults(tracks);
        onResultsChange?.(tracks);
    };

    const handleGenerate = async () => {
        if (!baseUrl) {
            toast.error({ message: 'No AudioMuse-AI server configured for this server.' });
            return;
        }

        setIsLoading(true);
        setAndNotify([]);

        try {
            let tracks: AudioMuseTrack[] = [];

            switch (method) {
                case 'instant': {
                    if (!instantPrompt.trim()) {
                        toast.error({ message: 'Please enter a playlist description.' });
                        return;
                    }
                    tracks = await audioMuseAIClient.instantPlaylist({
                        aiModel: 'gemma-4-e4b-it',
                        aiProvider: 'OPENAI',
                        baseUrl,
                        limit: songCount,
                        openaiServerUrl: 'http://192.168.1.2:1234/v1/chat/completions',
                        token,
                        userInput: instantPrompt.trim(),
                    });
                    break;
                }

                case 'song-path': {
                    if (!pathStart || !pathEnd) {
                        toast.error({ message: 'Please select a start and end song.' });
                        return;
                    }
                    tracks = await audioMuseAIClient.songPath({
                        baseUrl,
                        endSongId: pathEnd.item_id,
                        maxSteps: pathSteps,
                        pathFixSize,
                        startSongId: pathStart.item_id,
                        token,
                    });
                    break;
                }

                case 'song-alchemy': {
                    const addItems = alchemyItems.filter((i) => i.op === 'ADD');
                    if (addItems.length === 0) {
                        toast.error({
                            message: 'Song Alchemy requires at least one ADD song or artist.',
                        });
                        return;
                    }
                    tracks = await audioMuseAIClient.songAlchemy({
                        baseUrl,
                        items: alchemyItems.map((i) => ({
                            id: i.id,
                            op: i.op,
                            type: i.type,
                        })),
                        n: alchemyN,
                        subtractDistance: alchemySubtractDistance || undefined,
                        temperature: alchemyTemperature !== 1.0 ? alchemyTemperature : undefined,
                        token,
                    });
                    break;
                }

                case 'text-search': {
                    if (!textQuery.trim()) {
                        toast.error({ message: 'Please enter a search query.' });
                        return;
                    }
                    tracks = await audioMuseAIClient.textSearch({
                        baseUrl,
                        limit: textLimit,
                        query: textQuery.trim(),
                        token,
                    });
                    break;
                }

                case 'lyric-search': {
                    if (!lyricQuery.trim()) {
                        toast.error({ message: 'Please enter a lyric search query.' });
                        return;
                    }
                    tracks = await audioMuseAIClient.lyricSearch({
                        baseUrl,
                        limit: lyricLimit,
                        query: lyricQuery.trim(),
                        token,
                    });
                    break;
                }

                case 'sem-grove': {
                    if (!semGroveSong) {
                        toast.error({ message: 'Please select a seed song.' });
                        return;
                    }
                    tracks = await audioMuseAIClient.semGroveSearch({
                        baseUrl,
                        itemId: semGroveSong.item_id,
                        limit: songCount,
                        token,
                    });
                    break;
                }

                case 'sonic-fingerprint': {
                    const cred = serverWithCredential;
                    const typeLower = cred?.type?.toLowerCase();
                    if (typeLower === 'jellyfin') {
                        tracks = await audioMuseAIClient.sonicFingerprint({
                            baseUrl,
                            jellyfinToken: cred?.credential || undefined,
                            jellyfinUserId: cred?.userId || undefined,
                            n: fingerprintN,
                            token,
                        });
                    } else if (typeLower === 'navidrome' || typeLower === 'subsonic') {
                        tracks = await audioMuseAIClient.sonicFingerprint({
                            baseUrl,
                            n: fingerprintN,
                            navidromePassword: server?.audioMuseAIPassword || undefined,
                            navidromeUser: cred?.username || undefined,
                            token,
                        });
                    } else {
                        tracks = await audioMuseAIClient.sonicFingerprint({
                            baseUrl,
                            n: fingerprintN,
                            token,
                        });
                    }
                    break;
                }
            }

            if (tracks.length === 0) {
                toast.warn({ message: 'No songs found for the given parameters.' });
            } else {
                toast.success({ message: `Found ${tracks.length} songs.` });
            }
            setAndNotify(tracks);
        } catch (err: any) {
            toast.error({
                message: err?.message || 'AudioMuse-AI request failed.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const addAlchemyItem = (track: AudioMuseTrack) => {
        setAlchemyItems((prev) => [
            ...prev,
            {
                id: track.item_id,
                label: `${track.title} – ${track.author ?? ''}`,
                op: 'ADD',
                type: 'song',
            },
        ]);
        setAlchemyQuery('');
        setShowAlchemyDropdown(false);
    };

    const removeAlchemyItem = (idx: number) => {
        setAlchemyItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const toggleAlchemyOp = (idx: number) => {
        setAlchemyItems((prev) =>
            prev.map((item, i) =>
                i === idx ? { ...item, op: item.op === 'ADD' ? 'SUBTRACT' : 'ADD' } : item,
            ),
        );
    };

    if (!baseUrl) {
        return (
            <Stack>
                <Text c="dimmed" size="sm">
                    No AudioMuse-AI server URL is configured for this server. Please add it in the
                    server settings.
                </Text>
            </Stack>
        );
    }

    return (
        <Stack>
            <Select
                label="Analysis Method"
                data={METHOD_OPTIONS}
                value={method}
                onChange={(v) => {
                    setMethod((v as SonicMethod) || 'instant');
                    setAndNotify([]);
                }}
            />

            {/* ── Instant Playlist ─────────────────────────────── */}
            {method === 'instant' && (
                <Textarea
                    autosize
                    label="Describe the playlist"
                    minRows={3}
                    placeholder="e.g. Upbeat 80s synth-pop songs for a morning run"
                    value={instantPrompt}
                    onChange={(e) => setInstantPrompt(e.currentTarget.value)}
                />
            )}

            {/* ── Song Path ────────────────────────────────────── */}
            {method === 'song-path' && (
                <Stack>
                    <SongPicker
                        baseUrl={baseUrl}
                        label="Start Song"
                        selected={pathStart}
                        token={token}
                        onSelect={(t) => setPathStart(t)}
                    />
                    <SongPicker
                        baseUrl={baseUrl}
                        label="End Song"
                        selected={pathEnd}
                        token={token}
                        onSelect={(t) => setPathEnd(t)}
                    />
                    <NumberInput
                        label="Max Steps (path length)"
                        min={2}
                        max={50}
                        value={pathSteps}
                        onChange={(v) => setPathSteps(Number(v) || 10)}
                    />
                    <Checkbox
                        label="Keep exact path size"
                        checked={pathFixSize}
                        onChange={(e) => setPathFixSize(e.currentTarget.checked)}
                    />
                </Stack>
            )}

            {/* ── Song Alchemy ──────────────────────────────────── */}
            {method === 'song-alchemy' && (
                <Stack>
                    <Text size="sm">
                        Add songs to blend their sonic qualities. Toggle ADD/SUBTRACT to steer
                        the result away from certain sounds.
                    </Text>
                    {alchemyItems.map((item, idx) => (
                        <AlchemyItemRow
                            key={item.id + idx}
                            item={item}
                            onRemove={() => removeAlchemyItem(idx)}
                            onToggleOp={() => toggleAlchemyOp(idx)}
                        />
                    ))}
                    <div style={{ position: 'relative' }}>
                        <TextInput
                            label="Add a song"
                            placeholder="Search by title or artist…"
                            value={alchemyQuery}
                            onChange={(e) => {
                                setAlchemyQuery(e.currentTarget.value);
                                setShowAlchemyDropdown(true);
                                alchemySearch(e.currentTarget.value);
                            }}
                            onBlur={() => setTimeout(() => setShowAlchemyDropdown(false), 200)}
                        />
                        {showAlchemyDropdown && alchemySearchResults.length > 0 && (
                            <div
                                style={{
                                    background: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
                                    border: '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
                                    borderRadius: 4,
                                    left: 0,
                                    maxHeight: 200,
                                    overflowY: 'auto',
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    zIndex: 200,
                                }}
                            >
                                {alchemySearchResults.map((t) => (
                                    <div
                                        key={t.item_id}
                                        onMouseDown={() => addAlchemyItem(t)}
                                        style={{ cursor: 'pointer', padding: '6px 10px' }}
                                    >
                                        <Text size="sm">{t.title}</Text>
                                        <Text size="xs" c="dimmed">
                                            {t.author}
                                        </Text>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <NumberInput
                        label="Number of results"
                        min={5}
                        max={500}
                        value={alchemyN}
                        onChange={(v) => setAlchemyN(Number(v) || 50)}
                    />
                    <NumberInput
                        label="Sampling temperature"
                        description="Softmax temperature for probabilistic sampling (higher = more variety)"
                        min={0.1}
                        max={10}
                        step={0.1}
                        decimalScale={2}
                        value={alchemyTemperature}
                        onChange={(v) => setAlchemyTemperature(Number(v) || 1.0)}
                    />
                    <NumberInput
                        label="Subtract threshold"
                        description="Exclusion radius for SUBTRACT items (0 = use server default)"
                        min={0}
                        max={10}
                        step={0.1}
                        decimalScale={2}
                        value={alchemySubtractDistance}
                        onChange={(v) => setAlchemySubtractDistance(Number(v) || 0)}
                    />
                </Stack>
            )}

            {/* ── Text Search ───────────────────────────────────── */}
            {method === 'text-search' && (
                <Stack>
                    <TextInput
                        label="Search query"
                        placeholder="e.g. Energetic electronic dance music"
                        value={textQuery}
                        onChange={(e) => setTextQuery(e.currentTarget.value)}
                    />
                    <NumberInput
                        label="Number of results"
                        min={5}
                        max={500}
                        value={textLimit}
                        onChange={(v) => setTextLimit(Number(v) || 50)}
                    />
                </Stack>
            )}

            {/* ── Lyric Search ──────────────────────────────────── */}
            {method === 'lyric-search' && (
                <Stack>
                    <TextInput
                        label="Search query"
                        placeholder="e.g. Songs about rain and solitude"
                        value={lyricQuery}
                        onChange={(e) => setLyricQuery(e.currentTarget.value)}
                    />
                    <NumberInput
                        label="Number of results"
                        min={5}
                        max={500}
                        value={lyricLimit}
                        onChange={(v) => setLyricLimit(Number(v) || 50)}
                    />
                </Stack>
            )}

            {/* ── SemGrove Search (By Song) ──────────────────────── */}
            {method === 'sem-grove' && (
                <Stack>
                    <Text size="sm">
                        Find songs that are lyrically and sonically similar to a seed song.
                    </Text>
                    <SongPicker
                        baseUrl={baseUrl}
                        label="Seed Song"
                        selected={semGroveSong}
                        token={token}
                        onSelect={(t) => setSemGroveSong(t)}
                    />
                    <NumberInput
                        label="Number of results"
                        min={5}
                        max={500}
                        value={songCount}
                        onChange={(v) => setSongCount(Number(v) || 50)}
                    />
                </Stack>
            )}

            {/* ── Sonic Fingerprint (Personal) ───────────────────── */}
            {method === 'sonic-fingerprint' && (
                <Stack>
                    <Text size="sm">
                        Generates recommendations based on your personal listening history from the
                        media server. Credentials are read from your saved server configuration.
                    </Text>
                    {serverWithCredential?.type === 'JELLYFIN' && !serverWithCredential?.credential && (
                        <Text size="xs" c="yellow">
                            No Jellyfin API token saved for this server. Please add it in server
                            settings to use Sonic Fingerprint.
                        </Text>
                    )}
                    {serverWithCredential?.type === 'NAVIDROME' && !serverWithCredential?.credential && (
                        <Text size="xs" c="yellow">
                            No Navidrome password saved for this server. Please add it in server
                            settings to use Sonic Fingerprint.
                        </Text>
                    )}
                    <NumberInput
                        label="Number of songs"
                        min={10}
                        max={500}
                        value={fingerprintN}
                        onChange={(v) => setFingerprintN(Number(v) || 100)}
                    />
                </Stack>
            )}

            {/* ── Shared song count for Instant Playlist ──────────── */}
            {method === 'instant' && (
                <NumberInput
                    label="Number of songs"
                    min={10}
                    max={500}
                    value={songCount}
                    onChange={(v) => setSongCount(Number(v) || 100)}
                />
            )}

            <Button loading={isLoading} variant="filled" onClick={handleGenerate}>
                Generate
            </Button>

            {/* ── Results Preview ──────────────────────────────── */}
            {results.length > 0 && (
                <Stack gap={4}>
                    <Text size="sm" fw={600}>
                        {results.length} songs found – preview:
                    </Text>
                    <ScrollArea h={160}>
                        {results.slice(0, 50).map((t, i) => (
                            <Group key={t.item_id} gap="xs" py={2}>
                                <Text size="xs" c="dimmed" style={{ minWidth: 24 }}>
                                    {i + 1}.
                                </Text>
                                <Text size="xs">{t.title}</Text>
                                {t.author && (
                                    <Text size="xs" c="dimmed">
                                        – {t.author}
                                    </Text>
                                )}
                            </Group>
                        ))}
                        {results.length > 50 && (
                            <Text size="xs" c="dimmed">
                                …and {results.length - 50} more
                            </Text>
                        )}
                    </ScrollArea>
                </Stack>
            )}
        </Stack>
    );
});

SonicAnalysisPlaylistForm.displayName = 'SonicAnalysisPlaylistForm';
