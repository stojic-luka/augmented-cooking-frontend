import { useMutation } from '@tanstack/react-query';
import { analyzeNutrition } from '../services';
import type { AiRecipeDraft } from '../types';

/**
 * Analyzes a recipe's nutrition through the AI endpoint. Failures (quota,
 * model availability) surface as a visible, recoverable state in the UI.
 */
export function useAnalyzeNutrition() {
  return useMutation({
    mutationFn: (recipe: AiRecipeDraft) => analyzeNutrition(recipe),
  });
}
