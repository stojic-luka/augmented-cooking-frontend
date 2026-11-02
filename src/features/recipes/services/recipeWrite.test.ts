import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createRecipe } from './createRecipe';
import { updateRecipe } from './updateRecipe';
import { deleteRecipe } from './deleteRecipe';
import { copyRecipe } from './copyRecipe';
import { fetchRecipeDetails } from './fetchRecipeDetails';
import { fetchUserRecipes } from './fetchUserRecipes';
import { toggleFavoriteRecipe } from './toggleFavoriteRecipe';
import { fetchFavoriteRecipes } from './fetchFavoriteRecipes';
import { ensureIngredientIds } from './ensureIngredients';
import { fetchCuisines, resolveCuisineId } from './fetchCuisines';
import { fetchUnitCodes } from './fetchUnits';
import type { RecipeFormValues } from '../types';
import { RECIPES_PAGE_SIZE } from '../types';
import { dbRecipe, IDS, TIMESTAMPS } from '@/test/fixtures/db';
import { clearTables, seed, tables } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { server } from '@/test/server';
import { TEST_ORIGIN } from '@/test/origin';

const formValues: RecipeFormValues = {
  title: 'My Tomato Rice',
  description: 'Hand written.',
  cuisine: 'Italian',
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  servings: 2,
  difficulty: 'easy',
  dietaryTags: ['vegetarian'],
  isPublic: true,
  ingredients: [
    { name: ' Tomato ', amount: '200', unit: 'g' },
    { name: 'saffron', amount: '', unit: 'pinch' },
  ],
  steps: [{ instruction: 'Cook it.' }],
};

describe('recipes read services', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('fetchRecipeDetails returns the parsed recipe with sorted children', async () => {
    seed('recipes', [
      dbRecipe({
        recipe_ingredients: [
          { ...dbRecipe().recipe_ingredients[0], position: 2, id: 'i2' },
          { ...dbRecipe().recipe_ingredients[0], position: 1, id: 'i1' },
        ],
        recipe_steps: [
          { ...dbRecipe().recipe_steps[0], position: 2, id: 's2' },
          { ...dbRecipe().recipe_steps[0], position: 1, id: 's1' },
        ],
      }),
    ]);

    const recipe = await fetchRecipeDetails(IDS.recipeA);
    expect(recipe.title).toBe('Tomato Rice');
    expect(recipe.recipe_ingredients.map((entry) => entry.position)).toEqual([1, 2]);
    expect(recipe.recipe_steps.map((entry) => entry.position)).toEqual([1, 2]);
  });

  it('fetchRecipeDetails distinguishes a missing recipe from a backend error', async () => {
    await expect(fetchRecipeDetails(IDS.recipeA)).rejects.toThrow('Recipe not found.');
  });

  it('fetchUserRecipes scopes to the user and orders newest first', async () => {
    seed('recipes', [
      dbRecipe({ id: IDS.recipeA, user_id: IDS.user, created_at: TIMESTAMPS.t1 }),
      dbRecipe({ id: IDS.recipeB, user_id: IDS.otherUser, created_at: TIMESTAMPS.t2 }),
    ]);
    const page = await fetchUserRecipes(IDS.user, null);
    expect(page.data.map((recipe) => recipe.id)).toEqual([IDS.recipeA]);
    expect(page.hasNextPage).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('fetchUserRecipes paginates with the keyset seek: page two continues after the cursor', async () => {
    seed(
      'recipes',
      Array.from({ length: RECIPES_PAGE_SIZE + 2 }, (_, index) =>
        dbRecipe({
          id: `ddddddd${(index % 8) + 1}-0000-4000-8000-${String(index).padStart(12, '0')}`,
          user_id: IDS.user,
          created_at: new Date(Date.parse(TIMESTAMPS.t1) + index * 60_000).toISOString(),
        }),
      ),
    );

    const first = await fetchUserRecipes(IDS.user, null);
    expect(first.data).toHaveLength(RECIPES_PAGE_SIZE);
    expect(first.hasNextPage).toBe(true);
    expect(first.nextCursor).not.toBeNull();

    const second = await fetchUserRecipes(IDS.user, first.nextCursor);
    expect(second.data).toHaveLength(2);
    expect(second.hasNextPage).toBe(false);
    expect(second.nextCursor).toBeNull();

    const seen = new Set([...first.data, ...second.data].map((recipe) => recipe.id));
    expect(seen.size).toBe(RECIPES_PAGE_SIZE + 2); // no row skipped or repeated
  });

  it('fetchFavoriteRecipes unwraps the favorites join', async () => {
    seed('favorites', [{ user_id: IDS.user, recipe_id: IDS.recipeA, created_at: TIMESTAMPS.t1 }]);
    seed('recipes', [dbRecipe()]);
    const recipes = await fetchFavoriteRecipes(IDS.user);
    expect(recipes).toHaveLength(1);
    expect(recipes[0].id).toBe(IDS.recipeA);
  });

  it('toggleFavoriteRecipe inserts, tolerates duplicates (23505), and unfavorites', async () => {
    await toggleFavoriteRecipe(IDS.user, IDS.recipeA, true);
    expect(tables.favorites).toHaveLength(1);

    // Re-favoriting an existing row is a no-op, not an error.
    await expect(toggleFavoriteRecipe(IDS.user, IDS.recipeA, true)).resolves.toBeUndefined();
    expect(tables.favorites).toHaveLength(1);

    await toggleFavoriteRecipe(IDS.user, IDS.recipeA, false);
    expect(tables.favorites).toHaveLength(0);
  });

  it('ensureIngredientIds reuses master rows, inserts missing ones, and keeps input order', async () => {
    seed('ingredients', [dbRecipe().recipe_ingredients[0].ingredient as Record<string, unknown>]);

    const ids = await ensureIngredientIds(['Tomato', 'saffron', 'tomato ']);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(IDS.ingredientTomato);
    expect(ids[2]).toBe(IDS.ingredientTomato); // duplicate collapses
    expect(ids[1]).not.toBe(ids[0]); // missing row inserted
    const names = tables.ingredients.map((row) => row.name);
    expect(names).toContain('saffron');
  });

  it('fetchCuisines returns active options; resolveCuisineId is case-insensitive', async () => {
    seed('cuisines', [
      { id: IDS.cuisineItalian, name: 'Italian', slug: 'italian', region: null, is_active: true, created_at: TIMESTAMPS.t0 },
      { id: IDS.cuisineJapanese, name: 'Japanese', slug: 'japanese', region: null, is_active: false, created_at: TIMESTAMPS.t0 },
    ]);
    const cuisines = await fetchCuisines();
    expect(cuisines.map((cuisine) => cuisine.name)).toEqual(['Italian']);
    expect(resolveCuisineId('italian', cuisines)).toBe(IDS.cuisineItalian);
    expect(resolveCuisineId('  ', cuisines)).toBeNull();
    expect(resolveCuisineId('Thai', cuisines)).toBeNull();
  });

  it('fetchUnitCodes lowercases active unit codes', async () => {
    seed('units', [
      { code: 'g', created_at: TIMESTAMPS.t0, is_active: true },
      { code: 'PC', created_at: TIMESTAMPS.t0, is_active: true },
      { code: 'oz', created_at: TIMESTAMPS.t0, is_active: false },
    ]);
    const codes = await fetchUnitCodes();
    expect([...codes].sort()).toEqual(['g', 'pc']);
  });
});

describe('recipes write path (createRecipe orchestration)', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
    seed('cuisines', [
      { id: IDS.cuisineItalian, name: 'Italian', slug: 'italian', region: null, is_active: true, created_at: TIMESTAMPS.t0 },
    ]);
    seed('units', [
      { code: 'g', created_at: TIMESTAMPS.t0, is_active: true },
      { code: 'pinch', created_at: TIMESTAMPS.t0, is_active: true },
    ]);
    seed('ingredients', [
      { id: IDS.ingredientTomato, name: 'tomato', aliases: [], category: 'produce', is_active: true, created_at: TIMESTAMPS.t0 },
    ]);
  });

  it('creates the recipe row, then ingredients and steps, and returns the full recipe', async () => {
    const recipe = await createRecipe({ values: formValues, userId: IDS.user });

    expect(recipe.title).toBe('My Tomato Rice');
    expect(recipe.cuisine_id).toBe(IDS.cuisineItalian);
    expect(recipe.is_public).toBe(true);

    const [stored] = tables.recipes;
    expect(stored).toMatchObject({ title: 'My Tomato Rice', user_id: IDS.user, moderation_status: 'pending' });

    const ingredientRows = tables.recipe_ingredients;
    expect(ingredientRows).toHaveLength(2);
    // "200 g" resolves to the known unit; "pinch" resolves via the units table.
    expect(ingredientRows[0]).toMatchObject({ ingredient_id: IDS.ingredientTomato, quantity: 200, unit: 'g', note: null });
    expect(ingredientRows[1]).toMatchObject({ unit: 'pinch', note: null });
    expect(tables.recipe_steps).toHaveLength(1);
  });

  it('preserves unparsable amounts as a note instead of dropping them', async () => {
    const values: RecipeFormValues = {
      ...formValues,
      ingredients: [{ name: 'salt', amount: 'a pinch', unit: '' }],
    };
    await createRecipe({ values, userId: IDS.user });
    expect(tables.recipe_ingredients[0]).toMatchObject({ quantity: null, unit: null, note: 'a pinch' });
  });

  it('updateRecipe replaces children and scopes the update to the owner', async () => {
    seed('recipes', [dbRecipe()]);
    const values: RecipeFormValues = { ...formValues, title: 'Updated Title' };

    const updated = await updateRecipe(IDS.recipeA, { values, userId: IDS.user, existingImageUrl: null });

    expect(updated.title).toBe('Updated Title');
    expect(tables.recipes[0].title).toBe('Updated Title');
    // Children were replaced (delete + insert), positions restart at 1.
    expect(tables.recipe_ingredients).toHaveLength(2);
    expect(tables.recipe_steps).toHaveLength(1);
  });

  it('updateRecipe aborts the re-insert when a child delete fails (regression)', async () => {
    seed('recipes', [dbRecipe()]);
    const before = (tables.recipe_ingredients ?? []).length;
    server.use(
      http.delete(`${TEST_ORIGIN}/rest/v1/recipe_ingredients`, () =>
        HttpResponse.json({ message: 'RLS denied' }, { status: 403 }),
      ),
    );

    // Regression: the delete's error used to be discarded, so the insert ran
    // on top of the surviving rows and duplicated every ingredient.
    await expect(
      updateRecipe(IDS.recipeA, { values: formValues, userId: IDS.user, existingImageUrl: null }),
    ).rejects.toThrow('Failed to replace recipe details');
    expect(tables.recipe_ingredients ?? []).toHaveLength(before);
  });

  it('deleteRecipe scopes deletion to the owner', async () => {
    seed('recipes', [
      dbRecipe({ id: IDS.recipeA, user_id: IDS.user }),
      dbRecipe({ id: IDS.recipeB, user_id: IDS.otherUser }),
    ]);
    await deleteRecipe(IDS.recipeA, IDS.user);
    expect(tables.recipes.map((row) => row.id)).toEqual([IDS.recipeB]);
  });

  it('copyRecipe duplicates with a "(copy)" title, private visibility, and original link', async () => {
    seed('recipes', [dbRecipe()]);
    const original = await fetchRecipeDetails(IDS.recipeA);

    const copy = await copyRecipe(original, IDS.otherUser);

    expect(copy.title).toBe('Tomato Rice (copy)');
    expect(copy.is_public).toBe(false);
    expect(copy.original_recipe_id).toBe(IDS.recipeA);
    expect(tables.recipe_ingredients.filter((row) => row.recipe_id === copy.id)).toHaveLength(1);
    expect(tables.recipe_steps.filter((row) => row.recipe_id === copy.id)).toHaveLength(1);
  });
});
