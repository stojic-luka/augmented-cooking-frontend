import { queryOptions, useQuery } from '@tanstack/react-query';
import { recipeKeys } from '../query-keys';
import { fetchRecipeDetails } from '../services';

export const recipeDetailsOptions = (id: string) =>
  queryOptions({
    queryKey: recipeKeys.detail(id),
    queryFn: () => fetchRecipeDetails(id),
    enabled: Boolean(id),
  });
export const useRecipeDetails = (id: string) => useQuery(recipeDetailsOptions(id));
