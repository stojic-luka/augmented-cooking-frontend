import { Button, Loader, Modal, Radio, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useAuthUser } from '@features/auth/providers/user';
import { useAddShoppingItems, useCreateShoppingList, useShoppingLists } from '../hooks';
import type { FullRecipe } from '@features/recipes';

interface AddToShoppingListModalProps {
  opened: boolean;
  onClose: () => void;
  recipe: FullRecipe | null;
}

/** Lets the user send a recipe's ingredients to any of their shopping lists. */
export function AddToShoppingListModal({ opened, onClose, recipe }: Readonly<AddToShoppingListModalProps>) {
  const { user } = useAuthUser();
  const listsQuery = useShoppingLists(user?.id ?? null);
  const createList = useCreateShoppingList(user?.id ?? null);
  const addItems = useAddShoppingItems();

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');

  if (!recipe) {
    return null;
  }

  const lists = listsQuery.data ?? [];
  const busy = createList.isPending || addItems.isPending;

  const handleAdd = async () => {
    if (!user) return;

    let listId = selectedListId;
    try {
      if (!listId && newListName.trim()) {
        const created = await createList.mutateAsync(newListName.trim());
        listId = created.id;
      }
      if (!listId) {
        notifications.show({ message: 'Pick a list or name a new one first.', color: 'yellow' });
        return;
      }

      await addItems.mutateAsync({
        listId,
        items: recipe.recipe_ingredients.map((ingredient) => ({
          name: ingredient.ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit || null,
          sourceRecipeId: recipe.id,
        })),
      });
      onClose();
      setNewListName('');
      setSelectedListId(null);
    } catch (error) {
      notifications.show({
        title: 'Could not add ingredients',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add ingredients to shopping list" centered>
      <Stack gap="md">
        {listsQuery.isPending ? (
          <Loader size="sm" />
        ) : lists.length === 0 ? (
          <Text size="sm" c="dimmed">
            You have no shopping lists yet — name one below and we will create it.
          </Text>
        ) : (
          <Radio.Group value={selectedListId} onChange={(value) => setSelectedListId(value)} label="Choose a list">
            <Stack gap="xs" mt="xs">
              {lists.map((list) => (
                <Radio key={list.id} value={list.id} label={list.name} />
              ))}
            </Stack>
          </Radio.Group>
        )}

        <TextInput
          label="…or create a new list"
          placeholder="e.g. Week 37"
          value={newListName}
          onChange={(event) => setNewListName(event.currentTarget.value)}
        />

        <ScrollArea.Autosize mah={200}>
          <Text size="xs" c="dimmed">
            {recipe.recipe_ingredients.length} ingredients will be added, including “
            {recipe.recipe_ingredients[0]?.ingredient.name}”.
          </Text>
        </ScrollArea.Autosize>

        <Button loading={busy} disabled={busy} onClick={handleAdd}>
          Add {recipe.recipe_ingredients.length} ingredients
        </Button>
      </Stack>
    </Modal>
  );
}
