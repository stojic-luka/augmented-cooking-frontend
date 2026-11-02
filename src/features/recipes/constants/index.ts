/**
 * URL of the authenticated recipe explorer (protected twin). The anonymous
 * explorer lives at `/recipes` — both URLs share one page implementation
 * (`components/RecipeExplorerPage`) and redirect to each other by auth state.
 */
export const RECIPES_SEARCH_PATH = '/recipes/search';
export const RECIPE_IMAGES_BUCKET = 'recipe-images';
