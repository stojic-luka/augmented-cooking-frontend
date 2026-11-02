import { useState } from 'react';
import { Button, Card, Group, Loader, Select, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { LuPlus } from 'react-icons/lu';
import { useAdminModels, useCreateModel, useUpdateModel } from '../../hooks';

const MIN_TIER_DATA = [
  { value: 'free', label: 'Free' },
  { value: 'premium', label: 'Premium' },
];

const TIER_DATA = [
  { value: 'economy', label: 'Economy' },
  { value: 'advanced', label: 'Advanced' },
];

export function AdminModelsList() {
  const modelsQuery = useAdminModels();
  const updateModel = useUpdateModel();

  if (modelsQuery.isPending) {
    return <Loader size="sm" />;
  }

  if (modelsQuery.isError) {
    return (
      <Text size="sm" c="dimmed">
        {modelsQuery.error.message} — create the `ai_models` table (see docs/DATABASE_REFERENCE.md) to manage models.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {modelsQuery.data.map((model, index) => (
        <Card key={index}>
          <Group justify="space-between" wrap="nowrap">
            <Group wrap="nowrap">
              <Text fw={600}>{model.name}</Text>
              <Text size="xs" c="dimmed">
                {model.tier} tier
              </Text>
            </Group>
            <Group wrap="nowrap">
              <Select
                label="Min tier"
                value={model.min_tier}
                data={MIN_TIER_DATA}
                w={110}
                onChange={(value) =>
                  value && updateModel.mutate({ modelId: model.id, patch: { min_tier: value as 'free' | 'premium' } })
                }
              />
              <Switch
                label="Enabled"
                checked={model.is_enabled}
                onChange={(event) =>
                  updateModel.mutate({ modelId: model.id, patch: { is_enabled: event.currentTarget.checked } })
                }
              />
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

/** AI model registry. */
export function AdminModelsSection() {
  const createModel = useCreateModel();
  const [newModelName, setNewModelName] = useState('');
  const [newModelTier, setNewModelTier] = useState<'economy' | 'advanced'>('economy');
  const [newModelMinTier, setNewModelMinTier] = useState<'free' | 'premium'>('free');

  return (
    <Stack gap="md">
      <Title order={3}>AI model registry</Title>

      <AdminModelsList />

      <Card>
        <Group align="flex-end" gap="sm">
          <TextInput
            label="Register new model"
            placeholder="e.g. Claude 4 Haiku"
            value={newModelName}
            onChange={(event) => setNewModelName(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            label="Tier"
            value={newModelTier}
            onChange={(value) => value && setNewModelTier(value as 'economy' | 'advanced')}
            data={TIER_DATA}
            w={140}
          />
          <Select
            label="Min tier"
            value={newModelMinTier}
            onChange={(value) => value && setNewModelMinTier(value as 'free' | 'premium')}
            data={MIN_TIER_DATA}
            w={140}
          />
          <Button
            leftSection={<LuPlus size={16} />}
            loading={createModel.isPending}
            disabled={!newModelName.trim()}
            onClick={() =>
              createModel.mutate(
                { name: newModelName, tier: newModelTier, min_tier: newModelMinTier },
                { onSuccess: () => setNewModelName('') },
              )
            }
          >
            Add
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}
