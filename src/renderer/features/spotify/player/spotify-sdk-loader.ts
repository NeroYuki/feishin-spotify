let sdkLoaded = false;
let loadPromise: null | Promise<void> = null;

/**
 * Dynamically loads the Spotify Web Playback SDK script.
 * Safe to call multiple times — only loads once.
 */
export function loadSpotifySDK(): Promise<void> {
    if (sdkLoaded && window.Spotify) {
        return Promise.resolve();
    }

    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = new Promise((resolve, reject) => {
        if (window.Spotify) {
            sdkLoaded = true;
            resolve();
            return;
        }

        // The SDK calls this global when ready
        window.onSpotifyWebPlaybackSDKReady = () => {
            sdkLoaded = true;
            resolve();
        };

        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        script.onerror = () => reject(new Error('Failed to load Spotify Web Playback SDK'));
        document.body.appendChild(script);
    });

    return loadPromise;
}
