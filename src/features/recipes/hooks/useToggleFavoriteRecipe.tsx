import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { recipeKeys } from '../query-keys';
import { toggleFavoriteRecipe } from '../services';

interface ToggleFavoriteInput {
  userId: string;
  recipeId: string;
  favorite: boolean;
}

export function useToggleFavoriteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, recipeId, favorite }: ToggleFavoriteInput) =>
      toggleFavoriteRecipe(userId, recipeId, favorite),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.isFavorite(variables.userId, variables.recipeId) });
      queryClient.invalidateQueries({ queryKey: recipeKeys.favorites(variables.userId) });
      notifications.show({
        message: variables.favorite ? 'Added to your favorites.' : 'Removed from your favorites.',
        color: 'green',
      });
    },
  });
}
