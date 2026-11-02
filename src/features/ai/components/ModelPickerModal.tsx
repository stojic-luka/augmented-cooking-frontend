import { Button, Group, Loader, Modal, Paper, Stack, Text, ThemeIcon, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LuCheck, LuLock } from 'react-icons/lu';
import { useAuthUser } from '@features/auth/providers/user';
import { useUpdateProfile } from '@features/profile';
import { isModelSelectable } from '../utils/modelAccess';
import type { SubscriptionTier } from '../utils/modelAccess';
import type { AiModel } from '../services/aiModels';

interface ModelPickerModalProps {
  opened: boolean;
  onClose: () => void;
  models: AiModel[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** The chat's resolved model (stored → profile default → first selectable). */
  selectedModelId: string | null;
  subscriptionTier: SubscriptionTier | null | undefined;
  onSelect: (modelId: string) => void;
}

/**
 * Model picker for the active chat — one selectable card per model. Disabled
 * models are hidden; premium-gated models are visible but locked. Selection
 * applies to the chat's next request, never to existing history.
 */
export function ModelPickerModal({
  opened,
  onClose,
  models,
  isLoading,
  isError,
  onRetry,
  selectedModelId,
  subscriptionTier,
  onSelect,
}: Readonly<ModelPickerModalProps>) {
  const { user, profile } = useAuthUser();
  const updateProfile = useUpdateProfile(user?.id ?? null);

  const visibleModels = (models ?? []).filter((model) => model.is_enabled);
  const isDefault = selectedModelId !== null && profile?.ai_model_id === selectedModelId;

  return (
    <Modal opened={opened} onClose={onClose} title="AI model" size={520} centered>
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Applies to your next message in this chat — earlier replies keep the model that generated them.
        </Text>

        {isLoading ? (
          <Loader size="xs" />
        ) : isError ? (
          <Stack align="flex-start" gap="xs">
            <Text size="sm" c="red">
              The model list could not be loaded — chats will use the server default model.
            </Text>
            <Button size="xs" variant="light" onClick={onRetry}>
              Retry
            </Button>
          </Stack>
        ) : visibleModels.length === 0 ? (
          <Text size="sm" c="dimmed">
            No models are available right now — chats will use the server default model.
          </Text>
        ) : (
          <Stack gap="xs">
            {visibleModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                selected={model.id === selectedModelId}
                locked={!isModelSelectable(model, subscriptionTier)}
                onSelect={() => onSelect(model.id)}
                onLocked={() =>
                  notifications.show({
                    message: `${model.name} requires a premium subscription.`,
                    color: 'yellow',
                  })
                }
              />
            ))}
          </Stack>
        )}

        {selectedModelId !== null && !isDefault && user ? (
          <Group justify="flex-end">
            <Button
              variant="subtle"
              size="xs"
              loading={updateProfile.isPending}
              onClick={() => updateProfile.mutate({ aiModelId: selectedModelId })}
            >
              Set as my default
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Modal>
  );
}

function ModelCard({
  model,
  selected,
  locked,
  onSelect,
  onLocked,
}: Readonly<{
  model: AiModel;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onLocked: () => void;
}>) {
  return (
    <Paper
      component="button"
      type="button"
      w="100%"
      p="sm"
      radius={12}
      withBorder
      onClick={locked ? onLocked : onSelect}
      style={{
        cursor: locked ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        background: selected ? 'var(--accent-subtle)' : undefined,
        borderColor: selected ? 'var(--accent)' : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Text fw={600} size="sm">
            {model.name}
          </Text>
          <Badge size="xs" variant="light" color={model.tier === 'advanced' ? 'brand' : 'gray'}>
            {model.tier}
          </Badge>
          {locked ? (
            <Badge size="xs" variant="light" color="yellow" leftSection={<LuLock size={9} />}>
              Premium
            </Badge>
          ) : null}
        </Group>
        {selected ? (
          <ThemeIcon size="sm" radius="xl" color="brand">
            <LuCheck size={12} />
          </ThemeIcon>
        ) : null}
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {model.min_tier === 'free' ? 'Available to everyone' : 'Premium subscription'}
      </Text>
    </Paper>
  );
}
