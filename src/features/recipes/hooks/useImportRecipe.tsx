import { useMutation } from '@tanstack/react-query';
import { importRecipe } from '../services';

export function useImportRecipe() {
  return useMutation({
    mutationFn: (url: string) => importRecipe(url),
  });
}
