import { z } from 'zod';
import { api } from '@/api';
import { AI_API_ROUTES } from '../api';
import { aiRecipeDraftSchema, generateRecipeRequestSchema, type AiRecipeDraft, type GenerateRecipeRequest } from '../types';
import { publicNutritionSourceSchema } from '@/types/schemas';

const generateResponseSchema = z.object({ recipe: aiRecipeDraftSchema });
const editResponseSchema = z.object({ recipe: aiRecipeDraftSchema, summary: z.string().catch('') });

export const analyzedNutritionSchema = z.object({
  recipeId: z.string().optional(),
  computedAt: z.string().optional(),
  caloriesPerServing: z.number().optional(),
  proteinGrams: z.number().optional(),
  carbsGrams: z.number().optional(),
  fatGrams: z.number().optional(),
  fiberGrams: z.number().optional(),
  sugarGrams: z.number().optional(),
  sodiumMg: z.number().optional(),
  nutritionSource: publicNutritionSourceSchema.optional(),
  suggestions: z.array(z.string()),
});
export type AnalyzedNutrition = z.infer<typeof analyzedNutritionSchema>;

export async function generateRecipe(request: GenerateRecipeRequest): Promise<AiRecipeDraft> {
  const payload = generateRecipeRequestSchema.parse(request);
  const response = await api.post<unknown>(AI_API_ROUTES.generateRecipe, payload);
  return generateResponseSchema.parse(response.data).recipe;
}

export async function editRecipe(
  recipe: AiRecipeDraft,
  request: { instruction: string; modelId?: string },
): Promise<{ recipe: AiRecipeDraft; summary: string }> {
  const payload = { recipe, instruction: request.instruction, modelId: request.modelId };
  const response = await api.post<unknown>(AI_API_ROUTES.editRecipe, payload);
  return editResponseSchema.parse(response.data);
}

export async function analyzeNutrition(recipe: AiRecipeDraft): Promise<AnalyzedNutrition> {
  const response = await api.post<unknown>(AI_API_ROUTES.analyzeNutrition, { recipe });
  console.log(response.data);
  return analyzedNutritionSchema.parse(response.data);
}
