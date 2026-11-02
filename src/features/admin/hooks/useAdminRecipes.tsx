import { infiniteQueryOptions, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { recipeKeys } from '@features/recipes';
import { adminKeys } from '../query-keys';
import { adminDeleteRecipe, adminModerateRecipe, fetchAllRecipes, type AdminModerationAction } from '../services';

/**
 * Cursor pagination: the key is static — the cursor flows through
 * `pageParam`, so all pages of one registry share a single cache entry.
 * Admin routes are auth-guarded, so no `enabled` is needed.
 */
export const adminRecipesOptions = () =>
  infiniteQueryOptions({
    queryKey: adminKeys.recipes(),
    queryFn: ({ pageParam }) => fetchAllRecipes(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? (lastPage.nextCursor ?? undefined) : undefined),
  });
export const useAdminRecipes = () => useInfiniteQuery(adminRecipesOptions());

export function useAdminDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: string) => adminDeleteRecipe(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.recipes() });
      // The recipe's public surfaces (explorer, detail, favorites) cache the
      // old row — sweep the whole recipes domain alongside the admin list.
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      notifications.show({ message: 'Recipe deleted.', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });
}

export function useAdminModerateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipeId, status }: { recipeId: string; status: AdminModerationAction }) =>
      adminModerateRecipe(recipeId, status),
    onSuccess: (_data, { status }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.recipes() });
      // Moderation changes public visibility — sweep the recipes domain so
      // explorer/detail caches don't keep showing the old status.
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      notifications.show({
        message: `Recipe ${status === 'approved' ? 'approved' : status}.`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });
}
