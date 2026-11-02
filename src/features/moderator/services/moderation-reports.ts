import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import {
  publicReportsRowSchema,
  publicReportsUpdateSchema,
  publicRecipesRowSchema,
  publicReviewsRowSchema,
} from '@/types/schemas';
import type { PublicReportStatus } from '@/types/schemas';

const recipeTargetSchema = publicRecipesRowSchema.pick({ title: true });
const reviewTargetSchema = publicReviewsRowSchema.pick({ comment: true });

export const recipeReportSchema = publicReportsRowSchema.extend({
  target_type: z.literal('recipe'),
  recipe: recipeTargetSchema.nullable(),
});
export type RecipeReport = z.infer<typeof recipeReportSchema>;

export const reviewReportSchema = publicReportsRowSchema.extend({
  target_type: z.literal('review'),
  review: reviewTargetSchema.nullable(),
});
export type ReviewReport = z.infer<typeof reviewReportSchema>;

export type ModReport = RecipeReport | ReviewReport;

export async function fetchReportQueue(): Promise<ModReport[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('reports')
    .select('*, recipe:recipes(title), review:reviews(comment)')
    .in('status', ['open', 'reviewed'])
    .order('created_at', { ascending: true }); // oldest first

  if (error) {
    throw new Error(`Failed to fetch reports: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const report = publicReportsRowSchema.parse(row);

    if (report.recipe_id !== null) {
      return {
        ...report,
        target_type: 'recipe',
        recipe_id: report.recipe_id,
        recipe: row.recipe ? recipeTargetSchema.parse(row.recipe) : null,
      } satisfies RecipeReport;
    }

    if (report.review_id !== null) {
      return {
        ...report,
        target_type: 'review',
        review_id: report.review_id,
        review: row.review ? reviewTargetSchema.parse(row.review) : null,
      } satisfies ReviewReport;
    }

    throw new Error(`Report ${report.id} has no target (reports_one_target violated)`);
  });
}

/**
 * Set a report's status. Only staff can UPDATE reports (RLS) — this runs in a
 * moderator context. `actioned` = content moderated, `dismissed` = no action
 * warranted; `reviewed` marks it seen without a decision.
 */
export async function updateReportStatus(reportId: string, status: Exclude<PublicReportStatus, 'open'>): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const payload = publicReportsUpdateSchema.pick({ status: true }).parse({ status });

  const { error } = await supabase.from('reports').update(payload).eq('id', reportId);
  if (error) {
    throw new Error(`Failed to update report status: ${error.message}`);
  }
}
