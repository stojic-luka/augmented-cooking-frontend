import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { publicSubscriptionPlansRowSchema as subscriptionPlansRowSchema } from '@/types/schemas';
import type {
  PublicSubscriptionPlansRow as SubscriptionPlansRow,
  PublicSubscriptionPlansUpdate as SubscriptionPlansUpdate,
} from '@/types/schemas';

export async function fetchPlans(): Promise<SubscriptionPlansRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from('subscription_plans').select('*').order('price_minor', { ascending: true });

  if (error) throw error;

  return subscriptionPlansRowSchema.array().parse(data);
}

export async function updatePlan(
  planId: SubscriptionPlansRow['id'],
  patch: SubscriptionPlansUpdate,
): Promise<SubscriptionPlansRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from('subscription_plans').update(patch).eq('id', planId).select();

  if (error) throw error;

  console.log(data);
  console.log(error);

  return subscriptionPlansRowSchema.array().parse(data);
}
