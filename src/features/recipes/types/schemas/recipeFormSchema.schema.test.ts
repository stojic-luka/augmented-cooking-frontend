import { describe, expect, it } from 'vitest';
import { aiRecipeDraftSchema, generateRecipeRequestSchema } from '@features/ai/types';
import loginSchema from '@features/auth/components/login/schemas/loginSchema.schema';
import { RecipeFilterParamsSchema } from './recipeListSchema.schema';
import { recipeFormSchema } from './recipeFormSchema.schema';
import { reviewFormSchema } from '@features/reviews/types/schemas/reviewSchema.schema';
import { addItemSchema, shoppingItemSchema } from '@features/shopping/types/schemas/shoppingSchema.schema';
import { importedRecipeSchema } from '@features/recipes/services/importRecipe';

/**
 * The client-side half of the API contract: form schemas gate what users can
 * submit; the draft schemas absorb untrusted AI/scraper output. Zod v4.
 */
describe('loginSchema', () => {
  it('accepts a well-formed login and rejects bad emails and empty passwords', () => {
    expect(loginSchema.safeParse({ email: 'cook@example.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'cook@example.com', password: '' }).success).toBe(false);
  });
});

describe('recipeFormSchema', () => {
  const valid = {
    title: 'Soup', description: 'Warm', cuisine: 'Italian', prepTimeMinutes: 10, cookTimeMinutes: null,
    servings: 4, difficulty: null, dietaryTags: [], isPublic: true,
    ingredients: [{ name: 'leek', amount: 1, unit: 'pc' }],
    steps: [{ instruction: 'Simmer.' }],
  };

  it('accepts the canonical form payload', () => {
    expect(recipeFormSchema.safeParse(valid).success).toBe(true);
  });

  it('enforces the per-field messages the forms surface', () => {
    const missingTitle = recipeFormSchema.safeParse({ ...valid, title: '' });
    expect(missingTitle.success).toBe(false);

    const zeroPrep = recipeFormSchema.safeParse({ ...valid, prepTimeMinutes: 0 });
    expect(zeroPrep.success).toBe(false);

    const noIngredients = recipeFormSchema.safeParse({ ...valid, ingredients: [] });
    expect(noIngredients.success).toBe(false);

    const blankAmount = recipeFormSchema.safeParse({
      ...valid,
      ingredients: [{ name: 'leek', amount: '', unit: 'pc' }],
    });
    expect(blankAmount.success).toBe(false);

    const longTitle = recipeFormSchema.safeParse({ ...valid, title: 'x'.repeat(121) });
    expect(longTitle.success).toBe(false);
  });
});

describe('RecipeFilterParamsSchema (URL search params)', () => {
  it('coerces string params from the URL and keeps everything optional', () => {
    const parsed = RecipeFilterParamsSchema.parse({ max_prep_time: '30', min_calories: '100', sort: 'rating' });
    expect(parsed).toMatchObject({ max_prep_time: 30, min_calories: 100, sort: 'rating' });
    expect(RecipeFilterParamsSchema.parse({})).toEqual({});
  });

  it('rejects garbage that coercion cannot rescue — routes then fall back to defaults', () => {
    expect(RecipeFilterParamsSchema.safeParse({ max_prep_time: 'abc' }).success).toBe(false);
    expect(RecipeFilterParamsSchema.safeParse({ sort: 'popular' }).success).toBe(false);
    expect(RecipeFilterParamsSchema.safeParse({ min_calories: -5 }).success).toBe(false);
  });
});

describe('aiRecipeDraftSchema (untrusted AI output)', () => {
  it('absent or malformed optional fields fall back to safe defaults, not errors', () => {
    const draft = aiRecipeDraftSchema.parse({ title: 'Only a title', cookTimeMinutes: null });
    expect(draft).toMatchObject({
      description: '',
      cuisine: '',
      prepTimeMinutes: 30,
      servings: 4,
      ingredients: [],
      steps: [],
      dietaryTags: [],
    });
  });

  it('coerces scraper-style string numbers', () => {
    const draft = aiRecipeDraftSchema.parse({
      title: 'X', cookTimeMinutes: 20, servings: '2', prepTimeMinutes: '15',
      ingredients: [{ name: 'flour', amount: '250' }],
    });
    expect(draft.servings).toBe(2);
    expect(draft.ingredients[0].amount).toBe(250);
  });

  it('generateRecipeRequestSchema requires at least one ingredient', () => {
    expect(generateRecipeRequestSchema.safeParse({ ingredients: [] }).success).toBe(false);
    expect(generateRecipeRequestSchema.safeParse({ ingredients: ['rice'] }).success).toBe(true);
  });
});

describe('importedRecipeSchema', () => {
  it('fills every scraper gap so the create form is always usable', () => {
    const draft = importedRecipeSchema.parse({ title: 'Scraped', prepTimeMinutes: 'oops' });
    expect(draft).toMatchObject({ prepTimeMinutes: 30, servings: 4, ingredients: [], steps: [], image: null });
  });
});

describe('reviewFormSchema', () => {
  it('requires a 1–5 rating and a non-empty comment', () => {
    expect(reviewFormSchema.safeParse({ rating: 5, comment: 'Great' }).success).toBe(true);
    expect(reviewFormSchema.safeParse({ rating: 0, comment: 'Great' }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ rating: 6, comment: 'Great' }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ rating: 4, comment: '' }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ rating: 4, comment: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('shopping schemas', () => {
  it('addItemSchema requires a name', () => {
    expect(addItemSchema.safeParse({ name: '' }).success).toBe(false);
    expect(addItemSchema.safeParse({ name: 'Rice', quantity: '500', unit: 'g' }).success).toBe(true);
  });

  it('shoppingItemSchema coerces string quantities and defaults missing flags', () => {
    const item = shoppingItemSchema.parse({
      id: 'i1', list_id: 'l1', name: 'Rice', quantity: '500', created_at: '2026-01-01T00:00:00Z',
    });
    expect(item.quantity).toBe(500);
    expect(item).toMatchObject({ checked: false, category: 'other', source_recipe_id: null });
  });
});
