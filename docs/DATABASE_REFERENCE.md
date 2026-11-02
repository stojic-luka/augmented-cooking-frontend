# DATABASE_REFERENCE.md

Supabase is the system of record: auth, storage, and all CRUD with RLS as the real enforcement layer. The NestJS backend is a trusted helper — AI services, external integrations, and privileged writes via the service-role key. See "Trusted contexts".

**Write routing:** the browser talks to Supabase directly for non-content CRUD (favorites, collections, reviews, support tickets, profile settings). **All recipe-content writes** (`recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_nutrition`, `recipe_revisions`) go **through NestJS**, which recomputes nutrition in the same request. The `invalidate_recipe_nutrition` trigger is the DB-side safety net.

All PKs `uuid` unless noted. `created_at`/`updated_at` are `timestamptz`, maintained by the `set_updated_at` trigger (Postgres defaults do NOT fire on UPDATE — the trigger is mandatory).

**Reference-table rule (soft delete):** lookup tables (`ai_models`, `ingredients`, `units`, `cuisines`, `subscription_plans`) are never hard-deleted; they are disabled via their flag column, and their FKs use `ON DELETE RESTRICT` or `ON DELETE SET NULL` as noted. History is never destroyed.

**Controlled-vocabulary rule:** any column driving filtering, matching, or pipeline logic is an enum, NOT free text; unknown values fall to `other`/`medium` etc. Escape hatch if ever needed: migrate to a lookup table like `cuisines`.

RLS policies use helper functions (SECURITY DEFINER, `set search_path = public`, owned by postgres) to avoid RLS recursion.

## Enums

- `app_role`: `user` | `moderator` | `admin`
- `subscription_tier`: `free` | `premium`
- `unit_preference`: `metric` | `imperial`
- `meal_type`: `breakfast` | `lunch` | `dinner` | `snack`
- `moderation_status`: `pending` | `approved` | `flagged` | `rejected`
- `support_status`: `open` | `in_progress` | `resolved`
- `report_status`: `open` | `reviewed` | `actioned` | `dismissed`
- `ticket_category`: `bug` | `recipe` | `billing` | `feature`
- `severity`: `low` | `medium` | `high`
- `ai_model_tier`: `economy` | `advanced`
- `food_category`: `produce` | `dairy` | `meat` | `seafood` | `grains` | `pantry` | `spices` | `frozen` | `bakery` | `beverages` | `other` (drives scraper mapping, shopping-list grouping, and filtering; unknown items fall to `other`)
- `recipe_category`: `appetizer` | `soup` | `salad` | `main_course` | `side_dish` | `dessert` | `breakfast` | `snack` | `beverage` | `sauce` | `other`
- `cooking_method`: `baked` | `roasted` | `grilled` | `fried` | `deep_fried` | `steamed` | `boiled` | `braised` | `sauteed` | `stir_fried` | `pressure_cooked` | `slow_cooked` | `raw` | `other`
- `difficulty`: `easy` | `medium` | `hard`
- `dietary_tag`: `vegetarian` | `vegan` | `pescatarian` | `gluten_free` | `dairy_free` | `nut_free` | `egg_free` | `halal` | `kosher` | `low_carb` | `keto` | `paleo` | `sugar_free` | `other`
- `ai_action_type`: `generate_recipe` | `edit_recipe` | `nutrition_analysis` | `substitute_ingredient` | `recommend` | `chat`
- `subscription_status`: `active` | `canceled` | `past_due` | `expired`
- `token_transaction_type`: `monthly_grant` | `purchase` | `consumption` | `expiry`
- `order_status`: `draft` | `placed` | `confirmed` | `delivered` | `canceled`
- `unit_dimension`: `mass` | `volume` | `count`
- `spice_level`: `mild` | `medium` | `hot` | `very_hot`
- `nutrition_source`: `usda` | `ai_estimated` | `user_provided` | `imported`
- `recipe_origin`: `manual` | `scraped` | `ai_generated`

## Helper functions

```sql
is_staff()                      -> bool
is_admin()                      -> bool
recipe_is_publicly_visible(p_recipe uuid) -> bool
can_edit_recipe(p_recipe uuid)  -> bool   -- owner OR admin;
                                          -- user_id IS NULL (anonymized) → admin only
owns_collection(p_col uuid)     -> bool
can_post_review(p_recipe uuid)  -> bool   -- ≤ 5 reviews/replies by auth.uid() on p_recipe
                                          -- per calendar day (UTC):
                                          -- created_at >= date_trunc('day', now())
```

Optional optimization: an Auth hook injecting `app_role` as a custom JWT claim so role checks read `auth.jwt()` without a table lookup.

## Quota RPCs (service-role only — atomic, race-free)

Free daily caps, premium token debits, grants/purchases/expiry, and the ledger are enforced by these SECURITY DEFINER functions, **never by count-then-act application logic**. All share one advisory-lock namespace per user so grants and consumptions serialize against each other.

```sql
-- PHASE 1: reserve a usage slot. The placeholder row counts toward the
-- daily cap immediately, so concurrent reserves see each other.
create or replace function reserve_ai_usage(
  p_user_id   uuid,
  p_action    ai_action_type,
  p_daily_cap integer            -- NULL = unlimited
) returns uuid
language plpgsql
security definer set search_path = public as $$
declare
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

-- PHASE 2: complete the usage record AND debit tokens atomically.
-- IDEMPOTENT: only the first call for a given usage_id performs the debit;
-- a retried call finds the reservation completed and returns the current
-- balance without a second ledger row.
create or replace function complete_ai_usage(
  p_usage_id          uuid,
  p_model_id          uuid,
  p_prompt_tokens     integer,
  p_completion_tokens integer,
  p_token_cost        integer,          -- 0 for free-tier actions
  p_description       text default null
) returns integer                       -- current balance
language plpgsql
security definer set search_path = public as $$
declare
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
    -- Already completed (retry): no debit, no duplicate ledger row.
    select tokens_remaining into v_balance from profiles where id = v_user_id;
    return v_balance;
  end if;

  if p_token_cost > 0 then
    -- Conditional UPDATE is the serialization point for the balance:
    -- two concurrent completes cannot both pass "tokens_remaining >= cost".
    -- Log update happens BEFORE the debit on purpose: if this raises, the
    -- whole transaction rolls back (incl. the log update), so the
    -- reservation stays open for retry or the janitor sweep.
    update profiles
       set tokens_remaining = tokens_remaining - p_token_cost
     where id = v_user_id
       and tokens_remaining >= p_token_cost
    returning tokens_remaining into v_balance;

    if v_balance is null then
      raise exception 'INSUFFICIENT_TOKENS';
    end if;

    -- Guarded by p_token_cost > 0 so the ledger's `amount <> 0` CHECK can
    -- never fire (free-tier actions write no ledger row).
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

-- Credit/debit flows other than AI consumption: monthly grants, token
-- purchases, and token expiry. `consumption` is rejected here — it must go
-- through complete_ai_usage so it is always tied to an ai_usage_log row.
create or replace function apply_token_transaction(
  p_user_id      uuid,
  p_type         token_transaction_type,   -- monthly_grant | purchase | expiry
  p_amount       integer,                  -- signed: positive credit, negative expiry
  p_description  text default null,
  p_external_ref text default null         -- payment provider tx id (purchases)
) returns integer                          -- new balance
language plpgsql
security definer set search_path = public as $$
declare
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

  -- Expiry debits are clamped so the balance never goes negative: you
  -- cannot expire more tokens than the user holds.
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
```

**NestJS AI request lifecycle:** 1) `reserve_ai_usage(user, action, daily_cap)` → `usage_id`; 2) call the LLM — on failure, delete the reservation row (service-role); 3) `complete_ai_usage(usage_id, model, tokens, cost)` — atomic usage update + conditional debit + ledger append in ONE transaction.

**Janitor sweep** (crashed-process gap): periodically delete `ai_usage_log` rows older than ~1h where `model_id is null and total_tokens = 0` (abandoned reservations no longer count against the daily cap).

## Triggers

- `set_updated_at` — BEFORE UPDATE on every table having `updated_at`.
- `reviews_validate_thread` — BEFORE INSERT on reviews: parent must share the recipe; `depth := parent.depth + 1`; `root_review_id := coalesce(parent.root_review_id, parent.id)`.
- `reviews_reset_moderation_on_edit` — comment/rating change → `pending`.
- `recipes_reset_moderation_on_edit` — BEFORE UPDATE on recipes: content columns change → `pending`. Applies to direct writes (private/pending recipes; revision applies — the apply transaction sets `approved` afterward in the same commit). Edits to public approved recipes never touch the live row; they go through `recipe_revisions`.
- `recalc_recipe_rating` — AFTER INSERT/UPDATE/DELETE on reviews → refresh `recipes.rating_avg` / `review_count` from **approved top-level reviews only** (replies and non-approved never count; cache, never hand-set or trusted from imports).
- `invalidate_recipe_nutrition` — AFTER INSERT/UPDATE/DELETE on `recipe_ingredients`, AFTER UPDATE of `servings` on `recipes` → deletes computed nutrition cache (`usda` / `ai_estimated` only).
- `profiles_handle_user_deletion` — BEFORE DELETE on profiles: deletes private/unapproved recipes and abandoned `ai_usage_log` reservations, nulls `image_url` on surviving reviews; the rest is anonymized via FKs. See "Account deletion & GDPR".
- `token_transactions_immutable` / `token_transactions_no_truncate` — refuse UPDATE/DELETE/TRUNCATE on the ledger.

Function bodies for fix-critical triggers: see the Appendix.

## Tables

### profiles

One row per auth user. `id` equals `auth.users.id` (Supabase's `auth.users` cannot be extended — this table IS the extension).

| column                  | type              | notes                                                                                                |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| id                      | uuid, PK          | = auth.users.id, on delete cascade                                                                   |
| display_name            | text              |                                                                                                      |
| avatar_url              | text, nullable    | bucket `avatars`                                                                                     |
| role                    | app_role          | default `user` — service-role write only                                                             |
| subscription_tier       | subscription_tier | default `free` — service-role write only                                                             |
| unit_preference         | unit_preference   | default `metric`                                                                                     |
| dietary_preferences     | dietary_tag[]     | same vocabulary as `recipes.dietary_tags` (exact filter matching)                                    |
| ai_model_id             | uuid, nullable    | FK → ai_models.id, on delete set null                                                                |
| tokens_remaining        | integer           | default 0, check `>= 0` — mutated ONLY inside the quota RPCs; column-level grants deny client writes |
| created_at / updated_at | timestamptz       |                                                                                                      |

Column-level grants (RLS cannot restrict columns):

```sql
GRANT UPDATE (display_name, avatar_url, unit_preference,
              dietary_preferences, ai_model_id)
  ON profiles TO authenticated;
-- role, subscription_tier, tokens_remaining: service-role key only.
```

SELECT: own row. Other users surface via the `public_profile_info` view (id, display_name, avatar_url) for review author rendering.

### cuisines (reference table)

| column    | type           | notes                      |
| --------- | -------------- | -------------------------- |
| id        | uuid, PK       |                            |
| name      | text           | UNIQUE                     |
| slug      | text           | UNIQUE, URL-friendly       |
| region    | text, nullable | e.g. `South Asia`          |
| is_active | boolean        | default true — soft delete |

RLS: SELECT all authenticated; writes admin only (SECURITY DEFINER RPC gated on `is_admin()`).

### recipes

| column                  | type                      | notes                                                                                                                                                                         |
| ----------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | uuid, PK                  |                                                                                                                                                                               |
| user_id                 | uuid, nullable            | FK → profiles.id, ON DELETE SET NULL — public approved recipes anonymized, not deleted (see GDPR section)                                                                     |
| title / description     | text                      |                                                                                                                                                                               |
| cuisine_id              | uuid, nullable            | FK → cuisines.id, on delete restrict                                                                                                                                          |
| category                | recipe_category, nullable | enum                                                                                                                                                                          |
| cooking_method          | cooking_method, nullable  | enum — also feeds the nutrition pipeline                                                                                                                                      |
| difficulty              | difficulty, nullable      | enum                                                                                                                                                                          |
| spice_level             | spice_level, nullable     |                                                                                                                                                                               |
| prep_time_minutes       | integer, nullable         | check `>= 0`; active prep time — total time is DERIVED (prep + cook, never stored)                                                                                            |
| cook_time_minutes       | integer, nullable         | check `>= 0`; heat/appliance time                                                                                                                                             |
| servings                | integer                   | check `> 0`                                                                                                                                                                   |
| dietary_tags            | dietary_tag[]             | default `'{}'`                                                                                                                                                                |
| is_public               | boolean                   | default false                                                                                                                                                                 |
| moderation_status       | moderation_status         | default `pending`; moderator approves/rejects; owner edits of non-public-approved recipes reset to `pending` — edits of public approved recipes go through `recipe_revisions` |
| origin                  | recipe_origin             | default `manual`; `scraped` set by scraper, `ai_generated` by the AI pipeline (both equally moderated, so users mislabeling `origin` is harmless)                             |
| source_url              | text, nullable            | original URL when `origin = 'scraped'`                                                                                                                                        |
| original_recipe_id      | uuid, nullable            | FK → recipes.id, on delete set null (private copies)                                                                                                                          |
| rating_avg              | numeric(2,1)              | default 0 — trigger-maintained cache                                                                                                                                          |
| review_count            | integer                   | default 0 — trigger-maintained cache                                                                                                                                          |
| created_at / updated_at | timestamptz               |                                                                                                                                                                               |

RLS: SELECT where `recipe_is_publicly_visible(id)` OR own OR `is_staff()`; write via `can_edit_recipe(id)`; moderators change `moderation_status` only, via SECURITY DEFINER RPC gated on `is_staff()`.

### ingredients (master list)

| column     | type          | notes                                                   |
| ---------- | ------------- | ------------------------------------------------------- |
| id         | uuid, PK      |                                                         |
| name       | text          | UNIQUE, normalized (lowercase, singular)                |
| category   | food_category | default `other`                                         |
| aliases    | text[]        | scraper matching (`aubergine` ~ eggplant) — GIN indexed |
| is_active  | boolean       | default true — soft delete                              |
| created_at | timestamptz   |                                                         |

RLS: SELECT all authenticated; INSERT authenticated (unique name dedupes; scraper normalizes); UPDATE admin only.

### ingredient_nutrition (per 100g — source of truth for computed values)

| column                                         | type              | notes                                   |
| ---------------------------------------------- | ----------------- | --------------------------------------- |
| ingredient_id                                  | uuid, PK          | FK → ingredients.id, on delete restrict |
| fdc_id                                         | integer, nullable | USDA FoodData Central food id           |
| kcal_per_100g / protein / carbs / fat_per_100g | numeric, nullable | check `>= 0`                            |
| source                                         | text              | `fdc`                                   | `openfoodfacts` | `ai` | `manual` — free text accepted as a conscious internal-only exception (service-role-written) |
| fetched_at                                     | timestamptz       |                                         |

RLS: SELECT all authenticated; INSERT/UPDATE service-role only (NestJS cache writer). Populated lazily on recipe save/import; hits are free. Nutrition is an estimate for computed recipes — the `nutrition_source` label communicates trust, it is not enforced.

### units

| column         | type           | notes                                         |
| -------------- | -------------- | --------------------------------------------- |
| code           | text, PK       | `g`, `kg`, `oz`, `ml`, `cup`, `tbsp`, `piece` |
| name           | text           |                                               |
| dimension      | unit_dimension | mass→g, volume→ml, count→piece                |
| factor_to_base | numeric        | cup = 236.588, oz = 28.3495, tbsp = 14.7868   |
| is_metric      | boolean        | metric↔imperial display conversion            |
| is_active      | boolean        | default true — soft delete                    |

RLS: SELECT all authenticated; writes service-role/admin only. Cross-dimension conversion (cups→grams) is resolved per-ingredient by the AI/backend, not by this table.

### recipe_ingredients

| column        | type              | notes                                                                                                                          |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| id            | uuid, PK          |                                                                                                                                |
| recipe_id     | uuid              | FK → recipes.id, on delete cascade                                                                                             |
| ingredient_id | uuid              | FK → ingredients.id, on delete restrict                                                                                        |
| position      | integer           | check `>= 1`; UNIQUE (recipe_id, position) — deferrable (position swaps in one transaction via `SET CONSTRAINTS ... DEFERRED`) |
| quantity      | numeric, nullable | check `>= 0`; null = "to taste"                                                                                                |
| unit          | text, nullable    | FK → units.code, on delete restrict                                                                                            |
| note          | text, nullable    | "finely chopped", "optional"                                                                                                   |
| is_optional   | boolean           | default false                                                                                                                  |
| raw_text      | text, nullable    | scraper fallback, rendered as-is                                                                                               |

RLS: all ops require `can_edit_recipe(recipe_id)`; SELECT additionally when the recipe is publicly visible. Ingredient search joins on `ingredient_id` (exact match — no fuzzy text matching).

### recipe_steps

| column                 | type              | notes                                                                                                       |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| id                     | uuid, PK          |                                                                                                             |
| recipe_id              | uuid              | FK → recipes.id, on delete cascade                                                                          |
| position               | integer           | check `>= 1`; 1-based; UNIQUE (recipe_id, position) — deferrable                                            |
| instruction            | text              |                                                                                                             |
| estimated_time_minutes | integer, nullable | check `>= 0`; ACTIVE work ("chop vegetables, ~13 min")                                                      |
| timer_seconds          | integer, nullable | check `>= 0`; PASSIVE wait — frontend cooking-mode timer ("soak 20 min" → 1200); null for "season to taste" |

RLS: same shape as `recipe_ingredients`.

### recipe_revisions (staged edits for public approved recipes)

A previously approved recipe stays publicly visible in its **approved form** while an edit awaits moderation — edits are staged as revisions instead of mutating live tables.

| column                  | type              | notes                                                                                                                                                                                   |
| ----------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | uuid, PK          |                                                                                                                                                                                         |
| recipe_id               | uuid              | FK → recipes.id, on delete cascade                                                                                                                                                      |
| author_id               | uuid, nullable    | FK → profiles.id, ON DELETE SET NULL — anonymized edits remain appliable                                                                                                                |
| payload                 | jsonb             | full edited snapshot: recipe fields + `ingredients[]` + `steps[]`; written and consumed only by NestJS (schema-validated in app; never used for filtering, so JSONB is acceptable here) |
| status                  | moderation_status | default `pending`; moderator approves/rejects                                                                                                                                           |
| created_at / updated_at | timestamptz       |                                                                                                                                                                                         |

**Edit flow:**

- Owner edits a **public + approved** recipe → NestJS writes a pending `recipe_revisions` row with the full snapshot; live tables (and `recipe_nutrition`) stay untouched.
- Owner edits a **non-public-approved** recipe (private, pending, rejected) → direct write; moderation resets to `pending` (existing trigger).
- Moderator **approves** → single service-role transaction: apply `payload` to `recipes` / `recipe_ingredients` / `recipe_steps` (old ingredients/steps replaced), mark the revision `approved`, set `moderation_status = 'approved'` explicitly after the reset-on-edit trigger fires, recompute nutrition in the same request.
- Moderator **rejects** → mark `rejected`; live data untouched.
- Only one pending revision per recipe is meaningful — NestJS overwrites the author's own pending revision on re-edit. (No DB constraint needed; writes are service-role only.)

RLS: SELECT own (author) or staff; all writes service-role only (NestJS creates revisions; moderators act via SECURITY DEFINER RPC gated on `is_staff()`).

### recipe_nutrition (per serving — computed cache / user-supplied)

| column                                                 | type                  | notes                                 |
| ------------------------------------------------------ | --------------------- | ------------------------------------- |
| recipe_id                                              | uuid, PK              | FK → recipes.id, on delete cascade    |
| calories_per_serving                                   | integer, nullable     | check `>= 0`                          |
| protein / carbs / fat / fiber / sugar_grams, sodium_mg | numeric, nullable     | check `>= 0`; per serving             |
| nutrition_source                                       | nutrition_source      | which pipeline produced these numbers |
| computed_at                                            | timestamptz, nullable | when the cache was last computed      |

One row per recipe (PK = recipe_id) for cheap list-page joins. NestJS flow (on save/import): sum `ingredient_nutrition.per_100g × grams` ÷ servings → write here with `usda` (or `ai_estimated` when the LLM filled gaps; cooking-method aware for free). `user_provided`/`imported` numbers are stored as entered and shown "as entered by author" — unverifiable by design, trust communicated via the label. Per-ingredient data is the truth for computed recipes; this table is the cache.

**Staleness is impossible by construction:** any change to `recipe_ingredients` or `recipes.servings` fires `invalidate_recipe_nutrition`, which deletes the computed row (`usda` / `ai_estimated`); `user_provided` / `imported` rows remain valid by definition. A missing row means "not yet computed" — the frontend treats absence as a prompt to recompute (NestJS recomputes on next touch regardless).

**Ordering requirement:** in a save/import/revision-apply request, NestJS writes `recipe_ingredients` / `recipe_steps` / `servings` **first**, then computes and writes `recipe_nutrition` — writing nutrition first would have it deleted immediately after by the trigger.

Future enhancement (no schema change): USDA nutrient retention factors per cooking method × nutrient, applied inside the NestJS computation.

RLS: SELECT whenever the recipe is SELECTable; writes via `can_edit_recipe` (user overwrite sets `user_provided`) or service-role.

### reviews (threaded, Reddit-style)

| column                  | type              | notes                                                                                                                                                         |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | uuid, PK          |                                                                                                                                                               |
| recipe_id               | uuid              | FK → recipes.id, on delete cascade                                                                                                                            |
| user_id                 | uuid, nullable    | FK → profiles.id, ON DELETE SET NULL — survives account deletion as "[deleted user]", with `image_url` nulled by `handle_user_deletion`                       |
| rating                  | integer, nullable | 1–5; top-level only (CHECK)                                                                                                                                   |
| comment                 | text              |                                                                                                                                                               |
| image_url               | text, nullable    | storage PATH in bucket `review-images` (`{user_id}/{uuid}.webp`). NEVER a signed URL — signed URLs are minted at render time (24h expiry, cached client-side) |
| parent_review_id        | uuid, nullable    | FK → reviews.id, on delete cascade                                                                                                                            |
| root_review_id          | uuid, nullable    | thread anchor — trigger-maintained                                                                                                                            |
| depth                   | integer           | default 0 — trigger-maintained                                                                                                                                |
| moderation_status       | moderation_status | default `approved`; flagged/pending hidden                                                                                                                    |
| created_at / updated_at | timestamptz       |                                                                                                                                                               |

Thread fetch: `where root_review_id = X order by created_at` — one indexed query, unlimited nesting. CHECK: `(depth > 0 AND rating IS NULL) OR (depth = 0 AND rating BETWEEN 1 AND 5)` — every top-level review carries a rating, replies never do.

**One top-level review per user per recipe** — DB-enforced:

```sql
create unique index reviews_one_top_level_per_user
  on reviews (recipe_id, user_id)
  where depth = 0;
```

(NULLs are distinct in unique indexes, so anonymized rows never collide.) Editing resets moderation to pending; replies are unlimited (rate-limited) and never carry ratings.

RLS: SELECT `moderation_status = 'approved' AND recipe_is_publicly_visible(recipe_id)` OR own OR staff; INSERT own + visible recipe + `can_post_review(recipe_id)`; UPDATE/DELETE own.

### favorites

| column     | type        | notes                                                            |
| ---------- | ----------- | ---------------------------------------------------------------- |
| user_id    | uuid, PK    | composite PK with recipe_id; FK → profiles.id, on delete cascade |
| recipe_id  | uuid, PK    | composite PK with user_id; FK → recipes.id, on delete cascade    |
| created_at | timestamptz |                                                                  |

RLS: own rows only.

### collections

| column             | type        | notes                                      |
| ------------------ | ----------- | ------------------------------------------ |
| id                 | uuid, PK    |                                            |
| user_id            | uuid        | FK → profiles.id, on delete cascade. Owner |
| name / description | text        |                                            |
| is_public          | boolean     | default false                              |
| created_at         | timestamptz |                                            |

Sharing is by URL (`https://{hostname}/collection/{id}`), same model as recipes: the page renders only if `is_public = true` (RLS-enforced). Flipping `is_public` to false makes the URL die immediately — no lingering share token.

RLS: owner full; SELECT where `is_public`.

### collection_recipes

| column        | type     | notes                                                               |
| ------------- | -------- | ------------------------------------------------------------------- |
| collection_id | uuid, PK | composite PK with recipe_id; FK → collections.id, on delete cascade |
| recipe_id     | uuid, PK | composite PK with collection_id; FK → recipes.id, on delete cascade |

RLS: SELECT when collection readable (recipe rows stay governed by recipes RLS); INSERT `owns_collection AND (own recipe OR publicly visible recipe)`; DELETE `owns_collection`.

### support_tickets

One queue for ALL user-to-staff communication, including product bug reports (`category = 'bug'`; no separate bug_reports table — one queue, one workflow, one set of metrics).

| column                  | type            | notes                                                                                                                |
| ----------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| id                      | uuid, PK        |                                                                                                                      |
| user_id                 | uuid            | FK → profiles.id, on delete cascade. Owner                                                                           |
| assignee_id             | uuid, nullable  | FK → profiles.id, on delete set null — auto-assigned moderator (NestJS picks least-loaded open workload on creation) |
| subject                 | text            |                                                                                                                      |
| category                | ticket_category | `bug` covers product bug reports                                                                                     |
| description             | text            | initial message body                                                                                                 |
| severity                | severity        |                                                                                                                      |
| status                  | support_status  | default `open`                                                                                                       |
| created_at / updated_at | timestamptz     |                                                                                                                      |

RLS: SELECT own or `is_staff()`; INSERT own; UPDATE/DELETE staff only via RPC. Realtime enabled (see below).

### support_ticket_messages

| column      | type        | notes                                       |
| ----------- | ----------- | ------------------------------------------- |
| id          | uuid, PK    |                                             |
| ticket_id   | uuid        | FK → support_tickets.id, on delete cascade  |
| sender_id   | uuid        | FK → profiles.id, on delete set null        |
| sender_role | app_role    | role at send time (drives bubble alignment) |
| body        | text        |                                             |
| created_at  | timestamptz |                                             |

RLS: SELECT if the ticket is readable (owner or staff); INSERT `sender_id = auth.uid()` and (ticket owner or staff).

**Real-time chat:** both tables in the `supabase_realtime` publication. Client and moderator insert messages through normal RLS-governed writes; both subscribe to `postgres_changes INSERT on support_ticket_messages filter ticket_id=eq.X`. Supabase Realtime respects RLS for postgres_changes, so it is simultaneously the real-time mediator and the persistence layer. Use Broadcast channels for typing indicators. (Per-subscriber RLS evaluation is a known scaling cliff — acceptable for v1; revisit before high volume.)

### reports

Content moderation of user-submitted recipes/reviews — a different domain from product bug reports (`support_tickets`).

| column      | type           | notes                                                                                                                  |
| ----------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| id          | uuid, PK       |                                                                                                                        |
| reporter_id | uuid, nullable | FK → profiles.id, ON DELETE SET NULL                                                                                   |
| recipe_id   | uuid, nullable | FK → recipes.id, ON DELETE CASCADE                                                                                     |
| review_id   | uuid, nullable | FK → reviews.id, ON DELETE CASCADE                                                                                     |
| reason      | text           |                                                                                                                        |
| status      | report_status  | default `open`; `reviewed` = seen, decision pending; `actioned` = content moderated; `dismissed` = no action warranted |
| created_at  | timestamptz    |                                                                                                                        |

CHECK: `num_nonnulls(recipe_id, review_id) = 1` — exactly one target, as a **real FK** (no polymorphic `target_id`): referential integrity guaranteed, and a report on deleted content disappears with it via cascade.

RLS: INSERT own; SELECT own or staff; UPDATE staff only.

### subscription_plans

| column             | type              | notes                                             |
| ------------------ | ----------------- | ------------------------------------------------- |
| id                 | uuid, PK          |                                                   |
| name               | text              | `Free`, `Premium`                                 |
| price_minor        | integer           | check `>= 0`; minor units of `currency` (0, 2000) |
| currency           | char(3)           | check `^[A-Z]{3}$` (ISO 4217), default `EUR`      |
| ai_actions_per_day | integer, nullable | null = unlimited                                  |
| tokens_per_month   | integer, nullable | null = unlimited                                  |
| description        | text              |                                                   |
| is_active          | boolean           | default true — soft delete                        |
| created_at         | timestamptz       |                                                   |

Reference table — retire via `is_active`, never delete. RLS: SELECT all authenticated; writes service-role only.

**Currency policy:** amounts are stored in the minor units of their **own** currency (cents/pence/fen), never pre-converted. FX conversion is display-time, app-level, and never persisted. A new currency = a new plan row, no migration.

### user_subscriptions

| column                                    | type                  | notes                                          |
| ----------------------------------------- | --------------------- | ---------------------------------------------- |
| id                                        | uuid, PK              |                                                |
| user_id                                   | uuid, nullable        | FK → profiles.id, ON DELETE SET NULL           |
| plan_id                                   | uuid                  | FK → subscription_plans.id, on delete restrict |
| status                                    | subscription_status   | default `active`                               |
| current_period_start / current_period_end | timestamptz           | monthly quota resets derive from this          |
| canceled_at                               | timestamptz, nullable |                                                |
| created_at / updated_at                   | timestamptz           |                                                |

**One active subscription per user** — DB-enforced; plan switches are `canceled` + new row, never two active rows:

```sql
create unique index user_subscriptions_one_active
  on user_subscriptions (user_id)
  where status = 'active';
```

RLS: SELECT own; INSERT/UPDATE service-role only (payment webhooks). `profiles.subscription_tier` is a cache of the active plan.

### token_transactions (append-only ledger — trigger-enforced)

| column           | type                   | notes                                                   |
| ---------------- | ---------------------- | ------------------------------------------------------- |
| id               | uuid, PK               |                                                         |
| user_id          | uuid, nullable         | FK → profiles.id, ON DELETE SET NULL                    |
| type             | token_transaction_type | `monthly_grant` / `purchase` / `consumption` / `expiry` |
| amount           | integer                | signed: positive credit, negative debit; check `<> 0`   |
| balance_after    | integer                | snapshot after applying — audits trivial; check `>= 0`  |
| description      | text, nullable         |                                                         |
| related_usage_id | uuid, nullable         | FK → ai_usage_log.id                                    |
| external_ref     | text, nullable         | payment provider transaction id                         |
| created_at       | timestamptz            |                                                         |

**Append-only is trigger-enforced, not conventional:**

```sql
create or replace function forbid_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'token_transactions is append-only (attempted %)', TG_OP;
end $$;

create trigger token_transactions_immutable
  before update or delete on token_transactions
  for each row execute function forbid_mutation();

create trigger token_transactions_no_truncate
  before truncate on token_transactions
  for each statement execute function forbid_mutation();
```

Even the service role cannot UPDATE/DELETE/TRUNCATE. Corrections are new compensating rows (the signed `amount` + `balance_after` design supports this natively). The only escape is an explicit `ALTER TABLE ... DISABLE TRIGGER` by a superuser — deliberate and auditable.

RLS: SELECT own; INSERT service-role only (exclusively via `complete_ai_usage` and `apply_token_transaction`). `profiles.tokens_remaining` is a fast cache; this table is the truth and can rebuild it — answers "where did my tokens go", enables refunds/disputes, makes counter drift recoverable.

### ai_usage_log

| column                                           | type           | notes                                                                                                    |
| ------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------- |
| id                                               | uuid, PK       |                                                                                                          |
| user_id                                          | uuid, nullable | FK → profiles.id, ON DELETE SET NULL                                                                     |
| action_type                                      | ai_action_type |                                                                                                          |
| model_id                                         | uuid, nullable | FK → ai_models.id, on delete set null (safety net; models are soft-deleted via `is_enabled` in practice) |
| prompt_tokens / completion_tokens / total_tokens | integer        | default 0, check `>= 0`                                                                                  |
| created_at                                       | timestamptz    |                                                                                                          |

RLS: SELECT own; INSERT/UPDATE service-role only (via `reserve_ai_usage` / `complete_ai_usage` / janitor sweep). The free daily cap (calendar day UTC) and premium token debits are enforced atomically by the quota RPCs. Also the raw data for AI usage metrics.

Reservation rows (`model_id is null, total_tokens = 0`) are placeholders that count toward the daily cap until completed or swept. A completed row always has `model_id` set — that predicate is the idempotency guard in `complete_ai_usage`.

### ai_models

| column     | type              | notes                                                            |
| ---------- | ----------------- | ---------------------------------------------------------------- |
| id         | uuid, PK          |                                                                  |
| name       | text              |                                                                  |
| tier       | ai_model_tier     | display column                                                   |
| is_enabled | boolean           | default true — soft delete                                       |
| min_tier   | subscription_tier | advisory at DB level; **NestJS enforces** when proxying AI calls |
| created_at | timestamptz       |                                                                  |

RLS: SELECT all authenticated; writes service-role only. Never hard-delete.

### order_receipts (receipt metadata only — privacy by data minimization)

| column                  | type              | notes                                                                                        |
| ----------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| id                      | uuid, PK          |                                                                                              |
| user_id                 | uuid, nullable    | FK → profiles.id, ON DELETE SET NULL. Owner                                                  |
| provider                | text              | e.g. `partner-grocery-api`                                                                   |
| external_order_id       | text, nullable    |                                                                                              |
| status                  | order_status      | default `placed`                                                                             |
| total_minor             | integer, nullable | check `>= 0`; minor units of `currency`                                                      |
| currency                | char(3)           | check `^[A-Z]{3}$` (ISO 4217), default `EUR` — the currency the provider actually charged in |
| created_at / updated_at | timestamptz       |                                                                                              |

**No item data is stored — ever.** The order payload goes browser → external provider directly; the provider keeps the full item record (fulfillment/invoicing) and `external_order_id` points at it. Augmented Cooking holds receipts, not orders. No FK to shopping lists (local-only). If item history is ever wanted: client-encrypted blob under the user's PIN key (`items_encrypted bytea`) — the DB never sees plaintext.

RLS: SELECT own or `is_admin()`; INSERT own; UPDATE service-role only (provider webhooks sync status).

### user_backups (encrypted local-data sync)

| column                  | type        | notes                                                                                                                 |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| id                      | uuid, PK    |                                                                                                                       |
| user_id                 | uuid        | UNIQUE, FK → profiles.id, on delete cascade. Owner                                                                    |
| data                    | bytea       | client-encrypted blob (nonce + AES-256-GCM ciphertext of serialized local data)                                       |
| kdf_salt                | bytea       | random per user                                                                                                       |
| kdf_params              | jsonb       | `{"algo":"argon2id","mem":65536,"iters":3,"version":1}` — stored so cost can be raised later without bricking backups |
| created_at / updated_at | timestamptz |                                                                                                                       |

Client flow: key = Argon2id(6-digit PIN, kdf_salt), tuned to ~300–500ms per derivation; encrypt serialized Dexie export; PUT blob (debounced on save). **The PIN never leaves the browser and is never recoverable — lost PIN = lost backup (by design; the UI must say so).** The server sees only ciphertext; brute-force resistance relies entirely on KDF cost. Deliberately convenience-grade protection: the payload is low-sensitivity local data (meal plans, shopping lists), protected for privacy against casual telemetry/spyware — not designed to protect the data at all costs. Optional future upgrade: key = Argon2id(PIN **or** 12-word recovery phrase), same code, more entropy.

RLS: own row only. The service-role never needs to read `data`.

## Account deletion & GDPR

**Deletion procedure (NestJS, service-role, single endpoint):**

1. Delete storage objects — `avatars/{user_id}/*` and `review-images/{user_id}/*` — via the Storage API. MUST happen first: the prefixes are keyed by `user_id`, which the cascade below anonymizes away (storage objects cannot be deleted from plpgsql — Supabase Storage is an API).
2. Delete the `auth.users` row → `profiles` cascade → trigger:
   - **DELETED** (personal, irreversibly): private/unapproved recipes (+ingredients, steps, nutrition — via cascades), favorites, collections, support tickets & messages, user_backups, abandoned `ai_usage_log` reservations, review images (step 1).
   - **ANONYMIZED** (`user_id → NULL`, content kept): public approved recipes and reviews — rendered as "[deleted user]", reviews without images. With images and user-keyed storage paths gone, no data point in the surviving rows links back to an identifiable person (Recital 26).
   - **RETAINED ANONYMIZED** (accounting obligations, Art. 6(1)(c)): `token_transactions`, `order_receipts`, `user_subscriptions`, `ai_usage_log` — admin/service-role-visible only (`user_id IS NULL` never matches "SELECT own" policies).

```sql
create or replace function handle_user_deletion()
returns trigger
language plpgsql as $$
begin
  -- Private / never-published recipes are personal: delete (cascades to
  -- ingredients, steps, nutrition). Public + approved recipes survive,
  -- anonymized via ON DELETE SET NULL.
  delete from recipes
   where user_id = old.id
     and not (is_public and moderation_status = 'approved');

  -- Abandoned reservations are same-day placeholders: delete rather
  -- than anonymize (completed rows anonymize via ON DELETE SET NULL).
  delete from ai_usage_log
   where user_id = old.id and model_id is null;

  -- Surviving (anonymized) reviews lose their images: the storage object
  -- is deleted by the caller (step 1) and the row no longer references it.
  -- This keeps the Recital 26 anonymization argument airtight — no
  -- user-keyed path remains anywhere.
  update reviews set image_url = null where user_id = old.id;

  return old;
end $$;

create trigger profiles_handle_user_deletion
  before delete on profiles
  for each row execute function handle_user_deletion();
```

Anonymized rows never match `auth.uid()` policies; they are reachable only via public visibility / staff, and editable only by admin. The client renders "[deleted user]" whenever the author join on `public_profile_info` misses. Retention periods for financial rows: confirm with counsel.

## Views

- `public_profile_info` (SECURITY DEFINER): id, display_name, avatar_url — review author rendering; no other profile data exposed.
- `admin_metrics_*` (SECURITY DEFINER, gated on `is_admin()`): daily signups, AI actions/day, token consumption, open moderation queue size (recipes + `recipe_revisions`), moderator workload (open tickets per assignee), recipe origin breakdown (manual/scraped/ai_generated). Computed, never stored; read by both the admin panel (via Supabase) and NestJS — single source of truth, no events table.

## Indexes

```sql
create index on recipes (user_id);
create index on recipes (moderation_status) where is_public;
create index on recipes using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
create index on recipes using gin (dietary_tags);
create index on recipes (cuisine_id);
create index on recipe_ingredients (recipe_id);
create index on recipe_ingredients (ingredient_id);           -- search-by-ingredient
create index on recipe_steps (recipe_id);
create index on recipe_revisions (recipe_id);                 -- revisions per recipe
create index on recipe_revisions (status) where status = 'pending';  -- moderation queue
create index on reviews (recipe_id);
create index on reviews (root_review_id, created_at);         -- whole-thread fetch
create index on reviews (user_id, created_at desc);           -- rate-limit counting
create unique index on reviews (recipe_id, user_id) where depth = 0;
                                                              -- one top-level review per user per recipe
create index on collections (user_id);
create index on support_tickets (user_id);
create index on support_tickets (status);
create index on support_tickets (assignee_id) where status <> 'resolved';
create index on support_ticket_messages (ticket_id, created_at);
create index on reports (status);
create index on reports (reporter_id);
create index on reports (recipe_id);
create index on reports (review_id);
create index on ingredients using gin (aliases);              -- scraper alias matching
create index on ai_usage_log (user_id, created_at desc);      -- daily-limit query
create index on token_transactions (user_id, created_at desc);
create unique index on user_subscriptions (user_id) where status = 'active';
create index on order_receipts (user_id, created_at desc);
```

`recipe_ingredients` / `recipe_steps` additionally carry `UNIQUE (recipe_id, position) DEFERRABLE INITIALLY IMMEDIATE` constraints (see their table sections).

## Storage buckets

- `recipe-images`, `review-images` — PRIVATE buckets. Write: owner, to `{user_id}/...`. Read: no direct object access; NestJS (or an edge function) issues signed URLs (suggested 24h expiry), cached client-side. **All `image_url`-style columns store object paths only — never signed URLs (they expire); signing happens at render time.**

  **Orphan cleanup:** row-level cascades cannot delete storage objects. When NestJS deletes a recipe or review, it must collect the affected image paths (`reviews.image_url`, recipe image paths) **before** the rows are deleted and remove the corresponding objects via the Storage API in the same request — otherwise orphaned blobs accumulate with no DB reference. Account deletion is covered by the prefix sweep in "Account deletion & GDPR" (which must run first, before `user_id` is anonymized away).

- `avatars` — public bucket. Public read; `{user_id}/avatar` writable by owner only.

## Trusted contexts

| Context                   | Key                     | Can do                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser                   | user JWT (Supabase SDK) | Non-content CRUD within RLS (favorites, collections, reviews, support tickets, profile settings); realtime subscriptions. Recipe content writes are routed through NestJS.                                                                                                                                                                                                                     |
| NestJS, acting for a user | forwarded user JWT      | Same as the user — RLS still applies                                                                                                                                                                                                                                                                                                                                                           |
| NestJS, privileged        | service-role key        | token_transactions (via quota RPCs only), ai_usage_log, user_subscriptions, profiles role/tier/tokens, quota reservation/completion/grant RPCs, moderation RPCs, plans/models/units/cuisines admin, ingredient_nutrition cache, signed URLs, provider webhooks, account-deletion endpoint (incl. storage cleanup), recipe content writes incl. scraping, AI generation, and `recipe_revisions` |

NestJS authenticates clients by validating Supabase-issued JWTs (JWKS). The service-role key never ships to the client.

## Explicitly out of database scope

- **Cooking-session state** (used-ingredient marks, step checkboxes, active timers): browser-only via Dexie.
- **Meal plans and shopping lists**: local-first, browser-only via Dexie. Cross-browser availability is handled by `user_backups` (PIN-encrypted blob), not live tables. Order payloads go browser → provider directly.
- **Nutrition trust enforcement**: labels (`nutrition_source`), not verification.
- **FX conversion**: display-time, app-level; the DB stores native-currency minor units only.

## Appendix: trigger function definitions

```sql
create or replace function recalc_recipe_rating()
returns trigger
language plpgsql
security definer set search_path = public as $$
declare
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

create or replace function invalidate_recipe_nutrition()
returns trigger
language plpgsql as $$
declare
  v_recipe uuid;
begin
  v_recipe := coalesce(new.recipe_id, old.recipe_id);
  -- Only computed rows are invalidatable. user_provided / imported
  -- rows are "as entered by author" and remain valid by definition.
  delete from recipe_nutrition
   where recipe_id = v_recipe
     and nutrition_source in ('usda', 'ai_estimated');
  return null;
end $$;

create trigger recipe_ingredients_invalidate_nutrition
  after insert or update or delete on recipe_ingredients
  for each row execute function invalidate_recipe_nutrition();

create trigger recipes_invalidate_nutrition_on_servings
  after update of servings on recipes
  for each row
  when (new.servings is distinct from old.servings)
  execute function invalidate_recipe_nutrition();
```

(`set_updated_at`, `reviews_validate_thread`, `reviews_reset_moderation_on_edit`, `recipes_reset_moderation_on_edit` are straightforward per their Triggers-section descriptions; `forbid_mutation` and `handle_user_deletion` are defined inline in their sections.)

## Appendix: future opt-in sync schemas (not created in v1)

`meal_plan_entries (id, user_id, date, meal_type, recipe_id fk recipes on delete cascade, servings, created_at — UNIQUE(user_id, date, meal_type, recipe_id))`, `shopping_lists (id, user_id, name, created_at)`, `shopping_list_items (id, list_id fk cascade, name, quantity, unit, category food_category, checked, source_recipe_id fk recipes on delete set null, created_at)`. RLS: own rows / owner-of-list.
