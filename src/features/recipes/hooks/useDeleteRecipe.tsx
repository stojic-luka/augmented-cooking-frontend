import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { recipeKeys } from '../query-keys';
import { deleteRecipe } from '../services';

export function useDeleteRecipe(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; title: string }) => {
      if (!userId) {
        return Promise.reject(new Error('You must be signed in to delete a recipe.'));
      }
      return deleteRecipe(id, userId);
    },
    onSuccess: (_data, variables) => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: recipeKeys.user(userId) });
      }
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists() });
      notifications.show({
        title: 'Deleted',
        message: `“${variables.title}” has been removed.`,
        color: 'green',
      });
    },
  });
}

export function confirmDeleteRecipe(title: string, onConfirm: () => void) {
  modals.openConfirmModal({
    title: 'Delete recipe',
    centered: true,
    children: (
      <>Are you sure you want to delete “{title}”? This cannot be undone.</>
    ),
    labels: { confirm: 'Delete recipe', cancel: 'Keep it' },
    confirmProps: { color: 'red' },
    onConfirm,
  });
}
