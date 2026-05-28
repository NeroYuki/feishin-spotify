import { useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { MouseEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    PlaylistQueryBuilder,
    PlaylistQueryBuilderRef,
} from '/@/renderer/features/playlists/components/playlist-query-builder';
import {
    SonicAnalysisPlaylistForm,
    SonicAnalysisPlaylistFormRef,
} from '/@/renderer/features/playlists/components/sonic-analysis-playlist-form';
import { useAddToPlaylist } from '/@/renderer/features/playlists/mutations/add-to-playlist-mutation';
import { useCreatePlaylist } from '/@/renderer/features/playlists/mutations/create-playlist-mutation';
import { convertQueryGroupToNDQuery } from '/@/renderer/features/playlists/utils';
import { queryKeys } from '/@/renderer/api/query-keys';
import { infiniteLoaderDataQueryKey } from '/@/renderer/components/item-list/helpers/item-list-infinite-loader';
import { useCurrentServer } from '/@/renderer/store';
import { hasFeature } from '/@/shared/api/utils';
import { Group } from '/@/shared/components/group/group';
import { closeAllModals, openModal } from '/@/shared/components/modal/modal';
import { ModalButton } from '/@/shared/components/modal/model-shared';
import { Stack } from '/@/shared/components/stack/stack';
import { Switch } from '/@/shared/components/switch/switch';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { Textarea } from '/@/shared/components/textarea/textarea';
import { toast } from '/@/shared/components/toast/toast';
import { useForm } from '/@/shared/hooks/use-form';
import {
    CreatePlaylistBody,
    LibraryItem,
    ServerListItem,
    ServerType,
    SongListSort,
} from '/@/shared/types/domain-types';
import { ServerFeature } from '/@/shared/types/features-types';

interface CreatePlaylistFormProps {
    onCancel: () => void;
}

export const CreatePlaylistForm = ({ onCancel }: CreatePlaylistFormProps) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const mutation = useCreatePlaylist({});
    const addToPlaylistMutation = useAddToPlaylist({});
    const server = useCurrentServer();
    const queryBuilderRef = useRef<PlaylistQueryBuilderRef>(null);
    const sonicRef = useRef<SonicAnalysisPlaylistFormRef>(null);

    const form = useForm<CreatePlaylistBody>({
        initialValues: {
            comment: '',
            name: '',
            queryBuilderRules: undefined,
        },
    });
    const [isSmartPlaylist, setIsSmartPlaylist] = useState(false);
    const [isSonicPlaylist, setIsSonicPlaylist] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [sonicResults, setSonicResults] = useState<{ item_id: string }[]>([]);

    const hasSonicAI = Boolean(server?.audioMuseAIUrl);

    const handleSubmit = form.onSubmit((values) => {
        if (!server) return;

        // Step 1 → Step 2 for smart or sonic playlists
        if ((isSmartPlaylist || isSonicPlaylist) && step === 1) {
            setStep(2);
            return;
        }

        const smartPlaylist = queryBuilderRef.current?.getFilters();

        const sortValue =
            isSmartPlaylist && smartPlaylist?.extraFilters?.sortBy?.[0]
                ? smartPlaylist.extraFilters.sortBy[0]
                : undefined;

        const rules =
            isSmartPlaylist && smartPlaylist?.filters
                ? {
                      ...convertQueryGroupToNDQuery(smartPlaylist.filters),
                      limit: smartPlaylist.extraFilters.limit,
                      limitPercent: smartPlaylist.extraFilters.limitPercent,
                      sort: sortValue || '+dateAdded',
                  }
                : undefined;

        mutation.mutate(
            {
                apiClientProps: { serverId: server.id },
                body: {
                    ...values,
                    ...(rules ? { queryBuilderRules: rules } : {}),
                },
            },
            {
                onError: (err) => {
                    toast.error({
                        message: err.message,
                        title: t('error.genericError'),
                    });
                },
                onSuccess: (data) => {
                    // For sonic playlists, add the generated songs after playlist creation
                    if (isSonicPlaylist && data?.id && sonicResults.length > 0) {
                        addToPlaylistMutation.mutate(
                            {
                                apiClientProps: { serverId: server.id },
                                body: { songId: sonicResults.map((t) => t.item_id) },
                                query: { id: data.id },
                            },
                            {
                                onError: (err) => {
                                    toast.error({
                                        message: err.message,
                                        title: t('error.genericError'),
                                    });
                                    onCancel();
                                },
                                onSuccess: () => {
                                    queryClient.invalidateQueries({
                                        exact: false,
                                        queryKey: queryKeys.playlists.root(server.id),
                                    });
                                    queryClient.invalidateQueries({
                                        exact: false,
                                        queryKey: infiniteLoaderDataQueryKey(server.id, LibraryItem.PLAYLIST),
                                    });
                                    toast.success({
                                        message: t('form.createPlaylist.success'),
                                    });
                                    onCancel();
                                },
                            },
                        );
                    } else {
                        toast.success({
                            message: t('form.createPlaylist.success'),
                        });
                        onCancel();
                    }
                },
            },
        );
    });

    const isPublicDisplayed = hasFeature(server, ServerFeature.PUBLIC_PLAYLIST);
    const isBusy = mutation.isPending || addToPlaylistMutation.isPending;
    const isSubmitDisabled =
        !form.values.name ||
        isBusy ||
        (isSonicPlaylist && step === 2 && sonicResults.length === 0);

    const submitLabel = () => {
        if ((isSmartPlaylist || isSonicPlaylist) && step === 1) {
            return t('common.confirm', { postProcess: 'sentenceCase' });
        }
        if (isSonicPlaylist && step === 2) {
            return `Create with ${sonicResults.length} songs`;
        }
        return t('common.create');
    };

    return (
        <form onSubmit={handleSubmit}>
            <Stack>
                {step === 1 && (
                    <>
                        <TextInput
                            data-autofocus
                            label={t('form.createPlaylist.input', {
                                context: 'name',
                            })}
                            required
                            {...form.getInputProps('name')}
                        />
                        {server?.type === ServerType.NAVIDROME && (
                            <Textarea
                                autosize
                                label={t('form.createPlaylist.input', {
                                    context: 'description',
                                })}
                                minRows={5}
                                {...form.getInputProps('comment')}
                            />
                        )}
                        <Group>
                            {isPublicDisplayed && (
                                <Switch
                                    label={t('form.createPlaylist.input', {
                                        context: 'public',
                                    })}
                                    {...form.getInputProps('public', {
                                        type: 'checkbox',
                                    })}
                                />
                            )}
                            {server?.type === ServerType.NAVIDROME &&
                                hasFeature(server, ServerFeature.PLAYLISTS_SMART) && (
                                    <Switch
                                        checked={isSmartPlaylist}
                                        label="Is smart playlist?"
                                        onChange={(e) => {
                                            const next = e.currentTarget.checked;
                                            setIsSmartPlaylist(next);
                                            if (next) setIsSonicPlaylist(false);
                                            if (!next) setStep(1);
                                        }}
                                    />
                                )}
                            {hasSonicAI && (
                                <Switch
                                    checked={isSonicPlaylist}
                                    label="Sonic Analysis Playlist"
                                    onChange={(e) => {
                                        const next = e.currentTarget.checked;
                                        setIsSonicPlaylist(next);
                                        if (next) setIsSmartPlaylist(false);
                                        if (!next) {
                                            setStep(1);
                                            setSonicResults([]);
                                        }
                                    }}
                                />
                            )}
                        </Group>
                    </>
                )}

                {isSmartPlaylist && step === 2 && (
                    <Stack pt="1rem">
                        <Text>Query Editor</Text>
                        <PlaylistQueryBuilder
                            limit={undefined}
                            query={undefined}
                            ref={queryBuilderRef}
                            sortBy={[SongListSort.ALBUM]}
                            sortOrder="asc"
                        />
                    </Stack>
                )}

                {isSonicPlaylist && step === 2 && (
                    <Stack pt="1rem">
                        <SonicAnalysisPlaylistForm
                            ref={sonicRef}
                            onResultsChange={(tracks) => setSonicResults(tracks)}
                        />
                    </Stack>
                )}

                <Group justify="flex-end">
                    {(isSmartPlaylist || isSonicPlaylist) && step === 2 && (
                        <ModalButton onClick={() => setStep(1)} px="2xl" uppercase variant="subtle">
                            Back
                        </ModalButton>
                    )}
                    <ModalButton onClick={onCancel} px="2xl" uppercase variant="subtle">
                        {t('common.cancel')}
                    </ModalButton>
                    <ModalButton
                        disabled={isSubmitDisabled}
                        loading={isBusy}
                        type="submit"
                        variant="filled"
                    >
                        {submitLabel()}
                    </ModalButton>
                </Group>
            </Stack>
        </form>
    );
};

export const openCreatePlaylistModal = (
    server?: ServerListItem,
    e?: MouseEvent<HTMLButtonElement>,
) => {
    e?.stopPropagation();

    openModal({
        children: <CreatePlaylistForm onCancel={() => closeAllModals()} />,
        size: server?.type === ServerType?.NAVIDROME ? 'xl' : 'sm',
        title: t('form.createPlaylist.title'),
    });
};
