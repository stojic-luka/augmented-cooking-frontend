/**
 * Seed fixtures for MSW handlers. Every builder returns plain JSON that
 * satisfies the generated schemas in `src/types/schemas/supabase` and the
 * shapes `RECIPE_SELECT` produces (embeds included). Values are stable —
 * never `Date.now()` or `Math.random()` — so tests are deterministic and
 * failures reproducible.
 */

export const IDS = {
  user: '11111111-1111-4111-8111-111111111111',
  otherUser: '22222222-2222-4222-8222-222222222222',
  moderator: '33333333-3333-4333-8333-333333333333',
  cuisineItalian: 'aaaaaaa1-0000-4000-8000-000000000001',
  cuisineJapanese: 'aaaaaaa2-0000-4000-8000-000000000002',
  ingredientTomato: 'bbbbbbb1-0000-4000-8000-000000000001',
  ingredientRice: 'bbbbbbb2-0000-4000-8000-000000000002',
  ingredientChicken: 'bbbbbbb3-0000-4000-8000-000000000003',
  unitGram: 'ccccccc1-0000-4000-8000-000000000001',
  unitPiece: 'ccccccc2-0000-4000-8000-000000000002',
  recipeA: 'ddddddd1-0000-4000-8000-000000000001',
  recipeB: 'ddddddd2-0000-4000-8000-000000000002',
  recipeC: 'ddddddd3-0000-4000-8000-000000000003',
  planFree: 'eeeeeee1-0000-4000-8000-000000000001',
  planPremium: 'eeeeeee2-0000-4000-8000-000000000002',
  modelEconomy: 'fffffff1-0000-4000-8000-000000000001',
  modelAdvanced: 'fffffff2-0000-4000-8000-000000000002',
  collectionWeek: 'abababa1-0000-4000-8000-000000000001',
  ticketLogin: 'cdcdcdc1-0000-4000-8000-000000000001',
  reviewGreat: 'efefefe1-0000-4000-8000-000000000001',
  reportRecipe: 'fbfbfbf1-0000-4000-8000-000000000001',
} as const;

export const TEST_PASSWORD = 'correct-horse-battery';

export const TIMESTAMPS = {
  t0: '2026-01-01T10:00:00Z',
  t1: '2026-02-01T10:00:00Z',
  t2: '2026-03-01T10:00:00Z',
} as const;

/** Minimal Supabase auth user object (GoTrue shape). */
export function authUser(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.user,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'cook@example.com',
    email_confirmed_at: TIMESTAMPS.t0,
    phone: '',
    confirmed_at: TIMESTAMPS.t0,
    last_sign_in_at: TIMESTAMPS.t0,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'Cook' },
    identities: [],
    created_at: TIMESTAMPS.t0,
    updated_at: TIMESTAMPS.t0,
    ...overrides,
  };
}

/** GoTrue session as returned by /auth/v1 endpoints; also the localStorage shape. */
export function authSession(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const issuedAt = 1_800_000_000; // stable epoch seconds, far in the past
  return {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: issuedAt + 3600 * 24 * 365, // valid for the whole test run
    refresh_token: 'test-refresh-token',
    user: authUser(),
    ...overrides,
  };
}

export function profile(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.user,
    display_name: 'Cook',
    avatar_url: null,
    role: 'user',
    subscription_tier: 'free',
    tokens_remaining: 0,
    unit_preference: 'metric',
    dietary_preferences: [],
    ai_model_id: null,
    created_at: TIMESTAMPS.t0,
    updated_at: TIMESTAMPS.t0,
    ...overrides,
  };
}

/** The public_profile_info view shape: (id, display_name, avatar_url). */
export function profileInfo(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return { id: IDS.user, display_name: 'Cook', avatar_url: null, ...overrides };
}

export function cuisine(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return { id: IDS.cuisineItalian, name: 'Italian', slug: 'italian', region: null, is_active: true, created_at: TIMESTAMPS.t0, ...overrides };
}

export function ingredientRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.ingredientTomato,
    name: 'tomato',
    aliases: [],
    category: 'produce',
    is_active: true,
    created_at: TIMESTAMPS.t0,
    ...overrides,
  };
}

export function nutrition(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    recipe_id: IDS.recipeA,
    calories_per_serving: 540,
    protein_grams: 32,
    carbs_grams: 48,
    fat_grams: 14,
    sugar_grams: null,
    fiber_grams: null,
    sodium_mg: null,
    nutrition_source: 'ai_estimated',
    computed_at: TIMESTAMPS.t1,
    ...overrides,
  };
}

export function recipeIngredient(
  overrides: Partial<Record<string, unknown>> & { ingredient?: Record<string, unknown> } = {},
): RecipeIngredientFixture {
  const { ingredient: ingredientEmbed, ...rest } = overrides;
  return {
    id: 'eeeeeeee-0000-4000-8000-000000000001',
    recipe_id: IDS.recipeA,
    ingredient_id: IDS.ingredientTomato,
    position: 1,
    quantity: 200,
    unit: 'g',
    note: null,
    is_optional: false,
    raw_text: null,
    ingredient: ingredientEmbed ?? ingredientRow(),
    ...rest,
  } as RecipeIngredientFixture;
}

export function recipeStep(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'f0f0f0f0-0000-4000-8000-000000000001',
    recipe_id: IDS.recipeA,
    position: 1,
    instruction: 'Simmer the tomatoes.',
    estimated_time_minutes: 10,
    timer_seconds: null,
    ...overrides,
  };
}

/** Fixture types keep the embeds tests manipulate addressable. */
export interface RecipeIngredientFixture extends Record<string, unknown> {
  position: number;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  ingredient: Record<string, unknown>;
}
export interface RecipeStepFixture extends Record<string, unknown> {
  position: number;
  instruction: string;
}
export interface RecipeFixture extends Record<string, unknown> {
  recipe_ingredients: RecipeIngredientFixture[];
  recipe_steps: RecipeStepFixture[];
  cuisines: Record<string, unknown> | null;
  recipe_nutrition: Record<string, unknown> | null;
}

/**
 * A full recipe row exactly as `RECIPE_SELECT` returns it:
 * scalar columns + cuisines + recipe_nutrition + children with embeds.
 */
export function dbRecipe(overrides: Partial<Record<string, unknown>> = {}): RecipeFixture {
  return {
    id: IDS.recipeA,
    user_id: IDS.user,
    title: 'Tomato Rice',
    description: 'A simple one-pot tomato rice.',
    cuisine_id: IDS.cuisineItalian,
    category: null,
    cooking_method: null,
    spice_level: null,
    prep_time_minutes: 15,
    cook_time_minutes: 25,
    servings: 4,
    difficulty: 'easy',
    image_url: null,
    dietary_tags: ['vegetarian'],
    is_public: true,
    moderation_status: 'approved',
    origin: 'manual',
    source_url: null,
    original_recipe_id: null,
    rating_avg: 4.5,
    review_count: 2,
    created_at: TIMESTAMPS.t1,
    updated_at: TIMESTAMPS.t1,
    cuisines: cuisine(),
    recipe_nutrition: nutrition(),
    recipe_ingredients: [recipeIngredient()],
    recipe_steps: [recipeStep()],
    ...overrides,
  } as unknown as RecipeFixture;
}

export function subscriptionPlan(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.planFree,
    name: 'Free',
    description: 'The basics to get cooking.',
    price_minor: 0,
    currency: 'EUR',
    ai_actions_per_day: 30,
    tokens_per_month: null,
    is_active: true,
    created_at: TIMESTAMPS.t0,
    ...overrides,
  };
}

export function aiModel(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.modelEconomy,
    name: 'flash-mini',
    tier: 'economy',
    is_enabled: true,
    min_tier: 'free',
    created_at: TIMESTAMPS.t0,
    ...overrides,
  };
}

export function supportTicket(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.ticketLogin,
    user_id: IDS.user,
    assignee_id: null,
    subject: 'Cannot log in',
    category: 'bug',
    severity: 'medium',
    status: 'open',
    description: 'The login button does nothing.',
    created_at: TIMESTAMPS.t1,
    updated_at: TIMESTAMPS.t1,
    ...overrides,
  };
}

export function ticketMessage(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'edededed-0000-4000-8000-000000000001',
    ticket_id: IDS.ticketLogin,
    sender_id: IDS.user,
    sender_role: 'user',
    body: 'Happens in every browser.',
    created_at: TIMESTAMPS.t1,
    ...overrides,
  };
}

export function review(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.reviewGreat,
    recipe_id: IDS.recipeA,
    user_id: IDS.user,
    rating: 5,
    comment: 'Weekly staple in our house.',
    image_url: null,
    parent_review_id: null,
    root_review_id: null,
    depth: 0,
    moderation_status: 'approved',
    created_at: TIMESTAMPS.t2,
    updated_at: TIMESTAMPS.t2,
    ...overrides,
  };
}

export function report(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.reportRecipe,
    reporter_id: IDS.otherUser,
    recipe_id: IDS.recipeA,
    review_id: null,
    reason: 'Spam',
    status: 'open',
    created_at: TIMESTAMPS.t2,
    ...overrides,
  };
}

export function collection(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: IDS.collectionWeek,
    user_id: IDS.user,
    name: 'Weeknight dinners',
    description: 'Under 30 minutes.',
    is_public: false,
    created_at: TIMESTAMPS.t1,
    ...overrides,
  };
}
