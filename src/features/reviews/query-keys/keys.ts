export const reviewKeys = {
  all: ['reviews'] as const,
  recipe: (recipeId: string) => [...reviewKeys.all, 'recipe', recipeId] as const,
  ratings: (recipeIds: string[]) => [...reviewKeys.all, 'ratings', recipeIds] as const,
  reviewImageUrl: (path: string | null | undefined) => [...reviewKeys.all, 'image-url', path ?? null] as const,
};
