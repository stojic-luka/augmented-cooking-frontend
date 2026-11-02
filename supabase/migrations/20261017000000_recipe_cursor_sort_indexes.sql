-- ============================================================================
-- Keyset (cursor) pagination indexes for public.recipes
--
-- The recipe list endpoint seeks with (sort_column, id) keyset predicates
-- (see SORT_SPECS in src/features/recipes/utils/pagination/index.ts); these
-- composite indexes turn each seek into an index dive instead of a scan.
-- Additive only — no existing objects are modified. Ascending column pairs
-- also serve descending seeks (Postgres scans a btree backwards).
-- ============================================================================

-- sort=recent → created_at desc, id desc
create index if not exists recipes_created_at_id_idx
  on public.recipes (created_at, id);

-- sort=rating → rating_avg desc, id desc
create index if not exists recipes_rating_avg_id_idx
  on public.recipes (rating_avg, id);

-- sort=time → prep_time_minutes asc, id asc; partial because the endpoint
-- filters out null prep times (keyset seeks never match SQL NULL).
create index if not exists recipes_prep_time_id_idx
  on public.recipes (prep_time_minutes, id) where prep_time_minutes is not null;
