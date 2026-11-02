import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { shoppingKeys } from '../query-keys';
import {
  addShoppingItems,
  createShoppingList,
  deleteCheckedItems,
  deleteShoppingItem,
  deleteShoppingList,
  fetchShoppingItems,
  fetchShoppingLists,
  updateShoppingItem,
  type ShoppingItemInput,
} from '../services';

export const useShoppingListsOptions = (userId: string | null) =>
  queryOptions({
    queryKey: shoppingKeys.lists(userId ?? 'anonymous'),
    queryFn: () => fetchShoppingLists(userId),
  });
export const useShoppingLists = (userId: string | null) => useQuery(useShoppingListsOptions(userId));

export const useShoppingItemsOptions = (listId: string | null) =>
  queryOptions({
    queryKey: shoppingKeys.list(listId ?? 'none'),
    queryFn: () => fetchShoppingItems(listId as string),
    enabled: Boolean(listId),
  });
export const useShoppingItems = (listId: string | null) => useQuery(useShoppingItemsOptions(listId));

function useInvalidateLists(userId: string | null) {
  const queryClient = useQueryClient();
  return () => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.lists(userId) });
    }
  };
}

export function useCreateShoppingList(userId: string | null) {
  const invalidate = useInvalidateLists(userId);

  return useMutation({
    mutationFn: (name: string) => createShoppingList(userId, name),
    onSuccess: () => {
      invalidate();
      notifications.show({ message: 'Shopping list created.', color: 'green' });
    },
  });
}

export function useDeleteShoppingList(userId: string | null) {
  const invalidate = useInvalidateLists(userId);

  return useMutation({
    mutationFn: (listId: string) => deleteShoppingList(listId, userId),
    onSuccess: () => invalidate(),
  });
}

export function useAddShoppingItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, items }: { listId: string; items: ShoppingItemInput[] }) => addShoppingItems(listId, items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(variables.listId) });
      notifications.show({ message: 'Items added to your shopping list.', color: 'green' });
    },
  });
}

export function useUpdateShoppingItem(listId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, patch }: { itemId: string; patch: Parameters<typeof updateShoppingItem>[1] }) =>
      updateShoppingItem(itemId, patch),
    onSuccess: () => {
      if (listId) {
        queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
      }
    },
  });
}

export function useDeleteShoppingItem(listId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => deleteShoppingItem(itemId),
    onSuccess: () => {
      if (listId) {
        queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
      }
    },
  });
}

export function useClearCheckedItems(listId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!listId) return Promise.reject(new Error('No list selected.'));
      return deleteCheckedItems(listId);
    },
    onSuccess: () => {
      if (listId) {
        queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
      }
    },
  });
}
