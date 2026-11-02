export const RECIPES_API_ROUTES = {
  list: '/recipes',
  detail: (id: string) => `/recipes/${id}`,
  import: '/recipes/import',
} as const;
