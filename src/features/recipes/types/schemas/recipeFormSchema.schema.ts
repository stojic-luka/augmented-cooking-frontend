import { z } from 'zod';

const amountSchema = z.union([z.string(), z.number()]);

export const recipeFormIngredientSchema = z.object({
  name: z.string().min(1, { error: 'Ingredient name is required' }),
  amount: amountSchema.refine((v) => v !== '' || typeof v === 'number', { error: 'Amount is required' }),
  unit: z.string().min(1, { error: 'Unit is required' }),
});

export const recipeFormStepSchema = z.object({
  instruction: z.string().min(1, { error: 'Instruction text is required' }),
});

export const recipeFormSchema = z.object({
  title: z.string().min(1, { error: 'Title is required' }).max(120, { error: 'Title is too long' }),
  description: z.string().min(1, { error: 'Description is required' }),
  cuisine: z.string().min(1, { error: 'Cuisine is required' }),
  prepTimeMinutes: z.number({ error: 'Prep time must be a number' }).int().positive({ error: 'Prep time must be positive' }),
  cookTimeMinutes: z
    .number({ error: 'Cook time must be a number' })
    .int()
    .positive({ error: 'Cook time must be positive' })
    .nullable(),
  servings: z.number({ error: 'Servings must be a number' }).int().positive({ error: 'Servings must be positive' }),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable(),
  dietaryTags: z.array(z.string()),
  isPublic: z.boolean(),
  ingredients: z.array(recipeFormIngredientSchema).min(1, { error: 'Add at least one ingredient' }),
  steps: z.array(recipeFormStepSchema).min(1, { error: 'Add at least one instruction' }),
});

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;

export const emptyRecipeForm: RecipeFormValues = {
  title: '',
  description: '',
  cuisine: '',
  prepTimeMinutes: 30,
  cookTimeMinutes: null,
  servings: 4,
  difficulty: null,
  dietaryTags: [],
  isPublic: true,
  ingredients: [{ name: '', amount: '', unit: '' }],
  steps: [{ instruction: '' }],
};
