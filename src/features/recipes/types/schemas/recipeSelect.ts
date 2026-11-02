/**
 * The one select string for every query that returns recipe rows.
 *
 * MUST stay in sync with `fullRecipeSchema` (recipeSchema.schema.ts): the
 * select defines what the database returns, the schema defines what that
 * response is validated against. Change them together — an embed the schema
 * requires but the select omits only fails at runtime, inside `.parse()`.
 *
 * `ingredient:ingredients(*)` aliases the FK embed so every recipe_ingredients
 * row exposes the master `ingredients` row under the `ingredient` key the
 * schema expects.
 *
 * Declared as a string literal (not built with `.join()` at runtime) because
 * supabase-js parses the select string at the type level; a plain `string`
 * widens the query result to a `ParserError` type.
 */
export const RECIPE_SELECT =
  '*, cuisines(*), recipe_nutrition(*), recipe_ingredients(*, ingredient:ingredients(*)), recipe_steps(*)';

/**
 * Type-level image of {@link RECIPE_SELECT} with the nutrition embed forced
 * `!inner`. `RECIPE_SELECT_NUTRITION_INNER` is checked against it, so the two
 * strings cannot drift apart.
 */
type NutritionInner<Select extends string> =
  Select extends `${infer before}recipe_nutrition(*)${infer after}`
    ? `${before}recipe_nutrition!inner(*)${after}`
    : never;

type RecipeSelectNutritionInner = NutritionInner<typeof RECIPE_SELECT>;

/**
 * Variant for queries that filter on `recipe_nutrition` columns (e.g.
 * calories): a plain left embed keeps recipes that have no nutrition row even
 * when they fail the filter, because the filter compares against a missing
 * embed. `!inner` drops them, so the parent rows are actually filtered.
 */
export const RECIPE_SELECT_NUTRITION_INNER =
  '*, cuisines(*), recipe_nutrition!inner(*), recipe_ingredients(*, ingredient:ingredients(*)), recipe_steps(*)' satisfies RecipeSelectNutritionInner;
