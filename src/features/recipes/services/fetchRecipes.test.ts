import { beforeEach, describe, expect, it } from 'vitest';
import { fetchRecipes } from './fetchRecipes';
import { countRecipes } from './countRecipes';
import { dbRecipe, IDS, TIMESTAMPS } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';

/**
 * Contract of the paginated public recipe list over the wire: real
 * supabase-js against the fake PostgREST store. Asserts the emitted query
 * (filters, ordering, page-size lookahead), the keyset seek across pages,
 * the shared filter clause, and the head-count endpoint.
 */
function seedPage(count: number, startIndex = 0) {
  const rows = Array.from({ length: count }, (_, index) => {
    const position = startIndex + index;
    return dbRecipe({
      id: `ddddddd${(position % 8) + 1}-0000-4000-8000-${String(position).padStart(12, '0')}`,
      title: `Recipe ${position}`,
      created_at: new Date(Date.parse(TIMESTAMPS.t1) + position * 60_000).toISOString(),
      rating_avg: (position % 5) + 1,
      prep_time_minutes: 30 - (position % 20),
    });
  });
  seed('recipes', rows);
  return rows;
}

describe('fetchRecipes — GET /rest/v1/recipes', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('requests only public approved recipes with deterministic ordering and a +1 lookahead', async () => {
    const rows = seedPage(3);
    let query = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      query = String(input);
      return originalFetch(input, init);
    }) as unknown as typeof globalThis.fetch;

    try {
      const page = await fetchRecipes({});
      expect(page.data).toHaveLength(3);
      expect(page.hasNextPage).toBe(false);
      expect(page.nextCursor).toBeNull();
      expect(rows).toHaveLength(3);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const params = new URL(query).searchParams;
    expect(params.get('is_public')).toBe('eq.true');
    expect(params.get('moderation_status')).toBe('eq.approved');
    // Sort column + id tie-breaker (nulls last) + pageSize+1 lookahead;
    // child ordering travels as separate `<embed>.order` params.
    expect(params.get('order')).toBe('created_at.desc.nullslast,id.desc');
    expect(params.get('recipe_ingredients.order')).toBe('position.asc');
    expect(params.get('recipe_steps.order')).toBe('position.asc');
    expect(params.get('limit')).toBe('13');
  });

  it('paginates with the keyset seek: page two continues strictly after the cursor', async () => {
    seedPage(14);
    const first = await fetchRecipes({});
    expect(first.data).toHaveLength(12);
    expect(first.hasNextPage).toBe(true);
    expect(first.nextCursor).not.toBeNull();

    const second = await fetchRecipes({ cursor: first.nextCursor });
    expect(second.data).toHaveLength(2);
    expect(second.hasNextPage).toBe(false);
    expect(second.nextCursor).toBeNull();

    const seen = new Set([...first.data, ...second.data].map((recipe) => recipe.id));
    expect(seen.size).toBe(14); // no row skipped or repeated
    expect(first.data[11].created_at >= second.data[0].created_at).toBe(true); // newest first
  });

  it('resets to the first page when a cursor was issued under a different sort', async () => {
    seedPage(14);
    const first = await fetchRecipes({});
    const recycled = await fetchRecipes({ sort: 'rating', cursor: first.nextCursor });
    expect(recycled.data).toHaveLength(12); // seek dropped, full first page re-served
  });

  it('the exact-boundary page (rows == pageSize) reports no next page', async () => {
    seedPage(12);
    const page = await fetchRecipes({});
    expect(page.data).toHaveLength(12);
    expect(page.hasNextPage).toBe(false);
  });

  it('applies the shared filter clause: text search, cuisine names, tags, prep time', async () => {
    seed('cuisines', [
      { id: IDS.cuisineItalian, name: 'Italian', slug: 'italian', region: null, is_active: true, created_at: TIMESTAMPS.t0 },
      { id: IDS.cuisineJapanese, name: 'Japanese', slug: 'japanese', region: null, is_active: true, created_at: TIMESTAMPS.t0 },
    ]);
    seed('recipes', [
      dbRecipe({ id: IDS.recipeA, title: 'Tomato Rice', cuisine_id: IDS.cuisineItalian, dietary_tags: ['vegetarian'], prep_time_minutes: 15 }),
    ]);

    const page = await fetchRecipes({ q: 'tomato', cuisines: ['Italian'], dietary: ['vegetarian'], max_prep_time: 30 });
    expect(page.data).toHaveLength(1);
    expect(page.data[0].id).toBe(IDS.recipeA);
  });

  it('calorie filters use the inner nutrition join so recipes without nutrition drop out', async () => {
    seed('recipes', [
      dbRecipe({ id: IDS.recipeA, recipe_nutrition: { ...(dbRecipe().recipe_nutrition ?? {}), calories_per_serving: 300 } }),
      dbRecipe({ id: IDS.recipeB, recipe_nutrition: null }),
    ]);

    const page = await fetchRecipes({ max_calories: 500 });
    expect(page.data.map((recipe) => recipe.id)).toEqual([IDS.recipeA]);
  });

  it('sorts by rating with a rating-keyed cursor', async () => {
    seedPage(3);
    const page = await fetchRecipes({ sort: 'rating' });
    const ratings = page.data.map((recipe) => recipe.rating_avg);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });

  it('excludes recipes without prep time when sorting by quickest (keyset needs total order)', async () => {
    seed('recipes', [
      dbRecipe({ id: IDS.recipeA, prep_time_minutes: null }),
      dbRecipe({ id: IDS.recipeB, prep_time_minutes: 10 }),
    ]);
    const page = await fetchRecipes({ sort: 'time' });
    expect(page.data.map((recipe) => recipe.id)).toEqual([IDS.recipeB]);
  });
});

describe('countRecipes — head count of the same result set', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('returns the exact total via the count header', async () => {
    seedPage(3);
    const count = await countRecipes({});
    expect(count).toBe(3);
  });

  it('applies the same filters as the fetch, including the nutrition inner join', async () => {
    seed('recipes', [
      dbRecipe({ id: IDS.recipeA, recipe_nutrition: { ...(dbRecipe().recipe_nutrition ?? {}), calories_per_serving: 300 } }),
      dbRecipe({ id: IDS.recipeB, recipe_nutrition: null }),
    ]);
    const count = await countRecipes({ max_calories: 500 });
    expect(count).toBe(1);
  });
});
