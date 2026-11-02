import { getSupabaseBrowserClient } from '@lib/supabase';
import { fullRecipeSchema, RECIPE_SELECT, type FullRecipe } from '@features/recipes';
import { planDb } from '../lib/planDb';
import { mealPlanEntryWithRecipeSchema, type MealPlanEntryWithRecipe, type MealType } from '../types';

async function fetchPlanRecipes(recipeIds: string[]): Promise<Map<string, FullRecipe>> {
  if (recipeIds.length === 0) return new Map();

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .in('id', recipeIds)
    .order('position', { referencedTable: 'recipe_ingredients', ascending: true })
    .order('position', { referencedTable: 'recipe_steps', ascending: true });

  if (error) {
    throw new Error(`Failed to fetch planned recipes: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((row) => {
      const recipe = fullRecipeSchema.parse(row);
      return [recipe.id, recipe];
    }),
  );
}

export async function fetchMealPlan(
  _userId: string | null,
  weekStart: string,
  weekEnd: string,
): Promise<MealPlanEntryWithRecipe[]> {
  const entries = await planDb.mealPlanEntries.where('date').between(weekStart, weekEnd, true, true).toArray();

  const recipes = await fetchPlanRecipes([...new Set(entries.map((entry) => entry.recipe_id))]);

  return entries
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.meal_type.localeCompare(b.meal_type))
    .map((entry) =>
      mealPlanEntryWithRecipeSchema.parse({
        ...entry,
        recipes: recipes.get(entry.recipe_id) ?? null,
      }),
    );
}

export async function addMealEntry(
  _userId: string | null,
  input: { date: string; mealType: MealType; recipeId: string; servings: number },
): Promise<void> {
  await planDb.mealPlanEntries.add({
    id: crypto.randomUUID(),
    date: input.date,
    meal_type: input.mealType,
    recipe_id: input.recipeId,
    servings: input.servings,
    created_at: new Date().toISOString(),
  });
}

export async function updateMealEntryServings(entryId: string, servings: number): Promise<void> {
  await planDb.mealPlanEntries.update(entryId, { servings });
}

export async function removeMealEntry(entryId: string): Promise<void> {
  await planDb.mealPlanEntries.delete(entryId);
}
