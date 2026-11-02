import type { RecipeFormValues } from '../types';
import type { PublicRecipeIngredientsRow, PublicRecipeStepsRow } from '@/types/schemas';
import type { RecipeWriteRow } from './recipeImage';

export interface RecipeRowInput {
  recipe: RecipeWriteRow;
  ingredients: RecipeFormValues['ingredients'];
  steps: RecipeFormValues['steps'];
  /** Ids resolved via `ensureIngredientIds`, parallel to `ingredients`. */
  ingredientIds: string[];
  unitCodes: Set<string>;
}

function toNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildRecipeRows(input: RecipeRowInput): {
  recipe: RecipeRowInput['recipe'];
  ingredients: Omit<PublicRecipeIngredientsRow, 'id' | 'recipe_id'>[];
  steps: Omit<PublicRecipeStepsRow, 'id' | 'recipe_id'>[];
} {
  return {
    recipe: input.recipe,
    ingredients: input.ingredients.map((ingredient, index) => {
      const quantity = toNumber(ingredient.amount as string | number);
      const unit = ingredient.unit.trim();
      const unitCode = input.unitCodes.has(unit.toLowerCase()) ? unit.toLowerCase() : null;

      // Preserve anything the schema could not represent verbatim.
      const extras: string[] = [];
      if (quantity === null && String(ingredient.amount).trim()) {
        extras.push(String(ingredient.amount).trim());
      }
      if (unitCode === null && unit) {
        extras.push(unit);
      }

      return {
        position: index + 1,
        ingredient_id: input.ingredientIds[index],
        quantity,
        unit: unitCode,
        note: extras.length > 0 ? extras.join(' ') : null,
        is_optional: false,
        raw_text: null,
      };
    }),
    steps: input.steps.map((step, index) => ({
      position: index + 1,
      instruction: step.instruction.trim(),
      estimated_time_minutes: null,
      timer_seconds: null,
    })),
  };
}

/**
 * Sorts children by position after parsing. Recipe queries already order the
 * embeds via `referencedTable`; this keeps the guarantee local to the parsed
 * result (e.g. for embeds nested behind another table, like favorites).
 */
export function sortDetailChildren<
  T extends { recipe_ingredients: { position: number }[]; recipe_steps: { position: number }[] },
>(detail: T): T {
  return {
    ...detail,
    recipe_ingredients: [...detail.recipe_ingredients].sort((a, b) => a.position - b.position),
    recipe_steps: [...detail.recipe_steps].sort((a, b) => a.position - b.position),
  };
}
