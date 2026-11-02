import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { api } from '@/api';
import { PAYMENT_API_ROUTES } from '../api';
import { publicSubscriptionPlansRowSchema } from '@/types/schemas';
import type { PublicSubscriptionPlansRow } from '@/types/schemas';

/**
 * Subscription plans — reference table, soft-deleted via is_active.
 * Retired plans are filtered out so they can never be surfaced to users.
 */
export async function fetchSubscriptionPlans(): Promise<PublicSubscriptionPlansRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('price_minor');

  if (error) {
    throw new Error(error.message);
  }

  // Supabase returns numeric as string by default; the generated schema
  // handles the coercion. Parse each row defensively.
  return data.map((row) => publicSubscriptionPlansRowSchema.parse(row));
}

const billingResponseSchema = z.object({
  status: z.literal('pending'),
  message: z.string(),
});

export type BillingResponse = z.infer<typeof billingResponseSchema>;

export async function requestPlanChange(planId: string): Promise<BillingResponse> {
  const response = await api.post<unknown>(PAYMENT_API_ROUTES.subscribe, { planId });
  return billingResponseSchema.parse(response.data);
}

export async function buyTokens(tokens: number): Promise<BillingResponse> {
  const response = await api.post<unknown>(PAYMENT_API_ROUTES.tokens, { tokens });
  return billingResponseSchema.parse(response.data);
}
