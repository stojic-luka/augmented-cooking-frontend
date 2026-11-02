import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { recipeKeys } from '../query-keys';
import { copyRecipe } from '../services';
import type { FullRecipe } from '../types';

export function useCopyRecipe(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipe: FullRecipe) => {
      if (!userId) {
        return Promise.reject(new Error('Sign in to save a copy of this recipe.'));
      }
      return copyRecipe(recipe, userId);
    },
    onSuccess: (copied) => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: recipeKeys.user(userId) });
      }
      notifications.show({
        title: 'Copy created',
        message: `“${copied.title}” was added to your recipes.`,
        color: 'green',
      });
    },
  });
}
