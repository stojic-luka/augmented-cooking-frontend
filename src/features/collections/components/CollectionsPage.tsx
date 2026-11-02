import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useForm, schemaResolver } from '@mantine/form';
import { LuFolders, LuPlus, LuShare2, LuTrash2 } from 'react-icons/lu';
import { notifications } from '@mantine/notifications';
import { EmptyState } from '@components';
import { useAuthUser } from '@features/auth/providers/user';
import { modals } from '@mantine/modals';
import { collectionFormSchema, type CollectionFormValues } from '../types';
import { useCollections, useCreateCollection, useDeleteCollection } from '../hooks';

export function CollectionsPage() {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const collectionsQuery = useCollections(user?.id ?? null);
  const createCollection = useCreateCollection(user?.id ?? null);
  const deleteCollection = useDeleteCollection(user?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm<CollectionFormValues>({
    initialValues: { name: '', description: '', isPublic: false },
    validate: schemaResolver(collectionFormSchema),
  });

  const handleCreate = (values: CollectionFormValues) => {
    createCollection.mutate(values, {
      onSuccess: () => {
        form.reset();
        setCreateOpen(false);
      },
      onError: (error) => notifications.show({ title: 'Failed', message: error.message, color: 'red' }),
    });
  };

  const confirmDelete = (id: string, name: string) => {
    modals.openConfirmModal({
      title: 'Delete collection',
      centered: true,
      children: <>Delete “{name}”? Recipes themselves are not deleted.</>,
      labels: { confirm: 'Delete', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        deleteCollection.mutate(id, {
          onError: (error) => notifications.show({ title: 'Failed', message: error.message, color: 'red' }),
        }),
    });
  };

  if (collectionsQuery.isPending) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} height={140} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  if (collectionsQuery.isError) {
    return (
      <Alert color="red" variant="light" title="Could not load collections">
        <Text size="sm">{collectionsQuery.error.message}</Text>
      </Alert>
    );
  }

  const collections = collectionsQuery.data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Collections</Title>
        <Button leftSection={<LuPlus size={16} />} onClick={() => setCreateOpen(true)}>
          New collection
        </Button>
      </Group>

      {collections.length === 0 ? (
        <EmptyState
          icon={LuFolders}
          title="No collections yet"
          description="Group recipes into private or public collections — weeknight dinners, holiday baking, and more."
          actionLabel="Create your first collection"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {collections.map((collection) => (
            <Card key={collection.id}>
              <Group justify="space-between" mb="xs">
                <Link to="/collections/$id" params={{ id: collection.id }} style={{ textDecoration: 'none' }}>
                  <Text fw={600} c="inherit">
                    {collection.name}
                  </Text>
                </Link>
                {collection.is_public ? (
                  <Text size="xs" c="dimmed">
                    public
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    private
                  </Text>
                )}
              </Group>
              <Text size="sm" c="dimmed" lineClamp={2} mih={36}>
                {!!collection.description ? collection.description : 'No description'}
              </Text>
              <Group justify="space-between" mt="md">
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => navigate({ to: '/collections/$id', params: { id: collection.id } })}
                >
                  Open
                </Button>
                <Group gap={4}>
                  <LuShare2
                    size={16}
                    aria-label="Copy collection link"
                    role="button"
                    style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}
                    onClick={() => {
                      const url = `${window.location.origin}/collections/${collection.id}`;
                      navigator.clipboard
                        .writeText(url)
                        .then(() => {
                          notifications.show({ message: 'Collection link copied.', color: 'green' });
                        })
                        .catch(() => {
                          notifications.show({ message: 'Could not copy the link.', color: 'red' });
                        });
                    }}
                  />
                  <LuTrash2
                    size={16}
                    aria-label="Delete collection"
                    role="button"
                    style={{ cursor: 'pointer', color: 'var(--danger)' }}
                    onClick={() => confirmDelete(collection.id, collection.name)}
                  />
                </Group>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New collection" centered>
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="sm">
            <TextInput
              label="Name"
              placeholder="e.g. Weeknight dinners"
              key={form.key('name')}
              {...form.getInputProps('name')}
            />
            <Textarea label="Description" minRows={2} key={form.key('description')} {...form.getInputProps('description')} />
            <Switch
              label="Public collection"
              description="Anyone with the link can view it."
              key={form.key('isPublic')}
              {...form.getInputProps('isPublic', { type: 'checkbox' })}
            />
            <Button type="submit" loading={createCollection.isPending} w="fit-content">
              Create collection
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
