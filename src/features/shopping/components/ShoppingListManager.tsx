import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LuPlus, LuRefreshCw, LuShoppingCart, LuTrash2 } from 'react-icons/lu';
import { EmptyState } from '@components';
import { useAuthUser } from '@features/auth/providers/user';
import {
  useAddShoppingItems,
  useClearCheckedItems,
  useDeleteShoppingItem,
  useDeleteShoppingList,
  useCreateShoppingList,
  useOrderIngredients,
  useShoppingItems,
  useShoppingLists,
  useUpdateShoppingItem,
} from '../hooks';
import { shoppingItemCategorySchema, type ShoppingItemCategory } from '../types';

const CATEGORY_LABELS: Record<ShoppingItemCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  seafood: 'Seafood',
  grains: 'Grains & pasta',
  pantry: 'Pantry',
  spices: 'Spices',
  frozen: 'Frozen',
  bakery: 'Bakery',
  beverages: 'Beverages',
  other: 'Other',
};

const CATEGORY_OPTIONS = shoppingItemCategorySchema.options.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

export function ShoppingListManager() {
  const { user } = useAuthUser();
  const listsQuery = useShoppingLists(user?.id ?? null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  // The auto-selected first list must also drive the items/mutation hooks —
  // keying them on `selectedListId` alone left the items pane loading forever
  // until the user manually picked a list from the Select.
  const activeListId = selectedListId ?? listsQuery.data?.[0]?.id ?? null;
  const itemsQuery = useShoppingItems(activeListId);
  const createList = useCreateShoppingList(user?.id ?? null);
  const deleteList = useDeleteShoppingList(user?.id ?? null);
  const updateItem = useUpdateShoppingItem(activeListId);
  const deleteItem = useDeleteShoppingItem(activeListId);
  const clearChecked = useClearCheckedItems(activeListId);
  const addItems = useAddShoppingItems();
  const orderIngredients = useOrderIngredients();
  const [addOpen, setAddOpen] = useState(false);

  if (listsQuery.isPending) {
    return (
      <Paper withBorder p="xl" radius={12}>
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </Paper>
    );
  }

  if (listsQuery.isError) {
    return (
      <Alert color="red" variant="light" title="Could not load shopping lists">
        <Text size="sm">{listsQuery.error.message}</Text>
      </Alert>
    );
  }

  const lists = listsQuery.data ?? [];
  const activeList = lists.find((list) => list.id === activeListId) ?? null;
  const items = itemsQuery.data ?? [];

  if (lists.length === 0) {
    return (
      <Stack gap="lg">
        <EmptyState
          icon={LuShoppingCart}
          title="No shopping lists yet"
          description="Create a list manually, or plan a week of meals and generate one automatically."
          actionLabel="Create a list"
          onAction={() =>
            createList.mutate('My shopping list', {
              onError: (error) => notifications.show({ title: 'Failed', message: error.message, color: 'red' }),
            })
          }
        />
      </Stack>
    );
  }

  const grouped = new Map<ShoppingItemCategory, typeof items>();
  for (const item of items) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <Select
          label="Shopping list"
          data={lists.map((list) => ({ value: list.id, label: list.name }))}
          value={activeListId}
          onChange={(value) => setSelectedListId(value)}
          w={280}
        />
        <Group gap="xs" wrap="nowrap">
          <Button
            variant="default"
            leftSection={<LuPlus size={16} />}
            onClick={() =>
              createList.mutate(`List ${lists.length + 1}`, {
                onSuccess: (list) => setSelectedListId(list.id),
              })
            }
          >
            New list
          </Button>
          <Button leftSection={<LuPlus size={16} />} onClick={() => setAddOpen(true)} disabled={!activeListId}>
            Add item
          </Button>
        </Group>
      </Group>

      {itemsQuery.isPending ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : itemsQuery.isError ? (
        <Alert color="red" variant="light" title="Could not load items">
          <Text size="sm">{itemsQuery.error.message}</Text>
        </Alert>
      ) : items.length === 0 ? (
        <EmptyState
          icon={LuShoppingCart}
          title="This list is empty"
          description="Add items manually or send ingredients over from any recipe or meal plan."
        />
      ) : (
        <Stack gap="md">
          {[...grouped.entries()].map(([category, categoryItems]) => (
            <Paper key={category} withBorder p="md" radius={12}>
              <Text fw={600} size="sm" mb="sm">
                {CATEGORY_LABELS[category]} · {categoryItems.filter((item) => !item.checked).length} to buy
              </Text>
              <Stack gap="xs">
                {categoryItems.map((item) => (
                  <Group key={item.id} justify="space-between" wrap="nowrap">
                    <Group wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      <Checkbox
                        checked={item.checked}
                        onChange={(event) =>
                          updateItem.mutate({ itemId: item.id, patch: { checked: event.currentTarget.checked } })
                        }
                        aria-label={`Mark ${item.name}`}
                      />
                      <Text
                        size="sm"
                        td={item.checked ? 'line-through' : 'none'}
                        c={item.checked ? 'dimmed' : 'inherit'}
                        style={{ minWidth: 0 }}
                      >
                        {item.name}
                      </Text>
                    </Group>
                    <Group gap={6} wrap="nowrap">
                      <NumberInput
                        value={item.quantity ?? undefined}
                        onChange={(value) =>
                          updateItem.mutate({
                            itemId: item.id,
                            patch: { quantity: typeof value === 'number' ? value : null },
                          })
                        }
                        w={80}
                        size="xs"
                        hideControls={!item.quantity}
                        decimalSeparator=","
                        aria-label={`Quantity for ${item.name}`}
                      />
                      <Text size="xs" c="dimmed" w={40}>
                        {item.unit ?? ''}
                      </Text>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => deleteItem.mutate(item.id)}
                        aria-label={`Delete ${item.name}`}
                      >
                        <LuTrash2 size={15} />
                      </ActionIcon>
                    </Group>
                  </Group>
                ))}
              </Stack>
            </Paper>
          ))}

          <Group justify="space-between">
            <Button
              variant="default"
              leftSection={<LuRefreshCw size={16} />}
              disabled={items.every((item) => !item.checked)}
              loading={clearChecked.isPending}
              onClick={() => clearChecked.mutate()}
            >
              Clear checked items
            </Button>
            {activeList ? (
              <Button
                leftSection={<LuShoppingCart size={16} />}
                loading={orderIngredients.isPending}
                onClick={() =>
                  activeListId &&
                  orderIngredients.mutate({
                    userId: user?.id ?? '',
                    items: items
                      .filter((item) => !item.checked)
                      .map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                      })),
                  })
                }
              >
                Order ingredients
              </Button>
            ) : null}
          </Group>
        </Stack>
      )}

      {activeListId ? (
        <Group justify="flex-end">
          <Button
            variant="subtle"
            color="red"
            size="xs"
            loading={deleteList.isPending}
            onClick={() => {
              if (!activeList) return;
              deleteList.mutate(activeList.id, {
                onSuccess: () => {
                  setSelectedListId(null);
                  notifications.show({ message: `Deleted “${activeList.name}”.`, color: 'green' });
                },
              });
            }}
          >
            Delete this list
          </Button>
        </Group>
      ) : null}

      <AddItemModal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(name, quantity, unit, category) => {
          if (!activeListId) return;
          addItems.mutate(
            { listId: activeListId, items: [{ name, quantity, unit, category }] },
            {
              onSuccess: () => setAddOpen(false),
            },
          );
        }}
      />
    </Stack>
  );
}

function AddItemModal({
  opened,
  onClose,
  onSubmit,
}: Readonly<{
  opened: boolean;
  onClose: () => void;
  onSubmit: (name: string, quantity: number | null, unit: string | null, category: ShoppingItemCategory) => void;
}>) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number | string>('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<ShoppingItemCategory>('other');

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Give the item a name.', color: 'yellow' });
      return;
    }
    onSubmit(name.trim(), quantity === '' || typeof quantity === 'string' ? null : quantity, unit.trim() || null, category);
    setName('');
    setQuantity('');
    setUnit('');
    setCategory('other');
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add item" centered>
      <Stack gap="sm">
        <TextInput
          label="Item"
          placeholder="e.g. Olive oil"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group grow>
          <NumberInput label="Quantity" min={0} value={quantity} onChange={(value) => setQuantity(value)} />
          <TextInput
            label="Unit"
            placeholder="ml, g, pc…"
            value={unit}
            onChange={(event) => setUnit(event.currentTarget.value)}
          />
        </Group>
        <Select
          label="Category"
          data={CATEGORY_OPTIONS}
          value={category}
          onChange={(value) => setCategory(value ?? 'other')}
        />
        <Button onClick={submit} w="fit-content">
          Add to list
        </Button>
      </Stack>
    </Modal>
  );
}
