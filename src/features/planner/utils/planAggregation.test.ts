import { describe, expect, it } from 'vitest';
import { addDays, computeDayNutrition, formatDayLabel, mergePlanIngredients, startOfWeek, toIsoDate } from './planAggregation';
import { dbRecipe, IDS } from '@/test/fixtures/db';
import type { MealPlanEntryWithRecipe, PlanRecipe } from '../types';

/** Fixtures are plain JSON; the domain type is asserted at the seam. */
const asRecipe = (row: Record<string, unknown>) => row as unknown as PlanRecipe;

function entry(overrides: Partial<MealPlanEntryWithRecipe> & { date: string; servings: number }): MealPlanEntryWithRecipe {
  return {
    id: 'entry-1',
    meal_type: 'dinner',
    recipe_id: IDS.recipeA,
    recipes: asRecipe(dbRecipe()),
    created_at: '2026-01-05T10:00:00Z',
    ...overrides,
  };
}

describe('date helpers', () => {
  it('toIsoDate formats local dates zero-padded', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('startOfWeek returns the Monday of the week (Sunday wraps back)', () => {
    const wednesday = new Date(2026, 0, 7); // Wed
    expect(startOfWeek(wednesday).getDay()).toBe(1);
    expect(toIsoDate(startOfWeek(wednesday))).toBe('2026-01-05');

    const sunday = new Date(2026, 0, 11); // Sun
    expect(toIsoDate(startOfWeek(sunday))).toBe('2026-01-05');
    expect(startOfWeek(sunday).getHours()).toBe(0);
  });

  it('addDays moves across month boundaries', () => {
    expect(toIsoDate(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });

  it('formatDayLabel renders a short US weekday label', () => {
    expect(formatDayLabel(new Date(2026, 0, 7))).toBe('Wed, Jan 7');
  });
});

describe('mergePlanIngredients', () => {
  it('merges same name+unit entries across days, scaling to planned servings', () => {
    const rice = dbRecipe(); // 200 g for 4 servings
    const plan = [
      entry({ date: '2026-01-05', servings: 4, recipes: asRecipe(rice) }),
      entry({ date: '2026-01-06', servings: 2, recipes: asRecipe(rice) }),
    ];
    const merged = mergePlanIngredients(plan);
    const tomato = merged.find((item) => item.name === 'tomato');
    expect(tomato).toEqual({ name: 'tomato', amount: 200 + 100, unit: 'g' });
  });

  it('merges case-insensitively on name and trimmed unit', () => {
    const a = dbRecipe({ recipe_ingredients: [{ ...dbRecipe().recipe_ingredients[0], unit: 'g' }] });
    const b = dbRecipe({ recipe_ingredients: [{ ...dbRecipe().recipe_ingredients[0], ingredient: { ...dbRecipe().recipe_ingredients[0].ingredient, name: 'Tomato' } }] });
    const merged = mergePlanIngredients([
      entry({ date: '2026-01-05', servings: 4, recipes: asRecipe(a) }),
      entry({ date: '2026-01-05', servings: 4, recipes: asRecipe(b) }),
    ]);
    expect(merged.filter((item) => item.name.toLowerCase() === 'tomato')).toHaveLength(1);
  });

  it('lists null-quantity and unscaled ingredients as-is; skips recipes missing from the DB', () => {
    const noQuantity = dbRecipe({ recipe_ingredients: [{ ...dbRecipe().recipe_ingredients[0], quantity: null, unit: null }] });
    const plan = [
      entry({ date: '2026-01-05', servings: 4, recipes: asRecipe(noQuantity) }),
      entry({ date: '2026-01-06', servings: 2, recipes: null }),
    ];
    const merged = mergePlanIngredients(plan);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ name: 'tomato', amount: null, unit: '' });
  });

  it('adds a quantified amount onto a prior unquantified entry instead of dropping it', () => {
    const first = dbRecipe({ recipe_ingredients: [{ ...dbRecipe().recipe_ingredients[0], quantity: null }] });
    const second = dbRecipe();
    const merged = mergePlanIngredients([
      entry({ date: '2026-01-05', servings: 4, recipes: asRecipe(first) }),
      entry({ date: '2026-01-06', servings: 4, recipes: asRecipe(second) }),
    ]);
    // Regression: the "to taste" (null-amount) entry used to make the truthy
    // guard skip the merge entirely, silently losing the 200 g contribution.
    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(200);
  });
});

describe('computeDayNutrition', () => {
  it('scales macros by planned servings per day', () => {
    const plan = [
      entry({ date: '2026-01-05', servings: 4 }), // 540 kcal per serving at 4
      entry({ date: '2026-01-05', servings: 2 }), // half scale → 540
      entry({ date: '2026-01-06', servings: 4 }),
    ];
    const byDate = computeDayNutrition(plan);
    expect(byDate.get('2026-01-05')?.calories).toBeCloseTo(540 + 270);
    expect(byDate.get('2026-01-06')?.calories).toBeCloseTo(540);
    expect(byDate.get('2026-01-06')?.protein).toBeCloseTo(32);
  });

  it('handles zero-servings (scale 1 by convention) and recipes without nutrition data', () => {
    const plan = [
      entry({ date: '2026-01-05', servings: 0 }),
      entry({ date: '2026-01-06', servings: 2, recipes: asRecipe(dbRecipe({ recipe_nutrition: null })) }),
    ];
    const byDate = computeDayNutrition(plan);
    // servings=0 falls back to scale 1 — full per-serving values (the UI
    // never produces 0, this documents the guard).
    expect(byDate.get('2026-01-05')?.calories).toBeCloseTo(540);
    expect(byDate.get('2026-01-06')?.calories).toBe(0);
  });
});
