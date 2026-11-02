import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { recipeKeys } from '../query-keys';
import { createRecipe, type RecipeWriteInput } from '../services';

export function useCreateRecipe(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecipeWriteInput) => {
      if (!userId) {
        return Promise.reject(new Error('You must be signed in to create a recipe.'));
      }
      return createRecipe(input);
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: recipeKeys.user(userId) });
      }
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists() });
      notifications.show({ title: 'Saved', message: 'Your recipe has been created.', color: 'green' });
    },
  });
}
