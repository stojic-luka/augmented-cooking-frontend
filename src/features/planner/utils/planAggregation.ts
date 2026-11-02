import type { MealPlanEntryWithRecipe } from '../types';

export interface MergedIngredient {
  name: string;
  amount: number | null;
  unit: string;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Monday as the first day of the week. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Aggregates plan ingredients across the week. Items merge when name and unit
 * match (scaled to the planned servings); everything else is listed as-is.
 */
export function mergePlanIngredients(entries: MealPlanEntryWithRecipe[]): MergedIngredient[] {
  const merged = new Map<string, MergedIngredient>();

  for (const entry of entries) {
    const recipe = entry.recipes;
    if (!recipe) continue;

    for (const ingredient of recipe.recipe_ingredients) {
      const unit = ingredient.unit?.trim().toLowerCase() ?? '';
      const name = ingredient.ingredient.name;

      // Normalize keys so "2 cups rice" and "1 cup Rice" merge.
      const nameKey = name.trim().toLowerCase();
      const key = `${nameKey}__${unit}`;

      const scaled =
        ingredient.quantity !== null && recipe.servings > 0
          ? ingredient.quantity * (entry.servings / recipe.servings)
          : null;

      const existing = merged.get(key);
      if (existing) {
        // An unquantified entry ("to taste") stays as-is; a quantified one
        // adds up. The old truthiness check silently dropped the second
        // amount whenever the first was null or zero.
        if (scaled !== null) {
          existing.amount = (existing.amount ?? 0) + scaled;
        }
      } else {
        merged.set(key, { name: name.trim(), amount: scaled, unit: ingredient.unit ?? '' });
      }
    }
  }

  return [...merged.values()];
}

export interface DayNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function computeDayNutrition(entries: MealPlanEntryWithRecipe[]): Map<string, DayNutrition> {
  const byDate = new Map<string, DayNutrition>();

  for (const entry of entries) {
    const recipe = entry.recipes;
    if (!recipe) continue;
    const scale = entry.servings > 0 ? entry.servings / recipe.servings : 1;

    const current = byDate.get(entry.date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const nutrition = recipe.recipe_nutrition;
    current.calories += (nutrition?.calories_per_serving ?? 0) * scale;
    current.protein += (nutrition?.protein_grams ?? 0) * scale;
    current.carbs += (nutrition?.carbs_grams ?? 0) * scale;
    current.fat += (nutrition?.fat_grams ?? 0) * scale;
    byDate.set(entry.date, current);
  }

  return byDate;
}
