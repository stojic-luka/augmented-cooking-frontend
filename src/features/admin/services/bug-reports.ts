import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { SORT_SPECS, cursorSeekFilter, decodeCursorForSort, encodeRecipeCursor } from '@features/recipes';
import { publicSupportTicketsRowSchema } from '@/types/schemas';

/** Rows per admin registry page; the +1 lookahead row answers hasNextPage. */
export const ADMIN_BUG_REPORTS_PAGE_SIZE = 25;

/**
 * One keyset-paginated page of the bug-report inbox — the same
 * `{ data, nextCursor, hasNextPage }` envelope every paginated list uses.
 */
export const AdminBugReportPageSchema = z.object({
  data: z.array(publicSupportTicketsRowSchema),
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});
export type AdminBugReportPage = z.infer<typeof AdminBugReportPageSchema>;

/**
 * One keyset-paginated page of the bug-report inbox, newest first. Cursor
 * in, page out, on the shared `recent` sort and cursor codec, so a page
 * never repeats or skips rows.
 */
export async function fetchAdminBugReports(cursor: string | null): Promise<AdminBugReportPage> {
  const supabase = getSupabaseBrowserClient();
  const spec = SORT_SPECS.recent;
  const payload = cursor ? decodeCursorForSort(cursor, 'recent') : null;

  let query = supabase.from('support_tickets').select('*').eq('category', 'bug');

  // Keyset seek: rows strictly after the cursor in (created_at, id) order.
  if (payload) {
    query = query.or(cursorSeekFilter(spec, payload));
  }

  const { data, error } = await query
    .order(spec.column, { ascending: !spec.descending, nullsFirst: false })
    // The unique id tie-breaker is what makes the keyset seek exact.
    .order('id', { ascending: !spec.descending })
    // +1 lookahead answers hasNextPage without a count; the exact-boundary
    // page (rows == pageSize) therefore reports hasNextPage: false.
    .limit(ADMIN_BUG_REPORTS_PAGE_SIZE + 1);

  if (error) {
    throw new Error(`Failed to fetch bug reports: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => publicSupportTicketsRowSchema.parse(row));
  const pageRows = rows.slice(0, ADMIN_BUG_REPORTS_PAGE_SIZE);
  const hasNextPage = rows.length > ADMIN_BUG_REPORTS_PAGE_SIZE;
  const lastRow = hasNextPage ? pageRows.at(-1) : undefined;

  return AdminBugReportPageSchema.parse({
    data: pageRows,
    hasNextPage,
    nextCursor: lastRow ? encodeRecipeCursor('recent', lastRow) : null,
  });
}

export async function resolveBugReport(reportId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('support_tickets')
    .update({ status: 'resolved' })
    .eq('id', reportId)
    .eq('category', 'bug')
    .select('id');

  if (error) {
    throw new Error(`Failed to resolve bug report: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Bug report not found — it may have been deleted, is not categorized as a bug, or you lack permission to resolve it.',
    );
  }
}
