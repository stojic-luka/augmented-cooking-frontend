import { z } from 'zod';
import { api } from '@/api';
import { RECIPES_API_ROUTES } from '../api';
import { numeric } from '@/types/schemas';

export const importedRecipeSchema = z.object({
  title: z.string(),
  description: z.string().catch(''),
  cuisine: z.string().catch(''),
  prepTimeMinutes: z.coerce.number().int().positive().catch(30),
  cookTimeMinutes: z.coerce.number().int().positive().catch(30),
  servings: z.coerce.number().int().positive().catch(4),
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
  image: z.string().nullable().catch(null),
});

export type ImportedRecipe = z.infer<typeof importedRecipeSchema>;

const importResponseSchema = z.object({ recipe: importedRecipeSchema });

export async function importRecipe(url: string): Promise<ImportedRecipe> {
  const response = await api.post<unknown>(RECIPES_API_ROUTES.import, { url });
  return importResponseSchema.parse(response.data).recipe;
}
