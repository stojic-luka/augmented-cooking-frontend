import Dexie, { type EntityTable } from 'dexie';
import type { MealPlanEntry } from '../types';

/**
 * Meal plans are local-first (IndexedDB via Dexie) — the database no longer
 * stores them. Cross-browser sync happens through the PIN-encrypted backup
 * blob, not live tables.
 */
export const planDb = new Dexie('augmented-cooking-planner') as Dexie & {
  mealPlanEntries: EntityTable<MealPlanEntry, 'id'>;
};

planDb.version(1).stores({
  mealPlanEntries: 'id, date, meal_type, recipe_id',
});
