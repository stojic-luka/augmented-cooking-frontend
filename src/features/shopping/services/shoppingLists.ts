import { shoppingDb } from '../lib/shoppingDb';
import {
  shoppingItemCategorySchema,
  shoppingItemSchema,
  shoppingListSchema,
  type ShoppingItem,
  type ShoppingList,
} from '../types';

export async function fetchShoppingLists(_userId: string | null): Promise<ShoppingList[]> {
  const rows = await shoppingDb.shoppingLists.orderBy('created_at').toArray();
  return rows.map((row) => shoppingListSchema.parse(row));
}

export async function createShoppingList(_userId: string | null, name: string): Promise<ShoppingList> {
  const list: ShoppingList = {
    id: crypto.randomUUID(),
    name: name.trim() || 'My shopping list',
    created_at: new Date().toISOString(),
  };
  await shoppingDb.shoppingLists.add(list);
  return list;
}

export async function deleteShoppingList(listId: string, _userId: string | null): Promise<void> {
  await shoppingDb.transaction('rw', shoppingDb.shoppingLists, shoppingDb.shoppingItems, async () => {
    await shoppingDb.shoppingLists.delete(listId);
    await shoppingDb.shoppingItems.where('list_id').equals(listId).delete();
  });
}

export interface ShoppingItemInput {
  name: string;
  quantity: number | string | null;
  unit: string | null;
  category?: string;
  sourceRecipeId?: string | null;
}

export async function addShoppingItems(listId: string, items: ShoppingItemInput[]): Promise<void> {
  if (items.length === 0) return;

  const { guessCategory } = await import('../utils/categories');

  const rows: ShoppingItem[] = items.map((item) => ({
    id: crypto.randomUUID(),
    list_id: listId,
    name: item.name,
    quantity: typeof item.quantity === 'string' ? Number.parseFloat(item.quantity) || null : item.quantity,
    unit: item.unit,
    category: shoppingItemCategorySchema.catch('other').parse(item.category ?? guessCategory(item.name)),
    checked: false,
    source_recipe_id: item.sourceRecipeId ?? null,
    created_at: new Date().toISOString(),
  }));

  await shoppingDb.shoppingItems.bulkAdd(rows);
}

export async function fetchShoppingItems(listId: string): Promise<ShoppingItem[]> {
  const rows = await shoppingDb.shoppingItems.where('list_id').equals(listId).sortBy('created_at');
  return rows.map((row) => shoppingItemSchema.parse(row));
}
