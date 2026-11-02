import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { recipeKeys } from '@features/recipes';
import { moderatorKeys } from '../query-keys';
import { fetchPendingRecipes, moderateRecipe } from '../services';
import type { ModerationDecision } from '../types';

export const pendingRecipesOptions = () =>
  queryOptions({
    queryKey: moderatorKeys.pendingRecipes(),
    queryFn: fetchPendingRecipes,
  });
export const usePendingRecipes = () => useQuery(pendingRecipesOptions());

export function useModerateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipeId, decision }: { recipeId: string; decision: ModerationDecision }) =>
      moderateRecipe(recipeId, decision),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: moderatorKeys.pendingRecipes() });
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      notifications.show({
        message: `Recipe ${variables.decision === 'approve' ? 'approved' : variables.decision === 'reject' ? 'rejected' : 'flagged'}.`,
        color: 'green',
      });
    },
  });
}
