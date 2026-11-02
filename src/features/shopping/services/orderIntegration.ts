import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { api } from '@/api';
import { SHOPPING_API_ROUTES } from '../api';
import type { PublicOrderStatus } from '@/types/schemas';

const orderResponseSchema = z.object({
  orderId: z.string(),
  status: z.string(),
});

export interface OrderItemInput {
  name: string;
  quantity: number | null;
  unit: string | null;
}

/**
 * Grocery-partner ordering. The order payload goes browser → provider
 * directly; only receipt metadata is recorded in `order_receipts` — no item
 * data, ever.
 */
export async function orderIngredients(
  userId: string,
  items: OrderItemInput[],
): Promise<{ orderId: string; status: string }> {
  const response = await api.post<unknown>(SHOPPING_API_ROUTES.orders, { items });
  const { orderId, status } = orderResponseSchema.parse(response.data);

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from('order_receipts').insert({
    user_id: userId,
    provider: 'partner-grocery-api',
    external_order_id: orderId,
    status: orderStatusSchema.catch('placed').parse(status),
    total_minor: null,
  });
  if (error) {
    throw new Error(`Failed to record order receipt: ${error.message}`);
  }

  return { orderId, status };
}

const orderStatusSchema = z.enum(['draft', 'placed', 'confirmed', 'delivered', 'canceled']) as z.ZodType<PublicOrderStatus>;
