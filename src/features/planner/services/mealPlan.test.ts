import { beforeEach, describe, expect, it } from 'vitest';
import { addMealEntry, fetchMealPlan, removeMealEntry, updateMealEntryServings } from './mealPlan';
import { planDb } from '../lib/planDb';
import { dbRecipe, IDS, TIMESTAMPS } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';

/**
 * The planner joins local Dexie entries with Supabase recipes at read time.
 * Covers the join (including recipes that vanished), ordering, and CRUD.
 */
describe('mealPlan service (Dexie + Supabase join)', () => {
  beforeEach(async () => {
    seedSession();
    clearTables();
    await planDb.mealPlanEntries.clear();
  });

  it('joins entries with their recipes and sorts by date then meal type', async () => {
    seed('recipes', [dbRecipe()]);
    await addMealEntry(null, { date: '2026-01-06', mealType: 'lunch', recipeId: IDS.recipeA, servings: 2 });
    await addMealEntry(null, { date: '2026-01-05', mealType: 'dinner', recipeId: IDS.recipeA, servings: 4 });
    await addMealEntry(null, { date: '2026-01-05', mealType: 'breakfast', recipeId: IDS.recipeA, servings: 1 });

    const plan = await fetchMealPlan(null, '2026-01-05', '2026-01-05'.replace('05', '06'));
    expect(plan.map((entry) => [entry.date, entry.meal_type])).toEqual([
      ['2026-01-05', 'breakfast'],
      ['2026-01-05', 'dinner'],
      ['2026-01-06', 'lunch'],
    ]);
    expect(plan[2].recipes?.title).toBe('Tomato Rice');
    expect(plan[2].servings).toBe(2);
  });

  it('keeps entries whose recipe no longer exists, with a null recipe', async () => {
    await addMealEntry(null, { date: '2026-01-05', mealType: 'dinner', recipeId: 'deleted-recipe', servings: 2 });
    const plan = await fetchMealPlan(null, TIMESTAMPS.t0.slice(0, 10), '2026-12-31');
    expect(plan).toHaveLength(1);
    expect(plan[0].recipes).toBeNull();
  });

  it('returns an empty plan for weeks without entries', async () => {
    expect(await fetchMealPlan(null, '2030-01-05', '2030-01-11')).toEqual([]);
  });

  it('updates servings and removes entries', async () => {
    await addMealEntry(null, { date: '2026-01-05', mealType: 'dinner', recipeId: IDS.recipeA, servings: 2 });
    const [entry] = await planDb.mealPlanEntries.toArray();

    await updateMealEntryServings(entry.id, 6);
    expect((await planDb.mealPlanEntries.get(entry.id))?.servings).toBe(6);

    await removeMealEntry(entry.id);
    expect(await planDb.mealPlanEntries.toArray()).toEqual([]);
  });
});
