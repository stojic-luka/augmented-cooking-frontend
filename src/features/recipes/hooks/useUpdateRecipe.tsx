import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { recipeKeys } from '../query-keys';
import { updateRecipe } from '../services';
import type { RecipeWriteInput } from '../services';

interface UpdateRecipeInput extends RecipeWriteInput {
  id: string;
  existingImageUrl?: string | null;
}

export function useUpdateRecipe(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateRecipeInput) => {
      if (!userId) {
        return Promise.reject(new Error('You must be signed in to edit a recipe.'));
      }
      return updateRecipe(id, input);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists() });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: recipeKeys.user(userId) });
      }
      notifications.show({ title: 'Saved', message: 'Your recipe has been updated.', color: 'green' });
    },
  });
}
