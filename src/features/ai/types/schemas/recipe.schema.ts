import { z } from 'zod';
import { numeric } from '@/types/schemas';

/** Draft recipe shape returned by AI endpoints and the importer. */
export const aiRecipeDraftSchema = z.object({
  title: z.string(),
  description: z.string().catch(''),
  cuisine: z.string().catch(''),
  prepTimeMinutes: z.coerce.number().int().positive().catch(30),
  cookTimeMinutes: z
    .number({ error: 'Cook time must be a number' })
    .int()
    .positive({ error: 'Cook time must be positive' })
    .nullable(),
  servings: z.coerce.number().int().positive().catch(4),
  difficulty: z.string().nullable().catch(null),
  image: z.string().nullable().catch(null),
  ingredients: z
    .array(
      z.object({
        name: z.string(),
        amount: numeric.nullable().catch(null),
        unit: z.string().catch(''),
      }),
    )
    .catch([]),
  steps: z.array(z.object({ instruction: z.string() })).catch([]),
  dietaryTags: z.array(z.string()).catch([]),
});

export type AiRecipeDraft = z.infer<typeof aiRecipeDraftSchema>;

export const generateRecipeRequestSchema = z.object({
  ingredients: z.array(z.string()).min(1, { error: 'Add at least one ingredient you have' }),
  cuisine: z.string().optional(),
  maxCalories: z.number().int().positive().optional(),
  maxPrepMinutes: z.number().int().positive().optional(),
  dietaryTags: z.array(z.string()).optional(),
  modelId: z.string().optional(),
});

export type GenerateRecipeRequest = z.infer<typeof generateRecipeRequestSchema>;

export const editRecipeRequestSchema = z.object({
  instruction: z.string().min(1, { error: 'Describe the change you want' }),
  modelId: z.string().optional(),
});

export type EditRecipeRequest = z.infer<typeof editRecipeRequestSchema>;
