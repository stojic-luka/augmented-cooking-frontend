export const shoppingKeys = {
  all: ['shopping'] as const,
  lists: (userId: string) => [...shoppingKeys.all, 'lists', userId] as const,
  list: (listId: string) => [...shoppingKeys.all, 'list', listId] as const,
};
