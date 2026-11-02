import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';

export const cuisineSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type CuisineOption = z.infer<typeof cuisineSchema>;

export async function fetchCuisines(): Promise<CuisineOption[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase.from('cuisines').select('id, name').eq('is_active', true).order('name');

  if (error) {
    throw new Error(`Failed to fetch cuisines: ${error.message}`);
  }

  return (data ?? []).map((row) => cuisineSchema.parse(row));
}

/** Resolves a cuisine display name to its id (case-insensitive); null when unknown. */
export function resolveCuisineId(name: string, cuisines: CuisineOption[]): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return cuisines.find((cuisine) => cuisine.name.toLowerCase() === normalized)?.id ?? null;
}
