import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';

const ingredientRowSchema = z.object({ id: z.string(), name: z.string() });

/**
 * Resolves ingredient names to `ingredients` master-list ids, creating missing
 * rows (RLS allows authenticated inserts; the unique name constraint dedupes).
 * Input order is preserved; duplicates collapse to the same id.
 */
export async function ensureIngredientIds(names: string[]): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();

  const normalized = names.map((name) => name.trim().toLowerCase());
  const unique = [...new Set(normalized.filter(Boolean))];
  const idByName = new Map<string, string>();

  if (unique.length > 0) {
    const { data, error } = await supabase.from('ingredients').select('id, name').in('name', unique);
    if (error) {
      throw new Error(`Failed to look up ingredients: ${error.message}`);
    }
    for (const row of data ?? []) {
      const parsed = ingredientRowSchema.parse(row);
      idByName.set(parsed.name, parsed.id);
    }

    const missing = unique.filter((name) => !idByName.has(name));
    if (missing.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('ingredients')
        .insert(missing.map((name) => ({ name })))
        .select('id, name');
      if (insertError) {
        throw new Error(`Failed to register ingredients: ${insertError.message}`);
      }
      for (const row of inserted ?? []) {
        const parsed = ingredientRowSchema.parse(row);
        idByName.set(parsed.name, parsed.id);
      }
    }
  }

  return normalized.map((name) => {
    const id = idByName.get(name);
    if (!id) {
      throw new Error(`Failed to resolve ingredient "${name}".`);
    }
    return id;
  });
}
