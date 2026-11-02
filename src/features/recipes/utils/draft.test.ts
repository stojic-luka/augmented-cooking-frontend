import { describe, expect, it } from 'vitest';
import { buildRecipeRows, sortDetailChildren } from '../services/recipeRows';
import { detailToFormValues, draftToFormValues } from './draft';
import { dbRecipe, IDS } from '@/test/fixtures/db';
import type { FullRecipe } from '../types';
import type { AiRecipeDraft } from '@features/ai/types';
import type { RecipeFormValues } from '../types';

describe('draftToFormValues (AI/import → create form)', () => {
  it('maps a full draft into form values with defaults for unmapped fields', () => {
    const draft: AiRecipeDraft = {
      title: 'AI Pasta',
      description: 'From the model.',
      cuisine: 'Italian',
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: 2,
      difficulty: 'easy',
      image: null,
      ingredients: [{ name: 'flour', amount: 300, unit: 'g' }],
      steps: [{ instruction: 'Knead.' }],
      dietaryTags: ['vegetarian'],
    };

    const values = draftToFormValues(draft);
    expect(values).toMatchObject({
      title: 'AI Pasta',
      cuisine: 'Italian',
      servings: 2,
      isPublic: true,
    });
    expect(values.ingredients).toEqual([{ name: 'flour', amount: '300', unit: 'g' }]);
    expect(values.steps).toEqual([{ instruction: 'Knead.' }]);
  });

  it('substitutes blank rows when the draft has no ingredients or steps', () => {
    const draft: AiRecipeDraft = {
      title: 'Empty',
      description: '', cuisine: '', prepTimeMinutes: 30, cookTimeMinutes: null, servings: 4,
      difficulty: null, image: null, ingredients: [], steps: [], dietaryTags: [],
    };
    const values = draftToFormValues(draft);
    expect(values.ingredients).toEqual([{ name: '', amount: '', unit: '' }]);
    expect(values.steps).toEqual([{ instruction: '' }]);
    expect(values.prepTimeMinutes).toBe(30);
  });
});

describe('detailToFormValues (stored recipe → edit form)', () => {
  it('maps the full recipe, stringifies numeric quantities, defaults null times to 1', () => {
    const recipe = dbRecipe({ prep_time_minutes: null, cook_time_minutes: null, servings: 6 });
    const values = detailToFormValues(recipe as unknown as FullRecipe);

    expect(values).toMatchObject({
      title: 'Tomato Rice',
      cuisine: 'Italian',
      prepTimeMinutes: 1, // schema requires a positive int
      cookTimeMinutes: null,
      servings: 6,
      isPublic: true,
    });
    expect(values.ingredients).toEqual([{ name: 'tomato', amount: '200', unit: 'g' }]);
    expect(values.steps).toEqual([{ instruction: 'Simmer the tomatoes.' }]);
  });
});

describe('buildRecipeRows (form → DB rows)', () => {
  const unitCodes = new Set(['g', 'kg', 'pc']);

  it('assigns 1-based positions, lowercases known units, and nulls unknown ones', () => {
    const values: RecipeFormValues = {
      title: 'T', description: 'D', cuisine: 'Italian', prepTimeMinutes: 10, cookTimeMinutes: null,
      servings: 2, difficulty: null, dietaryTags: [], isPublic: true,
      ingredients: [
        { name: 'rice', amount: 500, unit: 'G' },
        { name: 'eggs', amount: '3', unit: 'pieces' },
      ],
      steps: [
        { instruction: '  Boil water.  ' },
        { instruction: 'Add rice.' },
      ],
    };

    const rows = buildRecipeRows({
      recipe: {
        user_id: IDS.user, title: 'T', description: 'D', cuisine_id: null, category: null, cooking_method: null,
        spice_level: null, prep_time_minutes: 10, cook_time_minutes: null, servings: 2, difficulty: null,
        image_url: null, dietary_tags: [], is_public: true, origin: 'manual', source_url: null, original_recipe_id: null,
      },
      ingredients: values.ingredients,
      steps: values.steps,
      ingredientIds: ['id-rice', 'id-eggs'],
      unitCodes,
    });

    expect(rows.ingredients[0]).toMatchObject({ position: 1, quantity: 500, unit: 'g', note: null });
    // "pieces" is not a known unit code — kept verbatim in the note.
    expect(rows.ingredients[1]).toMatchObject({ position: 2, quantity: 3, unit: null, note: 'pieces' });
    expect(rows.steps).toEqual([
      { position: 1, instruction: 'Boil water.', estimated_time_minutes: null, timer_seconds: null },
      { position: 2, instruction: 'Add rice.', estimated_time_minutes: null, timer_seconds: null },
    ]);
  });

  it('collects both a non-parsable amount and unknown unit into the note', () => {
    const values: RecipeFormValues = {
      title: 'T', description: 'D', cuisine: '', prepTimeMinutes: 10, cookTimeMinutes: null,
      servings: 2, difficulty: null, dietaryTags: [], isPublic: true,
      ingredients: [{ name: 'salt', amount: 'to taste', unit: 'pinches' }],
      steps: [{ instruction: 'Season.' }],
    };
    const rows = buildRecipeRows({
      recipe: {
        user_id: IDS.user, title: 'T', description: 'D', cuisine_id: null, category: null, cooking_method: null,
        spice_level: null, prep_time_minutes: 10, cook_time_minutes: null, servings: 2, difficulty: null,
        image_url: null, dietary_tags: [], is_public: true, origin: 'manual', source_url: null, original_recipe_id: null,
      },
      ingredients: values.ingredients,
      steps: values.steps,
      ingredientIds: ['id-salt'],
      unitCodes,
    });
    expect(rows.ingredients[0]).toMatchObject({ quantity: null, unit: null, note: 'to taste pinches' });
  });
});

describe('sortDetailChildren', () => {
  it('sorts ingredients and steps by position without mutating the input', () => {
    const detail = dbRecipe({
      recipe_ingredients: [
        { ...dbRecipe().recipe_ingredients[0], position: 3, id: 'c' },
        { ...dbRecipe().recipe_ingredients[0], position: 1, id: 'a' },
        { ...dbRecipe().recipe_ingredients[0], position: 2, id: 'b' },
      ],
    });

    const sorted = sortDetailChildren(detail as unknown as FullRecipe);
    expect(sorted.recipe_ingredients.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });
});
