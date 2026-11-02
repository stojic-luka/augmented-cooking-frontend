import { z } from 'zod';
import { numeric } from '@/types/schemas';

export const shoppingItemCategorySchema = z.enum([
  'produce',
  'dairy',
  'meat',
  'seafood',
  'grains',
  'pantry',
  'spices',
  'frozen',
  'bakery',
  'beverages',
  'other',
]);

export type ShoppingItemCategory = z.infer<typeof shoppingItemCategorySchema>;

/** Local-only (Dexie) list; recipes links live on items. */
export const shoppingListSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
});

export type ShoppingList = z.infer<typeof shoppingListSchema>;

/** Local-only (Dexie) item; list_id references the local list. */
export const shoppingItemSchema = z.object({
  id: z.string(),
  list_id: z.string(),
  name: z.string(),
  quantity: numeric.nullable().catch(null),
  unit: z.string().nullable().catch(null),
  category: shoppingItemCategorySchema.catch('other'),
  checked: z.boolean().catch(false),
  source_recipe_id: z.string().nullable().catch(null),
  created_at: z.string(),
});

export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const addItemSchema = z.object({
  name: z.string().min(1, { error: 'Item name is required' }),
  quantity: z.string().optional(),
  unit: z.string().optional(),
});
