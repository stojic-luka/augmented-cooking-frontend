# DATABASE_REFERENCE.md

Supabase is the system of record: auth, storage, and all CRUD with RLS as the
real enforcement layer. The NestJS backend is a trusted helper — AI services,
external integrations, and privileged writes via the service-role key. The
client talks to Supabase directly for regular CRUD. See "Trusted contexts".

All PKs `uuid` unless noted. `created_at`/`updated_at` are `timestamptz`,
maintained by the `set_updated_at` trigger (Postgres defaults do NOT fire on
UPDATE — the trigger is mandatory).

**Reference-table rule (soft delete):** lookup tables that other data points
at (`ai_models`, `ingredients`, `units`, `cuisines`, `subscription_plans`) are
never hard-deleted. They are disabled via their flag column; their FKs use
`ON DELETE RESTRICT` (fail loudly) or `ON DELETE SET NULL` (graceful
degradation) as noted. History is never destroyed.

RLS policies use helper functions (SECURITY DEFINER, `set search_path =
public`, owned by postgres) to avoid RLS recursion.

## Enums

- `app_role`: `user` | `moderator` | `admin`
- `subscription_tier`: `free` | `premium`
- `unit_preference`: `metric` | `imperial`
- `meal_type`: `breakfast` | `lunch` | `dinner` | `snack`
- `moderation_status`: `pending` | `approved` | `flagged` | `rejected`
- `support_status`: `open` | `in_progress` | `resolved`
- `ticket_category`: `bug` | `recipe` | `billing` | `feature`
- `severity`: `low` | `medium` | `high`
- `report_target_type`: `recipe` | `review`
- `ai_model_tier`: `economy` | `advanced`
- `food_category`: `produce` | `dairy` | `meat` | `seafood` | `grains` |
  `pantry` | `spices` | `frozen` | `bakery` | `beverages` | `other`
  (enum, NOT free text — controlled vocabulary drives scraper mapping,
  shopping-list grouping, and filtering; unknown items fall to `other`.
  Escape hatch if ever needed: migrate to a lookup table like `cuisines`.)
- `ai_action_type`: `generate_recipe` | `edit_recipe` | `nutrition_analysis` |
  `substitute_ingredient` | `recommend` | `chat`
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
can_edit_recipe(p_recipe uuid)  -> bool   -- owner OR admin
owns_collection(p_col uuid)     -> bool
can_post_review(p_recipe uuid)  -> bool   -- < 5 reviews/replies by auth.uid() on p_recipe in last 24h
```

Optional optimization: an Auth hook injecting `app_role` as a custom JWT
claim so role checks read `auth.jwt()` without a table lookup.

## Triggers

- `set_updated_at` — BEFORE UPDATE on every table having `updated_at`.
- `reviews_validate_thread` — BEFORE INSERT on reviews: parent must share the
  recipe; `depth := parent.depth + 1`;
  `root_review_id := coalesce(parent.root_review_id, parent.id)`.
- `reviews_reset_moderation_on_edit` — comment/rating change → `pending`.
- `recipes_reset_moderation_on_edit` — content columns change → `pending`.
- `collections_gen_share_code` — random token when `is_public` and null.
- `resolve_reports_on_delete` — AFTER DELETE on recipes/reviews → open
  reports on the target become `resolved`.
- `recalc_recipe_rating` — AFTER INSERT/UPDATE/DELETE on reviews → refresh
  `recipes.rating_avg` / `recipes.review_count` (cache; never hand-set or
  trusted from imports).

## Tables

### profiles

One row per auth user. `id` equals `auth.users.id` (Supabase's `auth.users`
cannot be extended — this table IS the extension).

| column              | type              | notes                                                                    |
| ------------------- | ----------------- | ------------------------------------------------------------------------ |
| id                  | uuid, PK          | = auth.users.id, on delete cascade                                       |
| display_name        | text              |                                                                          |
| avatar_url          | text, nullable    | bucket `avatars`                                                         |
| role                | app_role          | default `user` — service-role write only                                 |
| subscription_tier   | subscription_tier | default `free` — service-role write only                                 |
| unit_preference     | unit_preference   | default `metric`                                                         |
| dietary_preferences | text[]            |                                                                          |
| ai_model_id         | uuid, nullable    | FK → ai_models.id, on delete set null                                    |
| tokens_remaining    | integer           | default 0 — service-role write only; NestJS updates after each AI action |
| created_at          | timestamptz       |                                                                          |
| updated_at          | timestamptz       |                                                                          |

Column-level grants (RLS cannot restrict columns):

```sql
GRANT UPDATE (display_name, avatar_url, unit_preference,
              dietary_preferences, ai_model_id)
  ON profiles TO authenticated;
-- role, subscription_tier, tokens_remaining: service-role key only.
```

SELECT: own row. Other users surface via the `public_profile_info` view
(id, display_name, avatar_url) for review author rendering.

### cuisines (reference table)

| column    | type           | notes                      |
| --------- | -------------- | -------------------------- |
| id        | uuid, PK       |                            |
| name      | text           | UNIQUE                     |
| slug      | text           | UNIQUE, URL-friendly       |
| region    | text, nullable | e.g. `South Asia`          |
| is_active | boolean        | default true — soft delete |

RLS: SELECT all authenticated; writes admin only (SECURITY DEFINER RPC
gated on `is_admin()`). Never hard-deleted.

### recipes

| column             | type                  | notes                                                                                 |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------- |
| id                 | uuid, PK              |                                                                                       |
| user_id            | uuid                  | FK → profiles.id. Owner.                                                              |
| title              | text                  |                                                                                       |
| description        | text                  |                                                                                       |
| cuisine_id         | uuid, nullable        | FK → cuisines.id, on delete restrict                                                  |
| category           | text, nullable        | `Main Course`, `Appetizer`, ...                                                       |
| cooking_method     | text, nullable        | `Baked`, `Fried`, `Pressure-cooked`, ... — also feeds the nutrition pipeline          |
| difficulty         | text, nullable        |                                                                                       |
| spice_level        | spice_level, nullable |                                                                                       |
| prep_time_minutes  | integer, nullable     | active prep time (total time is DERIVED: prep + cook; never stored)                   |
| cook_time_minutes  | integer, nullable     | heat/appliance time                                                                   |
| servings           | integer               |                                                                                       |
| dietary_tags       | text[]                | vegetarian, vegan, gluten-free, halal, ...                                            |
| is_public          | boolean               | default false                                                                         |
| moderation_status  | moderation_status     | default `pending`; moderator approves/rejects; owner edits reset to `pending`         |
| origin             | recipe_origin         | default `manual`; `scraped` set by the scraper, `ai_generated` set by the AI pipeline |
| source_url         | text, nullable        | original URL when `origin = 'scraped'`                                                |
| original_recipe_id | uuid, nullable        | FK → recipes.id, on delete set null (private copies)                                  |
| rating_avg         | numeric(2,1)          | default 0 — cache, trigger-maintained                                                 |
| review_count       | integer               | default 0 — cache, trigger-maintained                                                 |
| created_at         | timestamptz           |                                                                                       |
| updated_at         | timestamptz           |                                                                                       |

RLS: SELECT where `recipe_is_publicly_visible(id)` OR own OR `is_staff()`;
write via `can_edit_recipe(id)` (owner or admin); moderators change
`moderation_status` only, via SECURITY DEFINER RPC gated on `is_staff()`.
`origin` is set by the creating pipeline (client sets `manual`; NestJS sets
`scraped` / `ai_generated`) — users cannot claim `ai_generated` is `manual`
in a way that matters, since both are equally moderated.

### ingredients (master list)

| column     | type          | notes                                     |
| ---------- | ------------- | ----------------------------------------- |
| id         | uuid, PK      |                                           |
| name       | text          | UNIQUE, normalized (lowercase, singular)  |
| category   | food_category | default `other`                           |
| aliases    | text[]        | scraper matching (`aubergine` ~ eggplant) |
| is_active  | boolean       | default true — soft delete                |
| created_at | timestamptz   |                                           |

RLS: SELECT all authenticated; INSERT authenticated (unique name dedupes;
scraper normalizes); UPDATE admin only.

### ingredient_nutrition (per 100g — source of truth for computed values)

| column           | type              | notes                                   |
| ---------------- | ----------------- | --------------------------------------- |
| ingredient_id    | uuid, PK          | FK → ingredients.id, on delete restrict |
| fdc_id           | integer, nullable | USDA FoodData Central food id           |
| kcal_per_100g    | numeric, nullable |                                         |
| protein_per_100g | numeric, nullable |                                         |
| carbs_per_100g   | numeric, nullable |                                         |
| fat_per_100g     | numeric, nullable |                                         |
| source           | text              | `fdc`                                   | `openfoodfacts` | `ai` | `manual` |
| fetched_at       | timestamptz       |                                         |

RLS: SELECT all authenticated; INSERT/UPDATE service-role only (NestJS
cache writer). Populated lazily on recipe save/import; hits are free.
Nutrition is presented as an estimate for computed recipes — the
`nutrition_source` label communicates trust, it is not enforced.

### units

| column         | type           | notes                                         |
| -------------- | -------------- | --------------------------------------------- |
| code           | text, PK       | `g`, `kg`, `oz`, `ml`, `cup`, `tbsp`, `piece` |
| name           | text           |                                               |
| dimension      | unit_dimension | mass→g, volume→ml, count→piece                |
| factor_to_base | numeric        | cup = 236.588, oz = 28.3495, tbsp = 14.7868   |
| is_metric      | boolean        | metric↔imperial display conversion            |
| is_active      | boolean        | default true — soft delete                    |

RLS: SELECT all authenticated; writes service-role/admin only.
Cross-dimension conversion (cups→grams) is resolved per-ingredient by the
AI/backend, not by this table.

### recipe_ingredients

| column        | type              | notes                                   |
| ------------- | ----------------- | --------------------------------------- |
| id            | uuid, PK          |                                         |
| recipe_id     | uuid              | FK → recipes.id, on delete cascade      |
| ingredient_id | uuid              | FK → ingredients.id, on delete restrict |
| position      | integer           | ordering                                |
| quantity      | numeric, nullable | null = "to taste"                       |
| unit          | text, nullable    | FK → units.code, on delete restrict     |
| note          | text, nullable    | "finely chopped", "optional"            |
| is_optional   | boolean           | default false                           |
| raw_text      | text, nullable    | scraper fallback, rendered as-is        |

RLS: all ops require `can_edit_recipe(recipe_id)`; SELECT additionally when
the recipe is publicly visible. Ingredient search joins on `ingredient_id`
(exact match — no fuzzy text matching).

### recipe_steps

| column                 | type              | notes                                                                                             |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| id                     | uuid, PK          |                                                                                                   |
| recipe_id              | uuid              | FK → recipes.id, on delete cascade                                                                |
| position               | integer           | 1-based                                                                                           |
| instruction            | text              |                                                                                                   |
| estimated_time_minutes | integer, nullable | ACTIVE work ("chop vegetables, ~13 min")                                                          |
| timer_seconds          | integer, nullable | PASSIVE wait — frontend cooking-mode timer ("soak 20 min" → 1200). Nullable for "season to taste" |

RLS: same shape as `recipe_ingredients`.

### recipe_nutrition (per serving — computed cache / user-supplied)

| column               | type                  | notes                                 |
| -------------------- | --------------------- | ------------------------------------- |
| recipe_id            | uuid, PK              | FK → recipes.id, on delete cascade    |
| calories_per_serving | integer, nullable     |                                       |
| protein_grams        | numeric, nullable     | per serving                           |
| carbs_grams          | numeric, nullable     |                                       |
| fat_grams            | numeric, nullable     |                                       |
| fiber_grams          | numeric, nullable     |                                       |
| sugar_grams          | numeric, nullable     |                                       |
| sodium_mg            | numeric, nullable     |                                       |
| nutrition_source     | nutrition_source      | which pipeline produced these numbers |
| computed_at          | timestamptz, nullable | when the cache was last computed      |

NestJS flow (on save/import): sum `ingredient_nutrition.per_100g × grams`
÷ servings → write here with `usda` (or `ai_estimated` when the LLM filled
gaps; that path is cooking-method aware for free). For
`user_provided`/`imported` recipes with no trustworthy breakdown, the
author's/importer's numbers are stored directly and shown as
"as entered by author" — unverifiable by design, trust is communicated via
the label. Per-ingredient data is the truth for computed recipes; this table
is the cache, recomputed when ingredients change. One row per recipe
(PK = recipe_id) for cheap list-page joins. Future enhancement (no schema
change): USDA nutrient retention factors per cooking method × nutrient,
applied inside the NestJS computation.

RLS: SELECT whenever the recipe is SELECTable; writes via
`can_edit_recipe` (user overwrite sets `user_provided`) or service-role.

### reviews (threaded, Reddit-style)

| column            | type              | notes                                      |
| ----------------- | ----------------- | ------------------------------------------ |
| id                | uuid, PK          |                                            |
| recipe_id         | uuid              | FK → recipes.id, on delete cascade         |
| user_id           | uuid              | FK → profiles.id. Author.                  |
| rating            | integer, nullable | 1–5; top-level only (CHECK)                |
| comment           | text              |                                            |
| image_url         | text, nullable    | signed URL, bucket `review-images`         |
| parent_review_id  | uuid, nullable    | FK → reviews.id, on delete cascade         |
| root_review_id    | uuid, nullable    | thread anchor — trigger-maintained         |
| depth             | integer           | default 0 — trigger-maintained             |
| moderation_status | moderation_status | default `approved`; flagged/pending hidden |
| created_at        | timestamptz       |                                            |
| updated_at        | timestamptz       |                                            |

Thread fetch: `where root_review_id = X order by created_at` — one indexed
query, unlimited nesting. CHECK: `(depth > 0 AND rating IS NULL) OR
(depth = 0 AND rating BETWEEN 1 AND 5)`.

RLS: SELECT `moderation_status = 'approved' AND
recipe_is_publicly_visible(recipe_id)` OR own OR staff; INSERT own + visible
recipe + `can_post_review(recipe_id)` (5 per recipe / 24h, DB-enforced);
UPDATE/DELETE own (edits reset moderation to pending).

### favorites

| column     | type        | notes                                                         |
| ---------- | ----------- | ------------------------------------------------------------- |
| user_id    | uuid, PK    | composite PK with recipe_id; FK → profiles.id                 |
| recipe_id  | uuid, PK    | composite PK with user_id; FK → recipes.id, on delete cascade |
| created_at | timestamptz |                                                               |

RLS: own rows only.

### collections

| column      | type           | notes                     |
| ----------- | -------------- | ------------------------- |
| id          | uuid, PK       |                           |
| user_id     | uuid           | FK → profiles.id. Owner.  |
| name        | text           |                           |
| description | text           |                           |
| is_public   | boolean        | default false             |
| share_code  | text, nullable | UNIQUE, trigger-generated |
| created_at  | timestamptz    |                           |

RLS: owner full; SELECT where public or via share code.

### collection_recipes

| column        | type     | notes                                                               |
| ------------- | -------- | ------------------------------------------------------------------- |
| collection_id | uuid, PK | composite PK with recipe_id; FK → collections.id, on delete cascade |
| recipe_id     | uuid, PK | composite PK with collection_id; FK → recipes.id, on delete cascade |

RLS: SELECT when collection readable (recipe rows stay governed by recipes
RLS); INSERT `owns_collection AND (own recipe OR publicly visible recipe)`;
DELETE `owns_collection`.

### support_tickets

| column      | type            | notes                                                                                                                |
| ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| id          | uuid, PK        |                                                                                                                      |
| user_id     | uuid            | FK → profiles.id. Owner.                                                                                             |
| assignee_id | uuid, nullable  | FK → profiles.id, on delete set null — auto-assigned moderator (NestJS picks least-loaded open workload on creation) |
| subject     | text            |                                                                                                                      |
| category    | ticket_category |                                                                                                                      |
| description | text            | initial message body                                                                                                 |
| severity    | severity        |                                                                                                                      |
| status      | support_status  | default `open`                                                                                                       |
| created_at  | timestamptz     |                                                                                                                      |
| updated_at  | timestamptz     |                                                                                                                      |

RLS: SELECT own or `is_staff()`; INSERT own; UPDATE/DELETE staff only via
RPC. Realtime enabled (see below).

### support_ticket_messages

| column      | type        | notes                                       |
| ----------- | ----------- | ------------------------------------------- |
| id          | uuid, PK    |                                             |
| ticket_id   | uuid        | FK → support_tickets.id, on delete cascade  |
| sender_id   | uuid        | FK → profiles.id                            |
| sender_role | app_role    | role at send time (drives bubble alignment) |
| body        | text        |                                             |
| created_at  | timestamptz |                                             |

RLS: SELECT if the ticket is readable (owner or staff); INSERT
`sender_id = auth.uid()` and (ticket owner or staff).

**Real-time chat:** both tables enabled in the `supabase_realtime`
publication. Client and moderator insert messages through normal RLS-
governed writes; both subscribe to
`postgres_changes INSERT on support_ticket_messages filter ticket_id=eq.X`.
Supabase Realtime respects RLS for postgres_changes, so it is
simultaneously the real-time mediator and the persistence layer. Use
Broadcast channels for typing indicators.

### reports

| column      | type               | notes                                                                                                              |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| id          | uuid, PK           |                                                                                                                    |
| reporter_id | uuid               | FK → profiles.id                                                                                                   |
| target_type | report_target_type |                                                                                                                    |
| target_id   | uuid               | recipes.id or reviews.id; NOT a FK (polymorphic) — the `resolve_reports_on_delete` trigger handles target deletion |
| reason      | text               |                                                                                                                    |
| status      | support_status     | default `open`                                                                                                     |
| created_at  | timestamptz        |                                                                                                                    |

RLS: INSERT own; SELECT own or staff; UPDATE staff only.

### bug_reports

| column      | type           | notes                                                               |
| ----------- | -------------- | ------------------------------------------------------------------- |
| id          | uuid, PK       |                                                                     |
| user_id     | uuid NOT NULL  | FK → profiles.id (auth required — status tracking needs an account) |
| title       | text           |                                                                     |
| description | text           |                                                                     |
| severity    | severity       |                                                                     |
| status      | support_status | default `open`                                                      |
| created_at  | timestamptz    |                                                                     |

RLS: INSERT/SELECT own or staff; UPDATE staff only.

### subscription_plans

| column             | type              | notes                      |
| ------------------ | ----------------- | -------------------------- |
| id                 | uuid, PK          |                            |
| name               | text              | `Free`, `Premium`          |
| price_eur_cents    | integer           | 0, 2000                    |
| ai_actions_per_day | integer, nullable | null = unlimited           |
| tokens_per_month   | integer, nullable | null = unlimited           |
| description        | text              |                            |
| is_active          | boolean           | default true — soft delete |
| created_at         | timestamptz       |                            |

Reference table — retire via `is_active`, never delete.
RLS: SELECT all authenticated; writes service-role only.

### user_subscriptions

| column               | type                  | notes                                          |
| -------------------- | --------------------- | ---------------------------------------------- |
| id                   | uuid, PK              |                                                |
| user_id              | uuid                  | FK → profiles.id                               |
| plan_id              | uuid                  | FK → subscription_plans.id, on delete restrict |
| status               | subscription_status   | default `active`                               |
| current_period_start | timestamptz           |                                                |
| current_period_end   | timestamptz           | monthly quota resets derive from this          |
| canceled_at          | timestamptz, nullable |                                                |
| created_at           | timestamptz           |                                                |
| updated_at           | timestamptz           |                                                |

RLS: SELECT own; INSERT/UPDATE service-role only (payment webhooks).
`profiles.subscription_tier` is a cache of the active plan.

### token_transactions (append-only ledger — never UPDATE, never DELETE)

| column           | type                   | notes                                                   |
| ---------------- | ---------------------- | ------------------------------------------------------- |
| id               | uuid, PK               |                                                         |
| user_id          | uuid                   | FK → profiles.id                                        |
| type             | token_transaction_type | `monthly_grant` / `purchase` / `consumption` / `expiry` |
| amount           | integer                | signed: positive = credit, negative = debit             |
| balance_after    | integer                | snapshot after applying — makes audits trivial          |
| description      | text, nullable         |                                                         |
| related_usage_id | uuid, nullable         | FK → ai_usage_log.id                                    |
| external_ref     | text, nullable         | payment provider transaction id                         |
| created_at       | timestamptz            |                                                         |

RLS: SELECT own; INSERT service-role only. `profiles.tokens_remaining` is a
fast cache; this table is the truth and can rebuild it. Answers "where did
my tokens go", enables refunds/disputes, and makes counter drift
recoverable.

### ai_usage_log

| column            | type           | notes                                                                                                        |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| id                | uuid, PK       |                                                                                                              |
| user_id           | uuid           | FK → profiles.id                                                                                             |
| action_type       | ai_action_type |                                                                                                              |
| model_id          | uuid, nullable | FK → ai_models.id, **on delete set null** (safety net; models are soft-deleted via `is_enabled` in practice) |
| prompt_tokens     | integer        | default 0                                                                                                    |
| completion_tokens | integer        | default 0                                                                                                    |
| total_tokens      | integer        | default 0                                                                                                    |
| created_at        | timestamptz    |                                                                                                              |

RLS: SELECT own; INSERT/UPDATE service-role only. Enforces the free daily
cap (count rows in last 24h) and the premium monthly token cap (sum tokens
in billing period) — one indexed query each in NestJS. Also the raw data for
AI usage metrics.

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

| column            | type              | notes                      |
| ----------------- | ----------------- | -------------------------- |
| id                | uuid, PK          |                            |
| user_id           | uuid              | FK → profiles.id. Owner.   |
| provider          | text              | e.g. `partner-grocery-api` |
| external_order_id | text, nullable    |                            |
| status            | order_status      | default `placed`           |
| total_eur_cents   | integer, nullable |                            |
| created_at        | timestamptz       |                            |
| updated_at        | timestamptz       |                            |

**No item data is stored — ever.** The order payload goes browser →
external provider directly; the provider keeps the full item record (they
must, for fulfillment/invoicing) and `external_order_id` points at it.
Augmented Cooking holds receipts, not orders. No FK to shopping lists
(local-only). If item history is ever wanted: client-encrypted blob under
the user's PIN key (`items_encrypted bytea`) — the DB never sees plaintext.

RLS: SELECT own or `is_admin()`; INSERT own; UPDATE service-role only
(provider webhooks sync status).

### user_backups (encrypted local-data sync)

| column     | type        | notes                                                                                                                 |
| ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| id         | uuid, PK    |                                                                                                                       |
| user_id    | uuid        | UNIQUE, FK → profiles.id. Owner.                                                                                      |
| data       | bytea       | client-encrypted blob (nonce + AES-256-GCM ciphertext of serialized local data)                                       |
| kdf_salt   | bytea       | random per user                                                                                                       |
| kdf_params | jsonb       | `{"algo":"argon2id","mem":65536,"iters":3,"version":1}` — stored so cost can be raised later without bricking backups |
| created_at | timestamptz |                                                                                                                       |
| updated_at | timestamptz |                                                                                                                       |

Client flow: key = Argon2id(6-digit PIN, kdf_salt), tuned to ~300–500ms per
derivation; encrypt serialized Dexie export; PUT blob (debounced on save).
**The PIN never leaves the browser and is never recoverable — lost PIN =
lost backup (by design; the UI must say so).** The server sees only
ciphertext; brute-force resistance relies entirely on KDF cost
(convenience-grade protection — document this in the UI). Optional future
upgrade: key = Argon2id(PIN **or** 12-word recovery phrase), same code, more
entropy.

RLS: own row only. The service-role never needs to read `data`.

## Views

- `public_profile_info` (SECURITY DEFINER): id, display_name, avatar_url —
  review author rendering; no other profile data is exposed.
- `admin_metrics_*` (SECURITY DEFINER, gated on `is_admin()`): daily signups,
  AI actions/day, token consumption, open moderation queue size, moderator
  workload (open tickets per assignee), recipe origin breakdown
  (manual/scraped/ai_generated). Computed, never stored; read by both the
  admin panel (via Supabase) and NestJS — single source of truth, no events
  table.

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
create index on reviews (recipe_id);
create index on reviews (root_review_id, created_at);         -- whole-thread fetch
create index on reviews (user_id, created_at desc);           -- rate-limit counting
create unique index on collections (share_code) where share_code is not null;
create index on collections (user_id);
create index on support_tickets (user_id);
create index on support_tickets (status);
create index on support_tickets (assignee_id) where status <> 'resolved';
create index on support_ticket_messages (ticket_id, created_at);
create index on reports (status);
create index on reports (reporter_id);
create index on ai_usage_log (user_id, created_at desc);      -- daily-limit query
create index on token_transactions (user_id, created_at desc);
create index on user_subscriptions (user_id) where status = 'active';
create index on order_receipts (user_id, created_at desc);
```

## Storage buckets

- `recipe-images`, `review-images` — PRIVATE buckets. Write: owner, to
  `{user_id}/...`. Read: no direct object access; NestJS (or an edge
  function) issues signed URLs (suggested 24h expiry), cached client-side.
- `avatars` — public bucket. Public read; `{user_id}/avatar` writable by
  owner only.

## Trusted contexts

| Context                   | Key                     | Can do                                                                                                                                                                                                                                                             |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser                   | user JWT (Supabase SDK) | All CRUD within RLS; realtime subscriptions                                                                                                                                                                                                                        |
| NestJS, acting for a user | forwarded user JWT      | Same as the user — RLS still applies                                                                                                                                                                                                                               |
| NestJS, privileged        | service-role key        | token_transactions, ai_usage_log, user_subscriptions, profiles role/tier/tokens, moderation RPCs, plans/models/units/cuisines admin, ingredient_nutrition cache, signed URLs, provider webhooks, recipe scraping + AI generation (sets origin, computes nutrition) |

NestJS authenticates clients by validating Supabase-issued JWTs (JWKS).
The service-role key never ships to the client.

## Explicitly out of database scope

- **Cooking-session state** (used-ingredient marks, step checkboxes, active
  timers): browser-only via Dexie.
- **Meal plans and shopping lists**: local-first, browser-only via Dexie.
  Cross-browser availability is handled by `user_backups` (PIN-encrypted
  blob), not live tables. Order payloads go browser → provider directly.
- **Nutrition trust enforcement**: labels (`nutrition_source`), not
  verification.

## Appendix: future opt-in sync schemas (not created in v1)

`meal_plan_entries (id, user_id, date, meal_type, recipe_id fk recipes on
delete cascade, servings, created_at — UNIQUE(user_id, date, meal_type,
recipe_id))`, `shopping_lists (id, user_id, name, created_at)`,
`shopping_list_items (id, list_id fk cascade, name, quantity, unit,
category food_category, checked, source_recipe_id fk recipes on delete set
null, created_at)`. RLS: own rows / owner-of-list.
