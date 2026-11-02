import { api } from '@/api';
import { AI_API_ROUTES } from '../api';
import { aiRecipeDraftSchema, generateRecipeRequestSchema, type AiRecipeDraft, type GenerateRecipeRequest } from '../types';
import { z } from 'zod';
import { publicRecipeNutritionRowSchema } from '@/types/schemas';
import type { PublicRecipeNutritionRow } from '@/types/schemas';

const generateResponseSchema = z.object({ recipe: aiRecipeDraftSchema });
const editResponseSchema = z.object({ recipe: aiRecipeDraftSchema, summary: z.string().catch('') });

/** Nutrition analysis result: the DB row plus the model's improvement suggestions. */
export type AnalyzedNutrition = PublicRecipeNutritionRow & { suggestions: string[] };

const analyzeResponseSchema = publicRecipeNutritionRowSchema.extend({
  suggestions: z.array(z.string()).catch([]),
});

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
  return analyzeResponseSchema.parse(response.data);
}
