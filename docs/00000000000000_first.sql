-- ============================================================================
-- 00000000000000_init.sql — FULL SCHEMA per DATABASE_REFERENCE.md
--
-- Run ONCE on a fresh Supabase project (SQL editor as one batch, or
-- supabase/migrations/ + `supabase db push`). Sections are ordered by
-- dependency — do not reorder.
--
-- Deviations from the doc (all intentional, see audit):
--  * FIX: invalidate_recipe_nutrition branches on TG_TABLE_NAME — the
--    appendix body reads new.recipe_id, which errors on the recipes trigger
--    (recipes has `id`, not `recipe_id`).
--  * FIX: profiles_handle_user_deletion anonymizes the ledger explicitly with
--    the immutability trigger disabled — FK ON DELETE SET NULL is an UPDATE,
--    which forbid_mutation would otherwise block (account deletion would fail).
--  * Hardening (marked inline): recipes can't be inserted self-approved,
--    reviews can't backdate created_at to dodge the rate limit, tickets
--    can't be created pre-assigned, quota RPC EXECUTE revoked from clients.
-- ============================================================================

-- ================= SECTION 1: ENUMS (controlled vocabulary) ================
-- Escape hatch if a vocabulary ever needs to grow unbounded: migrate that
-- column to a lookup table like `cuisines`.
create type public.app_role               as enum ('user','moderator','admin');
create type public.subscription_tier      as enum ('free','premium');
create type public.unit_preference        as enum ('metric','imperial');
create type public.meal_type              as enum ('breakfast','lunch','dinner','snack');  -- reserved: future meal_plan tables (not in v1)
create type public.moderation_status      as enum ('pending','approved','flagged','rejected');
create type public.support_status         as enum ('open','in_progress','resolved');
create type public.report_status          as enum ('open','reviewed','actioned','dismissed');
create type public.ticket_category        as enum ('bug','recipe','billing','feature');
create type public.severity               as enum ('low','medium','high');
create type public.ai_model_tier          as enum ('economy','advanced');
create type public.food_category          as enum ('produce','dairy','meat','seafood','grains','pantry','spices','frozen','bakery','beverages','other');
create type public.recipe_category        as enum ('appetizer','soup','salad','main_course','side_dish','dessert','breakfast','snack','beverage','sauce','other');
create type public.cooking_method         as enum ('baked','roasted','grilled','fried','deep_fried','steamed','boiled','braised','sauteed','stir_fried','pressure_cooked','slow_cooked','raw','other');
create type public.difficulty             as enum ('easy','medium','hard');
create type public.dietary_tag            as enum ('vegetarian','vegan','pescatarian','gluten_free','dairy_free','nut_free','egg_free','halal','kosher','low_carb','keto','paleo','sugar_free','other');
create type public.ai_action_type         as enum ('generate_recipe','edit_recipe','nutrition_analysis','substitute_ingredient','recommend','chat');
create type public.subscription_status    as enum ('active','canceled','past_due','expired');
create type public.token_transaction_type as enum ('monthly_grant','purchase','consumption','expiry');
create type public.order_status           as enum ('draft','placed','confirmed','delivered','canceled');
create type public.unit_dimension        as enum ('mass','volume','count');
create type public.spice_level            as enum ('mild','medium','hot','very_hot');
create type public.nutrition_source       as enum ('usda','ai_estimated','user_provided','imported');
create type public.recipe_origin          as enum ('manual','scraped','ai_generated');

-- ================= SECTION 2: TABLES (dependency order) ====================

-- Reference table: soft-delete via is_enabled; NEVER hard-delete.
-- min_tier is advisory at DB level; NestJS enforces when proxying AI calls.
create table public.ai_models (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  tier       public.ai_model_tier not null,
  is_enabled boolean not null default true,
  min_tier   public.subscription_tier not null default 'free',
  created_at timestamptz not null default now()
);

-- One row per auth user (id = auth.users.id). role / subscription_tier /
-- tokens_remaining are service-role-only writes; tokens_remaining is mutated
-- ONLY inside the quota RPCs (the ledger is the truth, this is the cache).
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text not null default '',
  avatar_url          text,                                     -- storage path in bucket 'avatars'
  role                public.app_role not null default 'user',
  subscription_tier   public.subscription_tier not null default 'free',
  unit_preference     public.unit_preference not null default 'metric',
  dietary_preferences public.dietary_tag[] not null default '{}',
  ai_model_id         uuid references public.ai_models(id) on delete set null,
  tokens_remaining    integer not null default 0 check (tokens_remaining >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.cuisines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  region     text,
  is_active  boolean not null default true,        -- soft delete
  created_at timestamptz not null default now()
);

create table public.subscription_plans (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  price_minor        integer not null check (price_minor >= 0),
  currency           char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  ai_actions_per_day integer,                      -- null = unlimited
  tokens_per_month   integer,                      -- null = unlimited
  description        text not null default '',
  is_active          boolean not null default true,-- soft delete; retire, never delete
  created_at         timestamptz not null default now()
);

create table public.ingredients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,                 -- normalized: lowercase, singular
  category   public.food_category not null default 'other',
  aliases    text[] not null default '{}',         -- scraper matching (aubergine ~ eggplant)
  is_active  boolean not null default true,        -- soft delete
  created_at timestamptz not null default now()
);

-- Per 100g; source of truth for computed values. Populated lazily by NestJS
-- on recipe save/import; cache hits are free. `source` is free text as a
-- conscious internal-only exception (service-role written).
create table public.ingredient_nutrition (
  ingredient_id     uuid primary key references public.ingredients(id) on delete restrict,
  fdc_id            integer,                       -- USDA FoodData Central id
  kcal_per_100g     numeric check (kcal_per_100g     >= 0),
  protein_per_100g  numeric check (protein_per_100g  >= 0),
  carbs_per_100g    numeric check (carbs_per_100g    >= 0),
  fat_per_100g      numeric check (fat_per_100g      >= 0),
  source            text not null default 'fdc',   -- fdc | openfoodfacts | ai | manual
  fetched_at        timestamptz not null default now()
);

create table public.units (
  code           text primary key,                 -- 'g','kg','oz','ml','cup','tbsp','piece'
  name           text not null,
  dimension      public.unit_dimension not null,   -- mass→g, volume→ml, count→piece
  factor_to_base numeric not null,                 -- cup=236.588, oz=28.3495, tbsp=14.7868
  is_metric      boolean,                          -- metric↔imperial display conversion; null for count
  is_active      boolean not null default true     -- soft delete
);

-- Recipe content writes (recipes + ingredients + steps + nutrition +
-- revisions) are routed through NestJS, which recomputes nutrition in the
-- same request. Edits of public approved recipes go through
-- recipe_revisions — never the live row. Total time is DERIVED (prep+cook).
create table public.recipes (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete set null,  -- public approved: anonymized, not deleted
  title              text not null,
  description        text not null default '',
  cuisine_id         uuid references public.cuisines(id) on delete restrict,
  category           public.recipe_category,
  cooking_method     public.cooking_method,
  difficulty         public.difficulty,
  spice_level        public.spice_level,
  prep_time_minutes  integer check (prep_time_minutes >= 0),   -- ACTIVE prep time
  cook_time_minutes  integer check (cook_time_minutes >= 0),   -- heat/appliance time
  servings           integer not null check (servings > 0),
  dietary_tags       public.dietary_tag[] not null default '{}',
  is_public          boolean not null default false,
  moderation_status  public.moderation_status not null default 'pending',
  origin             public.recipe_origin not null default 'manual',  -- mislabeling is harmless: all origins equally moderated
  source_url         text,                          -- original URL when origin = 'scraped'
  original_recipe_id uuid references public.recipes(id) on delete set null,  -- private copies
  rating_avg         numeric(2,1) not null default 0,   -- trigger-maintained cache; never hand-set
  review_count       integer not null default 0,        -- trigger-maintained cache
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  position      integer not null check (position >= 1),
  quantity      numeric check (quantity >= 0),      -- null = "to taste"
  unit          text references public.units(code) on delete restrict,
  note          text,                               -- "finely chopped", "optional"
  is_optional   boolean not null default false,
  raw_text      text,                               -- scraper fallback, rendered as-is
  constraint recipe_ingredients_position_unique
    unique (recipe_id, position) deferrable initially immediate  -- position swaps via SET CONSTRAINTS ... DEFERRED
);

create table public.recipe_steps (
  id                     uuid primary key default gen_random_uuid(),
  recipe_id              uuid not null references public.recipes(id) on delete cascade,
  position               integer not null check (position >= 1),
  instruction            text not null,
  estimated_time_minutes integer check (estimated_time_minutes >= 0),  -- ACTIVE work ("chop vegetables, ~13 min")
  timer_seconds          integer check (timer_seconds >= 0),           -- PASSIVE wait; null = "season to taste"
  constraint recipe_steps_position_unique
    unique (recipe_id, position) deferrable initially immediate
);

-- Staged edits for public approved recipes. Only one pending revision per
-- recipe is meaningful — NestJS overwrites the author's own pending revision
-- (no DB constraint; writes are service-role only). Approve = single
-- service-role transaction: apply payload → mark revision approved → set
-- recipes.moderation_status='approved' after the reset-on-edit trigger →
-- recompute nutrition in the same request. Reject = mark rejected.
create table public.recipe_revisions (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,   -- anonymized edits remain appliable
  payload    jsonb not null,                        -- full snapshot; NestJS-only, schema-validated in app
  status     public.moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-serving computed cache / user-supplied. Staleness is impossible by
-- construction: any ingredient/servings change deletes computed rows.
-- ORDERING REQUIREMENT (app): in a save/import/revision-apply, write
-- ingredients/steps/servings FIRST, then nutrition — the reverse order would
-- be deleted immediately by the trigger.
create table public.recipe_nutrition (
  recipe_id            uuid primary key references public.recipes(id) on delete cascade,
  calories_per_serving integer check (calories_per_serving >= 0),
  protein_grams        numeric check (protein_grams  >= 0),
  carbs_grams          numeric check (carbs_grams    >= 0),
  fat_grams            numeric check (fat_grams      >= 0),
  fiber_grams          numeric check (fiber_grams    >= 0),
  sugar_grams          numeric check (sugar_grams    >= 0),
  sodium_mg            numeric check (sodium_mg      >= 0),
  nutrition_source     public.nutrition_source not null,  -- trust label; not enforced
  computed_at          timestamptz
);

-- Threaded, Reddit-style. Thread fetch: where root_review_id = X order by
-- created_at (one indexed query, unlimited nesting). image_url is a storage
-- PATH — NEVER a signed URL (signed URLs are minted at render, 24h, cached).
create table public.reviews (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references public.recipes(id) on delete cascade,
  user_id           uuid references public.profiles(id) on delete set null,  -- survives deletion as "[deleted user]"
  rating            integer,                       -- 1–5, top-level only (CHECK below)
  comment           text not null default '',
  image_url         text,                          -- bucket 'review-images': {user_id}/{uuid}.webp
  parent_review_id  uuid references public.reviews(id) on delete cascade,
  root_review_id    uuid,                          -- trigger-maintained thread anchor
  depth             integer not null default 0,    -- trigger-maintained
  moderation_status public.moderation_status not null default 'approved',  -- flagged/pending hidden
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reviews_rating_shape check (
    (depth > 0 and rating is null) or
    (depth = 0 and rating between 1 and 5)
  )
);

create table public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- Sharing by URL (/collection/{id}); page renders only if is_public (RLS).
-- Flipping is_public false kills the link immediately — no lingering tokens.
create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text not null default '',
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.collection_recipes (
  collection_id uuid not null references public.collections(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  primary key (collection_id, recipe_id)
);

-- One queue for ALL user-to-staff communication, incl. product bug reports
-- (category='bug'; no separate bug_reports table). Assignee auto-picked by
-- NestJS (least-loaded open workload) on creation.
create table public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  subject     text not null,
  category    public.ticket_category not null,
  description text not null,
  severity    public.severity not null,
  status      public.support_status not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.support_ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  sender_id   uuid references public.profiles(id) on delete set null,
  sender_role public.app_role not null default 'user',  -- role at send time (bubble alignment)
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Content moderation of recipes/reviews — distinct domain from support
-- tickets. Exactly one target as a REAL FK (no polymorphic target_id): a
-- report on deleted content disappears with it via cascade.
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  recipe_id   uuid references public.recipes(id) on delete cascade,
  review_id   uuid references public.reviews(id) on delete cascade,
  reason      text not null,
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),
  constraint reports_one_target check (num_nonnulls(recipe_id, review_id) = 1)
);

-- Plan switches = canceled + new row (partial unique index enforces one
-- active). Written by payment webhooks via service-role;
-- profiles.subscription_tier is a cache of the active plan.
create table public.user_subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles(id) on delete set null,
  plan_id              uuid not null references public.subscription_plans(id) on delete restrict,
  status               public.subscription_status not null default 'active',
  current_period_start timestamptz not null default now(),  -- monthly quota resets derive from this
  current_period_end   timestamptz,
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Reservation rows (model_id null, total_tokens 0) count toward the daily
-- cap until completed or swept; a completed row always has model_id set —
-- that predicate is the idempotency guard in complete_ai_usage.
create table public.ai_usage_log (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete set null,
  action_type       public.ai_action_type not null,
  model_id          uuid references public.ai_models(id) on delete set null,  -- safety net; models soft-delete via is_enabled
  prompt_tokens     integer not null default 0 check (prompt_tokens     >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens      integer not null default 0 check (total_tokens      >= 0),
  created_at        timestamptz not null default now()
);

-- Append-only ledger, trigger-enforced (even service-role can't UPDATE/
-- DELETE/TRUNCATE; escape = superuser DISABLE TRIGGER, deliberate+auditable).
-- Corrections are new compensating rows (signed amount + balance_after).
-- THE TRUTH for tokens — can rebuild profiles.tokens_remaining.
create table public.token_transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete set null,  -- anonymized (see deletion function)
  type             public.token_transaction_type not null,
  amount           integer not null check (amount <> 0),  -- signed: + credit, − debit
  balance_after    integer not null check (balance_after >= 0),
  description      text,
  related_usage_id uuid references public.ai_usage_log(id),
  external_ref     text,                              -- payment provider tx id
  created_at       timestamptz not null default now()
);

-- Receipt METADATA only — privacy by data minimization. No item data ever;
-- the provider keeps the full order record (external_order_id points at it).
-- No FK to shopping lists (local-only). Currency = what the provider charged.
create table public.order_receipts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete set null,
  provider          text not null,                   -- e.g. 'partner-grocery-api'
  external_order_id text,
  status            public.order_status not null default 'placed',  -- synced by provider webhooks
  total_minor       integer check (total_minor >= 0),
  currency          char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Encrypted local-data sync. Client: key = Argon2id(PIN, kdf_salt) tuned
-- ~300–500ms; encrypt serialized Dexie export; PUT blob (debounced). The PIN
-- never leaves the browser and is never recoverable — lost PIN = lost backup
-- (UI must say so). The service-role never needs to read `data`.
create table public.user_backups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  data       bytea not null,                         -- nonce + AES-256-GCM ciphertext
  kdf_salt   bytea not null,                         -- random per user
  kdf_params jsonb not null,                         -- {"algo":"argon2id","mem":65536,"iters":3,"version":1}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ================= SECTION 3: INDEXES ======================================
-- The doc's full list:
create index recipes_user_idx          on public.recipes (user_id);
create index recipes_public_moderation on public.recipes (moderation_status) where is_public;
create index recipes_search_idx        on public.recipes
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
create index recipes_dietary_idx       on public.recipes using gin (dietary_tags);
create index recipes_cuisine_idx       on public.recipes (cuisine_id);
create index ri_recipe_idx             on public.recipe_ingredients (recipe_id);  -- redundant with UNIQUE(recipe_id,position) prefix; doc-listed
create index ri_ingredient_idx         on public.recipe_ingredients (ingredient_id);  -- search-by-ingredient
create index rs_recipe_idx             on public.recipe_steps (recipe_id);         -- same redundancy note
create index rev_recipe_idx            on public.recipe_revisions (recipe_id);
create index rev_pending_idx           on public.recipe_revisions (status) where status = 'pending';  -- moderation queue
create index reviews_recipe_idx        on public.reviews (recipe_id);
create index reviews_thread_idx        on public.reviews (root_review_id, created_at);  -- whole-thread fetch
create index reviews_user_created_idx  on public.reviews (user_id, created_at desc);    -- rate-limit counting
create unique index reviews_one_top_level_per_user
                                        on public.reviews (recipe_id, user_id) where depth = 0;
-- (NULLs distinct → anonymized rows never collide)
create index collections_user_idx      on public.collections (user_id);
create index st_user_idx               on public.support_tickets (user_id);
create index st_status_idx             on public.support_tickets (status);
create index st_open_assignee_idx      on public.support_tickets (assignee_id) where status <> 'resolved';
create index stm_ticket_idx            on public.support_ticket_messages (ticket_id, created_at);
create index reports_status_idx        on public.reports (status);
create index reports_reporter_idx      on public.reports (reporter_id);
create index reports_recipe_idx        on public.reports (recipe_id);
create index reports_review_idx        on public.reports (review_id);
create index ingredients_aliases_gin   on public.ingredients using gin (aliases);   -- scraper alias matching
create index aul_user_created_idx      on public.ai_usage_log (user_id, created_at desc);      -- daily-limit query
create index tt_user_created_idx       on public.token_transactions (user_id, created_at desc);
create unique index user_subscriptions_one_active
                                        on public.user_subscriptions (user_id) where status = 'active';
create index receipts_user_created_idx on public.order_receipts (user_id, created_at desc);

-- Beyond the doc's list: FK-cascade support (prevents seq scans on parent
-- deletes — account deletion touches all of these):
create index favorites_recipe_idx      on public.favorites (recipe_id);
create index cr_recipe_idx             on public.collection_recipes (recipe_id);
create index us_user_idx               on public.user_subscriptions (user_id);
create index rev_author_idx            on public.recipe_revisions (author_id);

-- ================= SECTION 4: RLS HELPER FUNCTIONS =========================
-- SECURITY DEFINER + pinned search_path + owned by postgres → no RLS
-- recursion when called from policies. (Optional doc optimization: an auth
-- hook injecting app_role as a JWT claim would let these read auth.jwt()
-- instead of a table lookup — dashboard config, not SQL.)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$   select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('moderator','admin'));
 $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$   select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
 $$;

create or replace function public.recipe_is_publicly_visible(p_recipe uuid)
returns boolean language sql stable security definer set search_path = public as $$   select exists (select 1 from public.recipes
                 where id = p_recipe and is_public and moderation_status = 'approved');
 $$;

-- owner OR admin; anonymized (user_id IS NULL) resolves to admin-only
create or replace function public.can_edit_recipe(p_recipe uuid)
returns boolean language sql stable security definer set search_path = public as $$   select exists (select 1 from public.recipes
                 where id = p_recipe
                   and (user_id = auth.uid() or public.is_admin()));
 $$;

create or replace function public.owns_collection(p_col uuid)
returns boolean language sql stable security definer set search_path = public as $$   select exists (select 1 from public.collections
                 where id = p_col and user_id = auth.uid());
 $$;

-- ≤ 5 reviews/replies per user per recipe per calendar day (UTC)
create or replace function public.can_post_review(p_recipe uuid)
returns boolean language sql stable security definer set search_path = public as $$   select (select count(*) from public.reviews
          where user_id = auth.uid()
            and recipe_id = p_recipe
            and created_at >= date_trunc('day', now())) < 5;
 $$;

-- extra helper (not in doc's list): keeps collection_recipes RLS subquery-free
create or replace function public.collection_is_readable(p_col uuid)
returns boolean language sql stable security definer set search_path = public as $$   select exists (select 1 from public.collections
                 where id = p_col and (user_id = auth.uid() or is_public));
 $$;

-- ================= SECTION 5: TRIGGER FUNCTIONS ============================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin
  new.updated_at := now();
  return new;
end $$;

-- parent must share recipe; maintain depth + root_review_id
create or replace function public.reviews_validate_thread()
returns trigger language plpgsql security definer set search_path = public as $$ declare
  v_parent public.reviews;
begin
  if new.parent_review_id is null then
    new.depth := 0;
    new.root_review_id := null;
  else
    select * into v_parent from public.reviews where id = new.parent_review_id;
    if v_parent.id is null then
      raise exception 'PARENT_REVIEW_NOT_FOUND';
    end if;
    if v_parent.recipe_id <> new.recipe_id then
      raise exception 'REVIEW_PARENT_RECIPE_MISMATCH';
    end if;
    new.depth := v_parent.depth + 1;
    new.root_review_id := coalesce(v_parent.root_review_id, v_parent.id);
  end if;
  return new;
end $$;

create or replace function public.reviews_reset_moderation_on_edit()
returns trigger language plpgsql as $$ begin
  if new.comment is distinct from old.comment
     or new.rating is distinct from old.rating then
    new.moderation_status := 'pending';
  end if;
  return new;
end $$;

-- content change → pending. The revision-apply transaction sets 'approved'
-- explicitly after this fires, in the same commit. rating_avg/review_count
-- updates (recalc trigger) are NOT content → never fire this (column OF list).
create or replace function public.recipes_reset_moderation_on_edit()
returns trigger language plpgsql as $$ begin
  if new.title                is distinct from old.title
     or new.description       is distinct from old.description
     or new.cuisine_id        is distinct from old.cuisine_id
     or new.category          is distinct from old.category
     or new.cooking_method    is distinct from old.cooking_method
     or new.difficulty        is distinct from old.difficulty
     or new.spice_level       is distinct from old.spice_level
     or new.prep_time_minutes  is distinct from old.prep_time_minutes
     or new.cook_time_minutes is distinct from old.cook_time_minutes
     or new.servings          is distinct from old.servings
     or new.dietary_tags      is distinct from old.dietary_tags
     or new.source_url        is distinct from old.source_url
     or new.original_recipe_id is distinct from old.original_recipe_id then
    new.moderation_status := 'pending';
  end if;
  return new;
end $$;

-- official appendix body (verbatim)
create or replace function public.recalc_recipe_rating()
returns trigger
language plpgsql
security definer set search_path = public as $$ declare
  v_recipe uuid := coalesce(new.recipe_id, old.recipe_id);
begin
  update recipes r
     set rating_avg   = coalesce((
           select round(avg(rating)::numeric, 1)
             from reviews
            where recipe_id = v_recipe
              and moderation_status = 'approved'
              and depth = 0), 0),
         review_count = (
           select count(*)
             from reviews
            where recipe_id = v_recipe
              and moderation_status = 'approved'
              and depth = 0)
   where r.id = v_recipe;
  return null;
end $$;

-- appendix body + FIX: branch on triggering table (recipes has `id`, not
-- `recipe_id`; the appendix body would error at runtime on the recipes trigger)
create or replace function public.invalidate_recipe_nutrition()
returns trigger language plpgsql set search_path = public as $$ declare
  v_recipe uuid;
begin
  if tg_table_name = 'recipes' then
    v_recipe := new.id;
  else
    v_recipe := coalesce(new.recipe_id, old.recipe_id);
  end if;
  -- Only computed rows are invalidatable. user_provided / imported rows are
  -- "as entered by author" and remain valid by definition.
  delete from public.recipe_nutrition
   where recipe_id = v_recipe
     and nutrition_source in ('usda', 'ai_estimated');
  return null;
end $$;

-- official GDPR body + FIXES: (1) SECURITY DEFINER so the cascade works
-- regardless of caller privileges; (2) the ledger's FK ON DELETE SET NULL is
-- an UPDATE, which forbid_mutation forbids — anonymize explicitly with the
-- guard disabled for this one statement (the doc's deliberate escape).
-- APP RULE: storage objects under avatars/{user_id}/* and
-- review-images/{user_id}/* MUST be deleted via the Storage API BEFORE the
-- auth.users row is deleted (plpgsql cannot delete storage objects).
create or replace function public.profiles_handle_user_deletion()
returns trigger language plpgsql security definer set search_path = public as $$ begin
  -- Private / never-published recipes are personal: delete (cascades to
  -- ingredients, steps, nutrition). Public + approved survive, anonymized.
  delete from public.recipes
   where user_id = old.id
     and not (is_public and moderation_status = 'approved');

  -- Abandoned reservations are same-day placeholders: delete rather than
  -- anonymize (completed rows anonymize via ON DELETE SET NULL).
  delete from public.ai_usage_log
   where user_id = old.id and model_id is null;

  -- Surviving (anonymized) reviews lose their images: no user-keyed path
  -- remains anywhere (Recital 26 anonymization stays airtight).
  update public.reviews set image_url = null where user_id = old.id;

  -- Ledger anonymization (see FIX note above).
  alter table public.token_transactions disable trigger token_transactions_immutable;
  update public.token_transactions set user_id = null where user_id = old.id;
  alter table public.token_transactions enable trigger token_transactions_immutable;

  return old;
end $$;

-- verbatim from the doc
create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$ begin
  raise exception 'token_transactions is append-only (attempted %)', TG_OP;
end $$;

-- ================= SECTION 6: TRIGGERS =====================================
-- set_updated_at on every table having updated_at (Postgres defaults do NOT
-- fire on UPDATE — the trigger is mandatory):
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recipe_revisions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_subscriptions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.order_receipts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_backups
  for each row execute function public.set_updated_at();

create trigger reviews_validate_thread before insert on public.reviews
  for each row execute function public.reviews_validate_thread();
create trigger reviews_reset_moderation_on_edit
  before update of comment, rating on public.reviews
  for each row execute function public.reviews_reset_moderation_on_edit();
create trigger recalc_recipe_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_recipe_rating();

create trigger recipes_reset_moderation_on_edit
  before update of title, description, cuisine_id, category, cooking_method,
    difficulty, spice_level, prep_time_minutes, cook_time_minutes, servings,
    dietary_tags, source_url, original_recipe_id
  on public.recipes
  for each row execute function public.recipes_reset_moderation_on_edit();

create trigger recipe_ingredients_invalidate_nutrition
  after insert or update or delete on public.recipe_ingredients
  for each row execute function public.invalidate_recipe_nutrition();
create trigger recipes_invalidate_nutrition_on_servings
  after update of servings on public.recipes
  for each row
  when (new.servings is distinct from old.servings)
  execute function public.invalidate_recipe_nutrition();

create trigger profiles_handle_user_deletion before delete on public.profiles
  for each row execute function public.profiles_handle_user_deletion();

create trigger token_transactions_immutable
  before update or delete on public.token_transactions
  for each row execute function public.forbid_mutation();
create trigger token_transactions_no_truncate
  before truncate on public.token_transactions
  for each statement execute function public.forbid_mutation();

-- ================= SECTION 7: QUOTA RPCs (verbatim from doc) ===============
-- Atomic, race-free: free daily caps, premium debits, grants/purchases/
-- expiry. NEVER count-then-act in app code. All share one advisory-lock
-- namespace per user so grants and consumptions serialize.
create or replace function reserve_ai_usage(
  p_user_id   uuid,
  p_action    ai_action_type,
  p_daily_cap integer            -- NULL = unlimited
) returns uuid
language plpgsql
security definer set search_path = public as $$ declare
  v_count integer;
  v_id    uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('ai_quota:' || p_user_id::text, 0));

  select count(*) into v_count
    from ai_usage_log
   where user_id = p_user_id
     and created_at >= date_trunc('day', now());   -- calendar day, UTC

  if p_daily_cap is not null and v_count >= p_daily_cap then
    raise exception 'DAILY_CAP_REACHED';
  end if;

  insert into ai_usage_log (user_id, action_type)
  values (p_user_id, p_action)
  returning id into v_id;

  return v_id;
end $$;

create or replace function complete_ai_usage(
  p_usage_id          uuid,
  p_model_id          uuid,
  p_prompt_tokens     integer,
  p_completion_tokens integer,
  p_token_cost        integer,          -- 0 for free-tier actions
  p_description       text default null
) returns integer                       -- current balance
language plpgsql
security definer set search_path = public as $$ declare
  v_user_id uuid;
  v_balance integer;
begin
  select user_id into v_user_id from ai_usage_log where id = p_usage_id;
  if v_user_id is null then
    raise exception 'USAGE_NOT_FOUND';
  end if;

  -- Idempotency guard: "model_id is null" means a retried call updates
  -- zero rows and takes the no-op path below.
  update ai_usage_log
     set model_id          = p_model_id,
         prompt_tokens     = p_prompt_tokens,
         completion_tokens = p_completion_tokens,
         total_tokens      = p_prompt_tokens + p_completion_tokens
   where id = p_usage_id
     and model_id is null;

  if not found then
    select tokens_remaining into v_balance from profiles where id = v_user_id;
    return v_balance;
  end if;

  if p_token_cost > 0 then
    update profiles
       set tokens_remaining = tokens_remaining - p_token_cost
     where id = v_user_id
       and tokens_remaining >= p_token_cost
    returning tokens_remaining into v_balance;

    if v_balance is null then
      raise exception 'INSUFFICIENT_TOKENS';
    end if;

    insert into token_transactions
      (user_id, type, amount, balance_after, description, related_usage_id)
    values
      (v_user_id, 'consumption', -p_token_cost, v_balance,
       p_description, p_usage_id);
  else
    select tokens_remaining into v_balance from profiles where id = v_user_id;
  end if;

  return v_balance;
end $$;

create or replace function apply_token_transaction(
  p_user_id      uuid,
  p_type         token_transaction_type,   -- monthly_grant | purchase | expiry
  p_amount       integer,                  -- signed: positive credit, negative expiry
  p_description  text default null,
  p_external_ref text default null         -- payment provider tx id (purchases)
) returns integer                          -- new balance
language plpgsql
security definer set search_path = public as $$ declare
  v_balance integer;
  v_amount  integer := p_amount;
begin
  if p_type = 'consumption' then
    raise exception 'CONSUMPTION_MUST_USE_complete_ai_usage';
  end if;
  if v_amount = 0 then
    raise exception 'ZERO_AMOUNT';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('ai_quota:' || p_user_id::text, 0));

  -- Expiry debits are clamped so the balance never goes negative.
  if v_amount < 0 then
    select tokens_remaining into v_balance from profiles where id = p_user_id;
    if v_balance is null then
      raise exception 'PROFILE_NOT_FOUND';
    end if;
    v_amount := -least(v_balance, -v_amount);   -- clamp; may become 0
    if v_amount = 0 then
      return v_balance;                         -- nothing to expire
    end if;
  end if;

  update profiles
     set tokens_remaining = tokens_remaining + v_amount
   where id = p_user_id
  returning tokens_remaining into v_balance;

  if v_balance is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  insert into token_transactions
    (user_id, type, amount, balance_after, description, external_ref)
  values
    (p_user_id, p_type, v_amount, v_balance, p_description, p_external_ref);

  return v_balance;
end $$;

-- Service-role only (Postgres grants function EXECUTE to PUBLIC by default —
-- revoke or any authenticated client could call them directly):
revoke execute on function public.reserve_ai_usage(uuid, public.ai_action_type, integer)
  from public, anon, authenticated;
revoke execute on function public.complete_ai_usage(uuid, uuid, integer, integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.apply_token_transaction(uuid, public.token_transaction_type, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, public.ai_action_type, integer) to service_role;
grant execute on function public.complete_ai_usage(uuid, uuid, integer, integer, integer, text) to service_role;
grant execute on function public.apply_token_transaction(uuid, public.token_transaction_type, integer, text, text) to service_role;

-- ================= SECTION 8: STAFF / ADMIN RPCs ===========================
-- The doc requires these gates but doesn't specify bodies — minimal versions,
-- extend as the app needs. Internally gated, so executable by authenticated.

-- moderators change moderation_status only (never direct table writes)
create or replace function public.set_recipe_moderation(p_recipe uuid, p_status public.moderation_status)
returns void language plpgsql security definer set search_path = public as $$ begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  update public.recipes set moderation_status = p_status where id = p_recipe;
end $$;

-- moderator rejects a revision from the browser; APPROVAL must go through
-- NestJS (it applies the payload + recomputes nutrition in one transaction)
create or replace function public.set_revision_status(p_revision uuid, p_status public.moderation_status)
returns void language plpgsql security definer set search_path = public as $$ begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  if p_status = 'approved' then raise exception 'APPROVAL_MUST_GO_THROUGH_NESTJS'; end if;
  update public.recipe_revisions set status = p_status where id = p_revision;
end $$;

create or replace function public.set_report_status(p_report uuid, p_status public.report_status)
returns void language plpgsql security definer set search_path = public as $$ begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  update public.reports set status = p_status where id = p_report;
end $$;

create or replace function public.update_support_ticket(
  p_ticket uuid,
  p_status public.support_status default null,
  p_assignee uuid default null
) returns void language plpgsql security definer set search_path = public as $$ begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  update public.support_tickets t set
    status      = coalesce(p_status, t.status),
    assignee_id = coalesce(p_assignee, t.assignee_id),
    updated_at  = now()
  where t.id = p_ticket;
end $$;

create or replace function public.delete_support_ticket(p_ticket uuid)
returns void language plpgsql security definer set search_path = public as $$ begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  delete from public.support_tickets where id = p_ticket;  -- cascades messages
end $$;

-- cuisines: admin-only write path is RPC-only (complete: upsert + soft-delete)
create or replace function public.admin_upsert_cuisine(
  p_name text, p_slug text, p_region text default null
) returns uuid language plpgsql security definer set search_path = public as $$ declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.cuisines (name, slug, region)
  values (p_name, p_slug, p_region)
  on conflict (name) do update set slug = excluded.slug, region = excluded.region
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_set_cuisine_active(p_cuisine uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$ begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.cuisines set is_active = p_active where id = p_cuisine;
end $$;

-- ================= SECTION 9: ROW LEVEL SECURITY ===========================
-- Reference/write-service-role-only tables get a SELECT policy only: with RLS
-- enabled and no write policies, only service_role (bypasses RLS) can write.
-- All policies target `authenticated` per the doc (add anon variants if
-- logged-out browsing is ever wanted).

alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- other users' basic info surfaces via public_profile_info view (Section 11)

alter table public.ai_models enable row level security;
create policy ai_models_select on public.ai_models for select to authenticated using (true);

alter table public.cuisines enable row level security;
create policy cuisines_select on public.cuisines for select to authenticated using (true);

alter table public.subscription_plans enable row level security;
create policy plans_select on public.subscription_plans for select to authenticated using (true);

alter table public.ingredients enable row level security;
create policy ingredients_select on public.ingredients for select to authenticated using (true);
create policy ingredients_insert on public.ingredients for insert to authenticated with check (true);
create policy ingredients_update_admin on public.ingredients for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.ingredient_nutrition enable row level security;
create policy ing_nutrition_select on public.ingredient_nutrition for select to authenticated using (true);

alter table public.units enable row level security;
create policy units_select on public.units for select to authenticated using (true);

alter table public.recipes enable row level security;
create policy recipes_select on public.recipes for select to authenticated
  using (public.recipe_is_publicly_visible(id) or user_id = auth.uid() or public.is_staff());
-- HARDENING: moderation_status forced 'pending' so clients can't self-approve
-- (service-role writes bypass RLS and are unaffected).
create policy recipes_insert_own on public.recipes for insert to authenticated
  with check (user_id = auth.uid() and moderation_status = 'pending');
create policy recipes_update on public.recipes for update to authenticated
  using (public.can_edit_recipe(id)) with check (public.can_edit_recipe(id));
create policy recipes_delete on public.recipes for delete to authenticated
  using (public.can_edit_recipe(id));

alter table public.recipe_ingredients enable row level security;
create policy ri_select on public.recipe_ingredients for select to authenticated
  using (public.recipe_is_publicly_visible(recipe_id) or public.can_edit_recipe(recipe_id));
create policy ri_insert on public.recipe_ingredients for insert to authenticated
  with check (public.can_edit_recipe(recipe_id));
create policy ri_update on public.recipe_ingredients for update to authenticated
  using (public.can_edit_recipe(recipe_id)) with check (public.can_edit_recipe(recipe_id));
create policy ri_delete on public.recipe_ingredients for delete to authenticated
  using (public.can_edit_recipe(recipe_id));

alter table public.recipe_steps enable row level security;
create policy rs_select on public.recipe_steps for select to authenticated
  using (public.recipe_is_publicly_visible(recipe_id) or public.can_edit_recipe(recipe_id));
create policy rs_insert on public.recipe_steps for insert to authenticated
  with check (public.can_edit_recipe(recipe_id));
create policy rs_update on public.recipe_steps for update to authenticated
  using (public.can_edit_recipe(recipe_id)) with check (public.can_edit_recipe(recipe_id));
create policy rs_delete on public.recipe_steps for delete to authenticated
  using (public.can_edit_recipe(recipe_id));

alter table public.recipe_revisions enable row level security;
create policy revisions_select on public.recipe_revisions for select to authenticated
  using (author_id = auth.uid() or public.is_staff());
-- all writes service-role only (NestJS creates revisions; moderation via RPC)

alter table public.recipe_nutrition enable row level security;
create policy nutrition_select on public.recipe_nutrition for select to authenticated
  using (public.recipe_is_publicly_visible(recipe_id)
         or public.can_edit_recipe(recipe_id) or public.is_staff());
-- user overwrite sets nutrition_source='user_provided' ("as entered by author")
create policy nutrition_insert on public.recipe_nutrition for insert to authenticated
  with check (public.can_edit_recipe(recipe_id));
create policy nutrition_update on public.recipe_nutrition for update to authenticated
  using (public.can_edit_recipe(recipe_id)) with check (public.can_edit_recipe(recipe_id));
create policy nutrition_delete on public.recipe_nutrition for delete to authenticated
  using (public.can_edit_recipe(recipe_id));

alter table public.reviews enable row level security;
create policy reviews_select on public.reviews for select to authenticated
  using ((moderation_status = 'approved' and public.recipe_is_publicly_visible(recipe_id))
         or user_id = auth.uid() or public.is_staff());
-- replies unlimited (rate-limited), never carry ratings; one top-level review
-- per user per recipe enforced by partial unique index.
-- HARDENING: created_at must be "today" — blocks backdating to dodge the cap.
create policy reviews_insert on public.reviews for insert to authenticated
  with check (user_id = auth.uid()
              and public.recipe_is_publicly_visible(recipe_id)
              and public.can_post_review(recipe_id)
              and created_at >= date_trunc('day', now()));
create policy reviews_update_own on public.reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete_own on public.reviews for delete to authenticated
  using (user_id = auth.uid());

alter table public.favorites enable row level security;
create policy favorites_select_own on public.favorites for select to authenticated
  using (user_id = auth.uid());
create policy favorites_insert_own on public.favorites for insert to authenticated
  with check (user_id = auth.uid());
create policy favorites_delete_own on public.favorites for delete to authenticated
  using (user_id = auth.uid());

alter table public.collections enable row level security;
create policy collections_select on public.collections for select to authenticated
  using (user_id = auth.uid() or is_public);
create policy collections_insert_own on public.collections for insert to authenticated
  with check (user_id = auth.uid());
create policy collections_update_own on public.collections for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collections_delete_own on public.collections for delete to authenticated
  using (user_id = auth.uid());

alter table public.collection_recipes enable row level security;
create policy cr_select on public.collection_recipes for select to authenticated
  using (public.collection_is_readable(collection_id));
-- recipe rows themselves stay governed by recipes RLS on join
create policy cr_insert on public.collection_recipes for insert to authenticated
  with check (public.owns_collection(collection_id)
              and (public.recipe_is_publicly_visible(recipe_id)
                   or exists (select 1 from public.recipes r
                              where r.id = recipe_id and r.user_id = auth.uid())));
create policy cr_delete on public.collection_recipes for delete to authenticated
  using (public.owns_collection(collection_id));

alter table public.support_tickets enable row level security;
create policy tickets_select on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
-- HARDENING: tickets can't be created pre-assigned or pre-resolved; staff
-- assignment happens via RPC / service-role on creation (NestJS picks assignee).
create policy tickets_insert_own on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and assignee_id is null and status = 'open');
-- UPDATE/DELETE staff-only via RPC (Section 8)

alter table public.support_ticket_messages enable row level security;
create policy stm_select on public.support_ticket_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t
                 where t.id = ticket_id
                   and (t.user_id = auth.uid() or public.is_staff())));
create policy stm_insert on public.support_ticket_messages for insert to authenticated
  with check (sender_id = auth.uid()
              and exists (select 1 from public.support_tickets t
                          where t.id = ticket_id
                            and (t.user_id = auth.uid() or public.is_staff())));

alter table public.reports enable row level security;
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());
create policy reports_update_staff on public.reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

alter table public.user_subscriptions enable row level security;
create policy subs_select_own on public.user_subscriptions for select to authenticated
  using (user_id = auth.uid());
-- INSERT/UPDATE service-role only (payment webhooks)

alter table public.token_transactions enable row level security;
create policy ledger_select_own on public.token_transactions for select to authenticated
  using (user_id = auth.uid());
-- INSERT exclusively via complete_ai_usage / apply_token_transaction (definer)

alter table public.ai_usage_log enable row level security;
create policy usage_select_own on public.ai_usage_log for select to authenticated
  using (user_id = auth.uid());
-- INSERT/UPDATE service-role only (quota RPCs / janitor sweep)

alter table public.order_receipts enable row level security;
create policy receipts_select on public.order_receipts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy receipts_insert_own on public.order_receipts for insert to authenticated
  with check (user_id = auth.uid());
-- UPDATE service-role only (provider webhooks sync status)

alter table public.user_backups enable row level security;
create policy backups_select_own on public.user_backups for select to authenticated
  using (user_id = auth.uid());
create policy backups_insert_own on public.user_backups for insert to authenticated
  with check (user_id = auth.uid());
create policy backups_update_own on public.user_backups for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy backups_delete_own on public.user_backups for delete to authenticated
  using (user_id = auth.uid());

-- ================= SECTION 10: COLUMN-LEVEL GRANTS (profiles) ==============
-- RLS cannot restrict columns; revoke table-level writes, then grant only the
-- user-editable columns. role / subscription_tier / tokens_remaining become
-- service-role-key-only (service_role keeps its own table-level grant).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, unit_preference,
              dietary_preferences, ai_model_id)
  on public.profiles to authenticated;

-- ================= SECTION 11: VIEWS =======================================
-- Plain view (owner-definer semantics = the doc's "SECURITY DEFINER view"):
-- the sanctioned exposure of other users' basic info — these 3 columns only.
create view public.public_profile_info as
  select id, display_name, avatar_url from public.profiles;
-- client renders "[deleted user]" whenever the author join misses.

-- Admin metrics: computed, never stored; single source of truth for the admin
-- panel AND NestJS. Gated via is_admin() (non-admins/anon get zero rows).
-- Column shapes weren't specified in the doc — adjust freely.
create view public.admin_metrics_daily_signups as
  select date_trunc('day', created_at) as day, count(*) as signups
  from public.profiles
  where public.is_admin()
  group by 1 order by 1;

create view public.admin_metrics_ai_actions_daily as
  select date_trunc('day', created_at) as day, count(*) as actions
  from public.ai_usage_log
  where public.is_admin() and model_id is not null   -- completed actions only
  group by 1 order by 1;

create view public.admin_metrics_token_consumption_daily as
  select date_trunc('day', created_at) as day,
         count(*) as transactions,
         -sum(amount) as tokens_consumed
  from public.token_transactions
  where public.is_admin() and type = 'consumption'
  group by 1 order by 1;

create view public.admin_metrics_moderation_queue as
  select (select count(*) from public.recipes where moderation_status = 'pending') as pending_recipes,
         (select count(*) from public.recipe_revisions where status = 'pending') as pending_revisions
  where public.is_admin();

create view public.admin_metrics_moderator_workload as
  select coalesce(assignee_id::text, '(unassigned)') as assignee,
         count(*) as open_tickets
  from public.support_tickets
  where public.is_admin() and status <> 'resolved'
  group by 1 order by open_tickets desc;

create view public.admin_metrics_recipe_origin_breakdown as
  select origin, count(*) as recipes
  from public.recipes
  where public.is_admin()
  group by origin;

-- ================= SECTION 12: REALTIME ====================================
-- Both tables in the publication; Supabase Realtime respects RLS for
-- postgres_changes (simultaneously the real-time mediator and the persistence
-- layer). Clients/moderators subscribe INSERT on support_ticket_messages
-- filter ticket_id=eq.X; use Broadcast channels for typing indicators.
-- (Per-subscriber RLS evaluation is a known scaling cliff — acceptable v1.)
alter table public.support_tickets replica identity full;
alter table public.support_ticket_messages replica identity full;
alter publication supabase_realtime
  add table public.support_tickets, public.support_ticket_messages;

-- ================= SECTION 13: AUTH HOOK (profile auto-create) =============
-- Remove this trigger if your NestJS backend creates profile rows instead.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$ begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ================= SECTION 14: SEED DATA (placeholders — adjust) ===========
insert into public.units (code, name, dimension, factor_to_base, is_metric) values
  ('g',     'gram',        'mass',   1,       true),
  ('kg',    'kilogram',    'mass',   1000,    true),
  ('oz',    'ounce',       'mass',   28.3495, false),
  ('lb',    'pound',       'mass',   453.592, false),
  ('ml',    'milliliter',  'volume', 1,       true),
  ('l',     'liter',       'volume', 1000,    true),
  ('tsp',   'teaspoon',    'volume', 4.92892, false),
  ('tbsp',  'tablespoon',  'volume', 14.7868, false),
  ('cup',   'cup',         'volume', 236.588, false),
  ('fl_oz', 'fluid ounce', 'volume', 29.5735, false),
  ('piece', 'piece',       'count',  1,       null)
on conflict (code) do nothing;

-- fixed UUIDs keep the seed idempotent; caps are placeholders
insert into public.subscription_plans
  (id, name, price_minor, currency, ai_actions_per_day, tokens_per_month, description) values
  ('00000000-0000-0000-0000-000000000001', 'Free',    0,    'EUR', 10,   0,   'Free tier (caps are placeholders)'),
  ('00000000-0000-0000-0000-000000000002', 'Premium', 2000, 'EUR', null, 500, 'Premium tier (placeholder)')
on conflict (id) do nothing;

insert into public.cuisines (name, slug, region) values
  ('Italian',        'italian',        'Southern Europe'),
  ('French',         'french',         'Western Europe'),
  ('Indian',         'indian',         'South Asia'),
  ('Chinese',        'chinese',        'East Asia'),
  ('Japanese',       'japanese',       'East Asia'),
  ('Mexican',        'mexican',        'North America'),
  ('Middle Eastern', 'middle-eastern', 'Western Asia'),
  ('American',       'american',       'North America')
on conflict (name) do nothing;

-- ================= SECTION 15: JANITOR SWEEP ===============================
-- Crashed-process gap: periodically delete abandoned reservations (~1h old)
-- so they stop counting toward the daily cap. Call via service_role or
-- pg_cron. APP RULE (NestJS lifecycle): on LLM failure, delete the
-- reservation row via service-role instead of leaving it for the sweep.
create or replace function public.sweep_abandoned_ai_usage(
  p_older_than interval default interval '1 hour'
) returns integer language plpgsql security definer set search_path = public as $$ declare n integer;
begin
  delete from public.ai_usage_log
   where model_id is null and total_tokens = 0
     and created_at < now() - p_older_than;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.sweep_abandoned_ai_usage(interval)
  from public, anon, authenticated;
grant execute on function public.sweep_abandoned_ai_usage(interval) to service_role;

-- ================= SECTION 16: STORAGE =====================================
-- avatars: PUBLIC bucket (public read via URL). review-images / recipe-images:
-- PRIVATE — no direct object reads; NestJS/edge function mints signed URLs
-- (24h suggested, cached client-side). image_url-style columns store OBJECT
-- PATHS ONLY — never signed URLs (they expire; signing at render time).
--
-- APP RULES (row-level cascades cannot delete storage objects):
--  * NestJS deletes a recipe/review → collect affected image paths BEFORE the
--    rows are deleted and remove the objects via the Storage API in the same
--    request (otherwise orphaned blobs accumulate).
--  * Account deletion → prefix sweep avatars/{user_id}/* and
--    review-images/{user_id}/* FIRST, before the auth.users delete (the
--    cascade nulls user_id away).
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values
  ('review-images', 'review-images', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values
  ('recipe-images', 'recipe-images', false)
on conflict (id) do nothing;

-- Owner-folder write rules for all three buckets ({user_id}/...).
-- avatars stricter option: name = auth.uid()::text || '/avatar'
create policy user_folders_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'review-images', 'recipe-images')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy user_folders_update on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'review-images', 'recipe-images')
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('avatars', 'review-images', 'recipe-images')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy user_folders_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'review-images', 'recipe-images')
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- OUT OF DATABASE SCOPE (per doc — intentionally NOT tables):
--  * Cooking-session state, meal plans, shopping lists: browser-only (Dexie);
--    cross-browser sync via user_backups; order payloads go browser→provider.
--  * Future opt-in sync schemas (not in v1): meal_plan_entries
--    (UNIQUE(user_id,date,meal_type,recipe_id)), shopping_lists,
--    shopping_list_items (source_recipe_id FK set null).
--  * Nutrition trust enforcement: labels, not verification.
--  * FX conversion: display-time, app-level; DB stores native minor units.
-- Trusted contexts: browser=user JWT (RLS-governed non-content CRUD);
-- NestJS-for-user=forwarded JWT (RLS applies); NestJS-privileged=service-role
-- key (content writes, quota/moderation RPCs, caches, webhooks, deletion).
-- ============================================================================