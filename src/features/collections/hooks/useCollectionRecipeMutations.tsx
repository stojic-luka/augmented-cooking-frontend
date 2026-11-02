import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { collectionKeys } from '../query-keys';
import { addRecipeToCollection, removeRecipeFromCollection } from '../services';

export function useRemoveRecipeFromCollection(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: string) => removeRecipeFromCollection(collectionId, recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) });
      notifications.show({ message: 'Recipe removed from collection.', color: 'green' });
    },
  });
}

export function useAddToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) =>
      addRecipeToCollection(collectionId, recipeId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.detail(variables.collectionId) });
      notifications.show({ message: 'Added to collection.', color: 'green' });
    },
  });
}
