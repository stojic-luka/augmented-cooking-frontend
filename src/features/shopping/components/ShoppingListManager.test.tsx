import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShoppingListManager } from './ShoppingListManager';
import { chatDb } from '@features/ai/lib/chatDb';
import { planDb } from '@features/planner/lib/planDb';
import { shoppingDb } from '../lib/shoppingDb';
import { IDS } from '@/test/fixtures/db';
import { clearTables, seed, tables } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';
import { server } from '@/test/server';

/**
 * The shopping flow end-to-end: local (Dexie) list + item CRUD, check-off,
 * and ordering the list through the partner endpoint plus the Supabase
 * receipt write — via real hooks, MSW, and fake IndexedDB.
 */
function renderShopping() {
  return renderRoutes([{ path: '/shopping-list', component: () => <ShoppingListManager /> }], '/shopping-list');
}

async function clearLocalDatabases() {
  await Promise.all([
    shoppingDb.shoppingLists.clear(),
    shoppingDb.shoppingItems.clear(),
    planDb.mealPlanEntries.clear(),
    chatDb.sessions.clear(),
    chatDb.messages.clear(),
  ]);
}

describe('ShoppingListManager', () => {
  beforeEach(async () => {
    seedSession();
    clearTables();
    seed('order_receipts', []);
    await clearLocalDatabases();
  });

  it('shows the empty state and creates the first list from it', async () => {
    const user = userEvent.setup();
    renderShopping();

    await user.click(await screen.findByRole('button', { name: 'Create a list' }, { timeout: 5000 }));

    expect(await screen.findByText('This list is empty', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Shopping list' })).toHaveValue('My shopping list');
  });

  it('adds an item through the modal and groups it under its category', async () => {
    const user = userEvent.setup();
    renderShopping();

    await user.click(await screen.findByRole('button', { name: 'Create a list' }, { timeout: 5000 }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }, { timeout: 5000 }));

    await user.type(await screen.findByLabelText('Item', {}, { timeout: 5000 }), 'Whole milk');
    await user.type(screen.getByLabelText('Quantity'), '2');
    await user.type(screen.getByLabelText('Unit'), 'l');
    await user.click(screen.getByRole('button', { name: 'Add to list' }));

    expect(await screen.findByText('Whole milk', {}, { timeout: 5000 })).toBeInTheDocument();
    // The modal sends its explicitly selected category (default "other").
    expect(
      await screen.findByText((_, element) => element?.textContent === 'Other · 1 to buy', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('checks items off, clears them, and deletes the list', async () => {
    const user = userEvent.setup();
    renderShopping();

    await user.click(await screen.findByRole('button', { name: 'Create a list' }, { timeout: 5000 }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }, { timeout: 5000 }));
    await user.type(await screen.findByLabelText('Item', {}, { timeout: 5000 }), 'Rice');
    await user.click(screen.getByRole('button', { name: 'Add to list' }));

    const checkbox = await screen.findByRole('checkbox', { name: 'Mark Rice' }, { timeout: 5000 });
    await user.click(checkbox);
    await waitFor(() => expect(screen.getByText('Other · 0 to buy')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Clear checked items' }));
    await waitFor(() => expect(screen.getByText('This list is empty')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete this list' }));
    expect(await screen.findByText('No shopping lists yet')).toBeInTheDocument();
  });

  it('orders the unchecked items through the partner API and records the receipt', async () => {
    const user = userEvent.setup();
    let orderBody: Record<string, unknown> | undefined;
    server.use(
      http.post('*/orders', async ({ request }) => {
        orderBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ orderId: 'ord_123', status: 'placed' });
      }),
    );
    renderShopping();

    await user.click(await screen.findByRole('button', { name: 'Create a list' }, { timeout: 5000 }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }, { timeout: 5000 }));
    await user.type(await screen.findByLabelText('Item', {}, { timeout: 5000 }), 'Rice');
    await user.click(screen.getByRole('button', { name: 'Add to list' }));
    await screen.findByText('Rice', {}, { timeout: 5000 });

    await user.click(screen.getByRole('button', { name: 'Order ingredients' }));

    await waitFor(
      () => expect(within(document.body).getAllByText(/Order ord_123 is placed/).length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    expect(orderBody).toEqual({ items: [{ name: 'Rice', quantity: null, unit: null }] });
    await waitFor(() => expect(tables.order_receipts).toHaveLength(1));
    expect(tables.order_receipts[0]).toMatchObject({
      user_id: IDS.user,
      external_order_id: 'ord_123',
      status: 'placed',
    });
  });

  it('shows an order failure notification when the partner API is down', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/orders', () => HttpResponse.json({ message: 'Partner unavailable' }, { status: 503 })));
    renderShopping();

    await user.click(await screen.findByRole('button', { name: 'Create a list' }, { timeout: 5000 }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }, { timeout: 5000 }));
    await user.type(await screen.findByLabelText('Item', {}, { timeout: 5000 }), 'Rice');
    await user.click(screen.getByRole('button', { name: 'Add to list' }));
    await screen.findByText('Rice', {}, { timeout: 5000 });

    await user.click(screen.getByRole('button', { name: 'Order ingredients' }));

    // The mutation surfaces the failure (backend `{ message }` included) and
    // no receipt is recorded.
    await waitFor(
      () => expect(within(document.body).getAllByText('Partner unavailable').length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    expect(tables.order_receipts).toHaveLength(0);
  });
});
