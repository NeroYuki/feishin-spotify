import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { spotifyApiClient } from '/@/renderer/features/spotify/api/spotify-api-client';
import { checkLibraryContainsBatched } from '/@/renderer/features/spotify/api/spotify-saved-batcher';
import { useSpotifyIsAuthenticated } from '/@/renderer/features/spotify/store/spotify-auth.store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';

interface SpotifyLikeButtonProps {
    isArtist?: boolean;
    size?: 'md' | 'sm' | 'xs';
    uri: string;
}

/**
 * Heart button that saves/removes a Spotify item from the user's library.
 * For artists, uses the follow/unfollow endpoints instead of /me/library.
 *
 * Props:
 *   uri      — full Spotify URI e.g. "spotify:track:7a3LWj5xSFhFRYmztS8wgK"
 *   isArtist — when true uses PUT/DELETE /me/following instead of /me/library
 */
export const SpotifyLikeButton = ({ uri, isArtist = false, size = 'sm' }: SpotifyLikeButtonProps) => {
    const isAuthenticated = useSpotifyIsAuthenticated();
    const queryClient = useQueryClient();
    const queryKey = ['spotify', 'saved', uri] as const;

    const { data: isSaved = false } = useQuery({
        enabled: isAuthenticated,
        queryFn: async (): Promise<boolean> => {
            if (isArtist) {
                const id = uri.split(':')[2];
                return spotifyApiClient.checkFollowingArtist(id);
            }
            // Use the batcher: all buttons mounting in the same render tick
            // coalesce into a single /me/library/contains request.
            return checkLibraryContainsBatched(uri);
        },
        queryKey,
        staleTime: 5 * 60 * 1000,
    });

    const handleToggle = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();

            const previous = queryClient.getQueryData<boolean>(queryKey);
            // Optimistic update
            queryClient.setQueryData(queryKey, !previous);

            try {
                if (isArtist) {
                    const id = uri.split(':')[2];
                    if (previous) {
                        await spotifyApiClient.unfollowArtist(id);
                    } else {
                        await spotifyApiClient.followArtist(id);
                    }
                } else if (previous) {
                    await spotifyApiClient.removeLibraryItems([uri]);
                } else {
                    await spotifyApiClient.saveLibraryItems([uri]);
                }
                // Invalidate liked-tracks list when a track is saved/removed
                if (uri.startsWith('spotify:track:')) {
                    queryClient.invalidateQueries({ queryKey: ['spotify', 'liked-tracks'] });
                }
            } catch {
                // Roll back on error
                queryClient.setQueryData(queryKey, previous);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [uri, isArtist, queryClient],
    );

    if (!isAuthenticated) return null;

    return (
        <ActionIcon
            icon="favorite"
            iconProps={{
                size,
                style: isSaved ? { color: 'var(--theme-colors-primary)' } : undefined,
            }}
            size={size}
            tooltip={{
                label: isSaved ? 'Remove from library' : 'Save to library',
                openDelay: 500,
            }}
            variant="transparent"
            onClick={handleToggle}
        />
    );
};
