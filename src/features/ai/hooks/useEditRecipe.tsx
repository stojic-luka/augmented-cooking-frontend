import { useMutation } from '@tanstack/react-query';
import { editRecipe } from '../services';
import type { AiRecipeDraft } from '../types';

export function useEditRecipe() {
  return useMutation({
    mutationFn: ({ recipe, instruction, modelId }: { recipe: AiRecipeDraft; instruction: string; modelId?: string }) =>
      editRecipe(recipe, { instruction, modelId }),
  });
}
