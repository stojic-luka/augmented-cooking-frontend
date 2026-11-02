import { shoppingDb } from '../lib/shoppingDb';
import type { ShoppingItem } from '../types';

export async function updateShoppingItem(
  itemId: string,
  patch: Partial<Pick<ShoppingItem, 'checked' | 'quantity' | 'unit' | 'name'>>,
): Promise<void> {
  await shoppingDb.shoppingItems.update(itemId, patch);
}

export async function deleteShoppingItem(itemId: string): Promise<void> {
  await shoppingDb.shoppingItems.delete(itemId);
}

export async function deleteCheckedItems(listId: string): Promise<void> {
  await shoppingDb.shoppingItems.where('list_id').equals(listId).filter((item) => item.checked).delete();
}
