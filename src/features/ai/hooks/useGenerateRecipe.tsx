import { useMutation } from '@tanstack/react-query';
import { generateRecipe } from '../services';
import type { GenerateRecipeRequest } from '../types';

export function useGenerateRecipe() {
  return useMutation({
    mutationFn: (request: GenerateRecipeRequest) => generateRecipe(request),
  });
}
