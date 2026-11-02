import Dexie, { type EntityTable } from 'dexie';
import type { ShoppingList, ShoppingItem } from '../types';

/**
 * Shopping lists are local-first (IndexedDB via Dexie) — the database no
 * longer stores them. Cross-browser sync happens through the PIN-encrypted
 * backup blob, not live tables.
 */
export const shoppingDb = new Dexie('augmented-cooking-shopping') as Dexie & {
  shoppingLists: EntityTable<ShoppingList, 'id'>;
  shoppingItems: EntityTable<ShoppingItem, 'id'>;
};

shoppingDb.version(1).stores({
  shoppingLists: 'id, created_at',
  shoppingItems: 'id, list_id, checked, created_at',
});
