import type { RecipeListFilters } from '../types';

export const recipeKeys = {
  all: ['recipes'] as const,
  lists: () => [...recipeKeys.all, 'list'] as const,
  /** Filters only — the cursor flows through the infinite query's pageParam, never the key. */
  list: (filters: RecipeListFilters) => [...recipeKeys.lists(), filters] as const,
  count: (filters: RecipeListFilters) => [...recipeKeys.all, 'count', filters] as const,
  details: () => [...recipeKeys.all, 'detail'] as const,
  detail: (id: string) => [...recipeKeys.details(), id] as const,
  /** Owner-scoped infinite list — the cursor flows through pageParam, never the key. */
  user: (userId: string) => [...recipeKeys.all, 'user', userId] as const,
  favorites: (userId: string) => [...recipeKeys.all, 'favorites', userId] as const,
  isFavorite: (userId: string, recipeId: string) => [...recipeKeys.all, 'is-favorite', userId, recipeId] as const,
  cuisines: () => [...recipeKeys.all, 'cuisines'] as const,
  recipeImageUrl: (path: string | null | undefined) => [...recipeKeys.all, 'image-url', path ?? null] as const,
};
