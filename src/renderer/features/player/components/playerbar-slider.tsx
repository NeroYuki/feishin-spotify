import formatDuration from 'format-duration';
import { lazy, Suspense } from 'react';

import { PlayerbarSeekSlider } from './playerbar-seek-slider';
import styles from './playerbar-slider.module.css';

import { ScrobbleStatus } from '/@/renderer/features/player/components/scrobble-status';
import {
    useAppStore,
    useAppStoreActions,
    usePlayerSong,
    usePlayerTimestamp,
} from '/@/renderer/store';
import { useSpotifyIsBuffering } from '/@/renderer/features/spotify/store/spotify-playback.store';
import { ServerType } from '/@/shared/types/domain-types';
import { PlayerbarSliderType, usePlayerbarSlider } from '/@/renderer/store/settings.store';
import { Slider, SliderProps } from '/@/shared/components/slider/slider';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Text } from '/@/shared/components/text/text';
import { Tooltip } from '/@/shared/components/tooltip/tooltip';
import { PlaybackSelectors } from '/@/shared/constants/playback-selectors';

const PlayerbarWaveform = lazy(() =>
    import('./playerbar-waveform').then((module) => ({
        default: module.PlayerbarWaveform,
    })),
);

export const PlayerbarSlider = () => {
    const currentSong = usePlayerSong();
    const playerbarSlider = usePlayerbarSlider();

    const songDuration = currentSong?.duration ? currentSong.duration / 1000 : 0;
    const currentTime = usePlayerTimestamp();

    const formattedDuration = formatDuration(songDuration * 1000 || 0);
    const formattedTimeRemaining = formatDuration((currentTime - songDuration) * 1000 || 0);
    const formattedTime = formatDuration(currentTime * 1000 || 0);

    const showTimeRemaining = useAppStore((state) => state.showTimeRemaining);
    const { setShowTimeRemaining } = useAppStoreActions();

    const isWaveform = playerbarSlider?.type === PlayerbarSliderType.WAVEFORM;
    const isSpotifySong = currentSong?._serverType === ServerType.SPOTIFY;
    const isBuffering = useSpotifyIsBuffering();
    const showBuffering = isSpotifySong && isBuffering;

    return (
        <>
            <div className={styles.sliderContainer}>
                <div className={styles.sliderValueWrapper}>
                    {showBuffering ? (
                        <Tooltip label="Buffering…" position="top" withinPortal>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Spinner size={11} />
                                <Text fw={600} isMuted isNoSelect size="xs" style={{ userSelect: 'none' }}>
                                    {formattedTime}
                                </Text>
                            </span>
                        </Tooltip>
                    ) : (
                        <ScrobbleStatus formattedTime={formattedTime} />
                    )}
                </div>
                <div className={styles.sliderWrapper}>
                    {isWaveform ? (
                        <Suspense fallback={<Spinner />}>
                            <PlayerbarWaveform />
                        </Suspense>
                    ) : (
                        <PlayerbarSeekSlider max={songDuration} min={0} />
                    )}
                </div>
                <div className={styles.sliderValueWrapper}>
                    <Text
                        className={PlaybackSelectors.totalDuration}
                        fw={600}
                        isMuted
                        isNoSelect
                        onClick={() => setShowTimeRemaining(!showTimeRemaining)}
                        role="button"
                        size="xs"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                        {showTimeRemaining ? formattedTimeRemaining : formattedDuration}
                    </Text>
                </div>
            </div>
        </>
    );
};

export const CustomPlayerbarSlider = ({ ...props }: SliderProps) => {
    return (
        <Slider
            classNames={{
                bar: styles.bar,
                label: styles.label,
                root: styles.root,
                thumb: styles.thumb,
            }}
            {...props}
            size={6}
        />
    );
};
