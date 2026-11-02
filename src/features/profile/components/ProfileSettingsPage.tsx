import { useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  FileButton,
  Group,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ColorSchemeToggle, FullPageLoader } from '@components';
import { useNavigate } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import { useAuthUser } from '@features/auth/providers/user';
import { useAiModels } from '@features/ai';
import { useProfile, useUpdateProfile, useUploadAvatar } from '../hooks';
import { publicDietaryTagSchema, type PublicProfilesRow } from '@/types/schemas';

/** Account settings: identity, units, diet, theme, AI assistant, plan. */
export function ProfileSettingsPage() {
  const { user, profile, isLoading } = useAuthUser();
  const profileQuery = useProfile(user?.id ?? null);

  if (!user) {
    return (
      <Alert color="yellow" variant="light" title="Sign in required">
        Sign in to manage your profile.
      </Alert>
    );
  }

  // The form's fields initialize from the profile row exactly once, so the
  // editing UI must not mount before the row arrives — otherwise the fields
  // seed with defaults and an auto-save control can overwrite real values.
  if (isLoading || profileQuery.isPending) {
    return <FullPageLoader label="Loading your profile…" />;
  }

  if (profileQuery.isError) {
    return (
      <Alert color="red" variant="light" title="Could not load your profile">
        {profileQuery.error.message}
      </Alert>
    );
  }

  return <ProfileSettingsForm user={user} profile={profile} />;
}

interface ProfileSettingsFormProps {
  user: User;
  profile: PublicProfilesRow | null;
}

function ProfileSettingsForm({ user, profile }: Readonly<ProfileSettingsFormProps>) {
  const { role } = useAuthUser();
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile(user.id);
  const uploadAvatar = useUploadAvatar(user.id);
  const modelsQuery = useAiModels(true);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [unitPreference, setUnitPreference] = useState(profile?.unit_preference ?? 'metric');
  const [dietary, setDietary] = useState<string[]>(profile?.dietary_preferences ?? []);
  const [aiModelId, setAiModelId] = useState<string | null>(profile?.ai_model_id ?? null);

  const dietaryOptions = publicDietaryTagSchema.options.map((opt) => opt.value);

  return (
    <Stack gap="xl">
      <Title order={1}>Profile & settings</Title>

      <Group align="flex-start" gap="xl">
        <Paper withBorder p="xl" radius={12} ta="center" w={{ base: '100%', sm: 280 }}>
          <Stack align="center" gap="sm">
            <Avatar
              src={profile?.avatar_url ?? undefined}
              name={profile?.display_name ?? user.email ?? 'Cook'}
              size={110}
              radius={110}
              color="brand"
            />
            <Text fw={600}>{profile?.display_name ?? 'Home cook'}</Text>
            <Text size="sm" c="dimmed">
              {user.email}
            </Text>
            <FileButton onChange={(file) => file && uploadAvatar.mutate(file)} accept="image/*">
              {(props) => (
                <Button {...props} variant="light" loading={uploadAvatar.isPending} w="100%">
                  Change avatar
                </Button>
              )}
            </FileButton>
            {uploadAvatar.isError ? (
              <Text size="xs" c="red">
                {uploadAvatar.error.message}
              </Text>
            ) : null}
          </Stack>
        </Paper>

        <Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
          <Card>
            <Stack gap="sm">
              <Title order={3}>Basic info</Title>
              <Group grow>
                <TextInput
                  label="Display name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.currentTarget.value)}
                />
                <TextInput label="Email" value={user.email ?? ''} disabled />
              </Group>
              <Button
                w="fit-content"
                loading={updateProfile.isPending}
                onClick={() => updateProfile.mutate({ displayName })}
              >
                Save changes
              </Button>
            </Stack>
          </Card>

          <Card>
            <Stack gap="sm">
              <Title order={3}>Cooking preferences</Title>
              <div>
                <Text size="sm" fw={500} mb={4}>
                  Units
                </Text>
                <SegmentedControl
                  value={unitPreference}
                  onChange={(value) => {
                    setUnitPreference(value as 'metric' | 'imperial');
                    updateProfile.mutate({ unitPreference: value as 'metric' | 'imperial' });
                  }}
                  data={[
                    { label: 'Metric (g, ml)', value: 'metric' },
                    { label: 'Imperial (oz, cups)', value: 'imperial' },
                  ]}
                />
                <Text size="xs" c="dimmed" mt={4}>
                  Recipe quantities convert automatically to this system.
                </Text>
              </div>
              <MultiSelect
                label="Dietary preferences"
                data={[...dietaryOptions]}
                value={dietary}
                onChange={(values) => {
                  setDietary(values);
                  updateProfile.mutate({ dietaryPreferences: values });
                }}
                clearable
              />
            </Stack>
          </Card>

          <Card>
            <Stack gap="sm">
              <Title order={3}>AI assistant</Title>
              <Select
                label="Preferred model"
                placeholder={
                  modelsQuery.isPending
                    ? 'Loading models…'
                    : modelsQuery.isError
                      ? 'Could not load models'
                      : 'Choose a model'
                }
                data={(modelsQuery.data ?? []).map((model) => ({
                  value: model.id,
                  label: `${model.name} (${model.tier}${model.min_tier === 'premium' ? ', premium' : ''})`,
                }))}
                value={aiModelId}
                onChange={(value) => {
                  setAiModelId(value);
                  updateProfile.mutate({ aiModelId: value });
                }}
                clearable
                disabled={modelsQuery.isPending || modelsQuery.isError}
              />
              {modelsQuery.isError ? (
                <Text size="xs" c="red">
                  {modelsQuery.error.message}
                </Text>
              ) : null}
            </Stack>
          </Card>

          <Card>
            <Stack gap="sm">
              <Title order={3}>Appearance</Title>
              <Group justify="space-between">
                <Text size="sm">Dark mode follows your system by default; switch anytime.</Text>
                <ColorSchemeToggle />
              </Group>
            </Stack>
          </Card>

          <Card>
            <Group justify="space-between">
              <div>
                <Title order={3}>Subscription</Title>
                <Text size="sm" c="dimmed">
                  Current plan: {profile?.subscription_tier === 'premium' ? 'Premium' : 'Free'} · role: {role}
                </Text>
              </div>
              <Button variant="light" onClick={() => navigate({ to: '/subscription' })}>
                Manage plan
              </Button>
            </Group>
          </Card>
        </Stack>
      </Group>
    </Stack>
  );
}
