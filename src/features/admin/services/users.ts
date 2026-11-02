import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { SORT_SPECS, cursorSeekFilter, decodeCursorForSort, encodeRecipeCursor } from '@features/recipes';
import {
  publicProfilesRowSchema as profilesRowSchema,
  publicProfilesUpdateSchema as profilesUpdateSchema,
} from '@/types/schemas';

// Email lives in auth.users — not exposed to clients. Kept as a UI-level
// nullable extension until an admin view/RPC surfaces it.
export const adminUserSchema = profilesRowSchema
  .pick({
    id: true,
    display_name: true,
    role: true,
    subscription_tier: true,
    created_at: true,
  })
  .extend({ email: z.string().nullable() });
export type AdminUser = z.infer<typeof adminUserSchema>;

const adminUserUpdateSchema = profilesUpdateSchema.pick({ role: true, subscription_tier: true });
export type AdminUserUpdate = z.infer<typeof adminUserUpdateSchema>;
export { adminUserUpdateSchema };

/** Rows per admin registry page; the +1 lookahead row answers hasNextPage. */
export const ADMIN_USERS_PAGE_SIZE = 25;

/**
 * One keyset-paginated page of the admin user registry — the same
 * `{ data, nextCursor, hasNextPage }` envelope every paginated list uses.
 */
export const AdminUserPageSchema = z.object({
  data: z.array(adminUserSchema),
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});
export type AdminUserPage = z.infer<typeof AdminUserPageSchema>;

/**
 * One keyset-paginated page of the admin user registry, newest first.
 * Cursor in, page out, on the shared `recent` sort and cursor codec, so a
 * page never repeats or skips rows.
 */
export async function fetchAdminUsers(cursor: string | null): Promise<AdminUserPage> {
  const supabase = getSupabaseBrowserClient();
  const spec = SORT_SPECS.recent;
  const payload = cursor ? decodeCursorForSort(cursor, 'recent') : null;

  let query = supabase.from('profiles').select('id, display_name, role, subscription_tier, created_at');

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
    .limit(ADMIN_USERS_PAGE_SIZE + 1);

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => adminUserSchema.parse({ ...row, email: null }));
  const pageRows = rows.slice(0, ADMIN_USERS_PAGE_SIZE);
  const hasNextPage = rows.length > ADMIN_USERS_PAGE_SIZE;
  const lastRow = hasNextPage ? pageRows.at(-1) : undefined;

  return AdminUserPageSchema.parse({
    data: pageRows,
    hasNextPage,
    nextCursor: lastRow ? encodeRecipeCursor('recent', lastRow) : null,
  });
}

export async function updateUser(userId: string, patch: AdminUserUpdate): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  // role / subscription_tier are service-role-write-only (column-level grants
  // deny client UPDATEs), so this must go through a SECURITY DEFINER RPC
  // gated on is_admin(). Do NOT revert to a direct .from('profiles').update()
  // — Postgres will reject it. updated_at is handled by trigger inside the RPC.
  //
  // BLOCKED ON BACKEND: the schema defines no staff-write RPC for profiles,
  // so the generated types cannot name it. The call below types the builder
  // narrowly against the agreed signature until the function ships.
  const staffRpc = supabase.rpc.bind(supabase) as unknown as (
    fn: 'admin_update_profile',
    args: { target_user_id: string; new_role: string | null; new_subscription_tier: string | null },
  ) => PromiseLike<{ error: { message: string } | null }>;
  const { error } = await staffRpc('admin_update_profile', {
    target_user_id: userId,
    new_role: patch.role ?? null,
    new_subscription_tier: patch.subscription_tier ?? null,
  });

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }
}
