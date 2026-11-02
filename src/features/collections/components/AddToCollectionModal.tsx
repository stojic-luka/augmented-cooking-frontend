import { Button, Loader, Modal, Radio, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useAuthUser } from '@features/auth/providers/user';
import { useAddToCollection, useCollections, useCreateCollection } from '../hooks';

interface AddToCollectionModalProps {
  opened: boolean;
  onClose: () => void;
  recipeId: string | null;
}

/** Sends a recipe to one of the user's collections (creating one if needed). */
export function AddToCollectionModal({ opened, onClose, recipeId }: Readonly<AddToCollectionModalProps>) {
  const { user } = useAuthUser();
  const collectionsQuery = useCollections(user?.id ?? null);
  const createCollection = useCreateCollection(user?.id ?? null);
  const addToCollection = useAddToCollection();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  if (!recipeId) {
    return null;
  }

  const collections = collectionsQuery.data ?? [];
  const busy = createCollection.isPending || addToCollection.isPending;

  const handleAdd = async () => {
    if (!user) return;

    try {
      let collectionId = selectedId;
      if (!collectionId && newName.trim()) {
        const created = await createCollection.mutateAsync({
          name: newName.trim(),
          description: '',
          isPublic: false,
        });
        collectionId = created.id;
      }
      if (!collectionId) {
        notifications.show({ message: 'Pick a collection or name a new one first.', color: 'orange' });
        return;
      }

      await addToCollection.mutateAsync({ collectionId, recipeId });
      onClose();
      setNewName('');
      setSelectedId(null);
    } catch (error) {
      notifications.show({
        title: 'Could not add to collection',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add to collection" centered>
      <Stack gap="md">
        {collectionsQuery.isPending ? (
          <Loader size="sm" />
        ) : collections.length === 0 ? (
          <TextInput
            label="Name your first collection"
            placeholder="e.g. Comfort food"
            value={newName}
            onChange={(event) => setNewName(event.currentTarget.value)}
          />
        ) : (
          <>
            <Radio.Group value={selectedId} onChange={(value) => setSelectedId(value)} label="Choose a collection">
              <Stack gap="xs" mt="xs">
                {collections.map((collection) => (
                  <Radio key={collection.id} value={collection.id} label={collection.name} />
                ))}
              </Stack>
            </Radio.Group>
            <TextInput
              label="…or create a new one"
              placeholder="e.g. Comfort food"
              value={newName}
              onChange={(event) => setNewName(event.currentTarget.value)}
            />
          </>
        )}

        <Button loading={busy} disabled={busy} onClick={handleAdd}>
          Add to collection
        </Button>
      </Stack>
    </Modal>
  );
}
