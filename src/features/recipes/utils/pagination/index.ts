import { z } from 'zod';
import type { FullRecipe } from '../../types';

/**
 * Cursor (keyset) pagination — the single module every paginated list
 * shares. The recipe endpoints own it (schema, sort specs, and select
 * string change together: a sort spec's column must exist in
 * `RECIPE_SELECT`, and the response a seek produces is validated by
 * `FetchRecipesResponseSchema`); any newest-first list (the admin
 * registries included) reuses the codec and seek helpers for its own rows.
 *
 * Technique: each page fetches `pageSize + 1` rows ordered by
 * `(sort column, id)`. On later pages a keyset seek restricts rows to those
 * strictly after the cursor (`lt` for descending sorts, `gt` for ascending,
 * applied to the sort column AND the unique `id` tie-breaker, so tied sort
 * values never skip rows). `hasNextPage` is the lookahead row; `nextCursor`
 * encodes the last returned row and is null when there is no next page.
 */

/**
 * Wire format of a cursor, base64-encoded JSON. `v` travels inside a quoted
 * PostgREST `.or()` literal, so quotes, commas, and parens are rejected at
 * decode time — a crafted cursor cannot inject filter syntax. Cursors arrive
 * from URLs and are untrusted: any decode failure means "first page".
 */
export const CursorPayloadSchema = z.object({
  sort: z.string(),
  v: z.string().min(1).regex(/^[^"(),]+$/),
  id: z.uuid(),
});
export type CursorPayload = z.infer<typeof CursorPayloadSchema>;

/**
 * Browser-side codec (this app only fetches in the browser; a server
 * counterpart would swap `btoa`/`atob` for `Buffer`).
 */
export function encodeCursor(payload: CursorPayload): string {
  return btoa(JSON.stringify(payload));
}

/** Returns null instead of throwing for any malformed cursor payload. */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return CursorPayloadSchema.parse(JSON.parse(atob(cursor)));
  } catch {
    return null;
  }
}

/**
 * Sort options of the recipe list endpoint. Every paginated recipe query
 * orders by the spec's column plus the `id` tie-breaker in the same
 * direction, and seeks on both — the tie-breaker is what keeps rows with
 * equal sort values from being skipped or repeated across page boundaries.
 * `prep_time_minutes` is nullable: the `time` sort pairs with an explicit
 * `.not(column, 'is', null)` filter (seeks never match SQL NULL).
 */
export const SORT_SPECS = {
  recent: { column: 'created_at', descending: true },
  rating: { column: 'rating_avg', descending: true },
  time: { column: 'prep_time_minutes', descending: false },
} as const;

export type RecipeSortKey = keyof typeof SORT_SPECS;
export type RecipeSortSpec = (typeof SORT_SPECS)[RecipeSortKey];

/**
 * Decodes a cursor for a specific sort. A cursor issued under a different
 * sort resets to the first page (null) rather than erroring.
 */
export function decodeCursorForSort(cursor: string, sort: RecipeSortKey): CursorPayload | null {
  const payload = decodeCursor(cursor);
  return payload?.sort === sort ? payload : null;
}

/**
 * Encodes the cursor pointing at `row` — the last row of a page. Callers
 * only encode rows that passed the seek filters, so the sort column value
 * is never SQL NULL (see the nullability note on {@link SORT_SPECS}).
 * Per-sort overloads keep the row check exact — each sort demands `id`
 * plus its own column — so non-recipe rows (admin users, bug reports,
 * anything with `created_at`) encode cursors with the same codec.
 */
export function encodeRecipeCursor(sort: RecipeSortKey, row: FullRecipe): string;
export function encodeRecipeCursor(sort: 'recent', row: Pick<FullRecipe, 'id' | 'created_at'>): string;
export function encodeRecipeCursor(sort: 'rating', row: Pick<FullRecipe, 'id' | 'rating_avg'>): string;
export function encodeRecipeCursor(sort: 'time', row: Pick<FullRecipe, 'id' | 'prep_time_minutes'>): string;
export function encodeRecipeCursor(
  sort: RecipeSortKey,
  row: { id: string } & Partial<Record<(typeof SORT_SPECS)[RecipeSortKey]['column'], unknown>>,
): string {
  const spec = SORT_SPECS[sort];
  return encodeCursor({ sort, v: String(row[spec.column]), id: row.id });
}

/**
 * Keyset seek predicate for PostgREST `.or()`: rows strictly after the
 * cursor in sort order, tie-broken by `id`. Values are double-quoted because
 * timestamps contain `:`/`+` — the characters are safe inside the quotes,
 * and `CursorPayloadSchema` guarantees the value holds no quote/comma/paren.
 */
export function cursorSeekFilter(spec: RecipeSortSpec, cursor: CursorPayload): string {
  const cmp = spec.descending ? 'lt' : 'gt';
  return `${spec.column}.${cmp}."${cursor.v}",and(${spec.column}.eq."${cursor.v}",id.${cmp}."${cursor.id}")`;
}
