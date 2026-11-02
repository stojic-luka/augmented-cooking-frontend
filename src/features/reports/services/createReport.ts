import { getSupabaseBrowserClient } from '@lib/supabase';
import type { CreateReportInput } from '../types';

export async function createReport(input: CreateReportInput): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  // The reports table carries exactly one target column (recipe_id XOR
  // review_id, enforced by the reports_one_target check) — not a generic
  // target_type/target_id pair.
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    ...(input.targetType === 'recipe' ? { recipe_id: input.targetId } : { review_id: input.targetId }),
    reason: input.reason.trim(),
  });

  if (error) {
    throw new Error(`Failed to submit report: ${error.message}`);
  }
}
