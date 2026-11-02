import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';

const unitRowSchema = z.object({ code: z.string() });

/** Active unit codes from the `units` reference table (lowercased for matching). */
export async function fetchUnitCodes(): Promise<Set<string>> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase.from('units').select('code').eq('is_active', true);

  if (error) {
    throw new Error(`Failed to fetch units: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => unitRowSchema.parse(row).code.toLowerCase()));
}
