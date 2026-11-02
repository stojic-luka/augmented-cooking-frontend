import { describe, expect, it } from 'vitest';
import {
  CursorPayloadSchema,
  cursorSeekFilter,
  decodeCursor,
  decodeCursorForSort,
  encodeCursor,
  encodeRecipeCursor,
  SORT_SPECS,
} from './index';
import { dbRecipe, IDS, TIMESTAMPS } from '@/test/fixtures/db';
import type { FullRecipe } from '@features/recipes/types';

describe('cursor codec', () => {
  it('round-trips a payload through base64 JSON', () => {
    const payload = { sort: 'recent', v: TIMESTAMPS.t1, id: IDS.recipeA };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('returns null for any malformed payload — cursors are untrusted input', () => {
    expect(decodeCursor('not base64 at all!')).toBeNull();
    expect(decodeCursor(encodeCursor({ sort: 'recent', v: '', id: IDS.recipeA }))).toBeNull(); // empty value
    expect(decodeCursor(encodeCursor({ sort: 'recent', v: 'x', id: 'not-a-uuid' }))).toBeNull();
    expect(decodeCursor(btoa('"just a string"'))).toBeNull();
    expect(decodeCursor(btoa('null'))).toBeNull();
  });

  it('rejects injection characters in the seek value', () => {
    // Quotes/commas/parens would break out of the PostgREST .or() literal.
    const malicious = { sort: 'recent', v: '2026-01-01",is_public.eq.false,(",x', id: IDS.recipeA };
    expect(() => CursorPayloadSchema.parse(malicious)).toThrow();
    expect(decodeCursor(encodeCursor(malicious))).toBeNull();
  });

  it('decodes only for the sort the cursor was issued under', () => {
    const cursor = encodeCursor({ sort: 'rating', v: '4.5', id: IDS.recipeA });
    expect(decodeCursorForSort(cursor, 'rating')).not.toBeNull();
    expect(decodeCursorForSort(cursor, 'recent')).toBeNull();
  });

  it('encodes the last row of a page per the sort spec', () => {
    const row = dbRecipe({ id: IDS.recipeB, rating_avg: 4.75 });
    expect(encodeRecipeCursor('rating', row as unknown as FullRecipe)).toBe(
      encodeCursor({ sort: 'rating', v: '4.75', id: IDS.recipeB }),
    );
  });
});

describe('cursor seek filter', () => {
  it('DESC sorts seek strictly-before plus the id tie-breaker', () => {
    const spec = SORT_SPECS.recent;
    const filter = cursorSeekFilter(spec, { sort: 'recent', v: TIMESTAMPS.t1, id: IDS.recipeA });
    expect(filter).toBe(
      `created_at.lt."${TIMESTAMPS.t1}",and(created_at.eq."${TIMESTAMPS.t1}",id.lt."${IDS.recipeA}")`,
    );
  });

  it('ASC sorts (quickest) seek strictly-after', () => {
    const filter = cursorSeekFilter(SORT_SPECS.time, { sort: 'time', v: '30', id: IDS.recipeA });
    expect(filter).toBe(`prep_time_minutes.gt."30",and(prep_time_minutes.eq."30",id.gt."${IDS.recipeA}")`);
  });
});
