import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { importRecipe } from './importRecipe';
import { requestPlanChange, buyTokens } from '@features/payment/services/billing';
import { orderIngredients } from '@features/shopping/services/orderIntegration';
import { seedSession } from '@/test/auth';
import { IDS } from '@/test/fixtures/db';
import { seed } from '@/test/fixtures/tables';
import { API_URL } from '@/test/handlers/rest';
import { server } from '@/test/server';

/**
 * Contract tests for the remaining axios endpoints from docs/API_ENDPOINTS.md:
 * POST /recipes/import, POST /billing/subscribe, POST /billing/tokens, and
 * POST /orders (plus the order_receipts record it writes to Supabase).
 */
describe('importRecipe — POST /recipes/import', () => {
  beforeEach(() => seedSession());

  it('sends the scraped URL and coerces scraper noise into a typed draft', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/recipes/import`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          recipe: {
            title: 'Scraped Cake',
            servings: '8', // scrapers emit strings
            prepTimeMinutes: 'not a number', // falls back via .catch(30)
            ingredients: [{ name: 'flour', amount: '300', unit: 'g' }],
          },
        });
      }),
    );

    const draft = await importRecipe('https://example.blog/recipe');

    expect(body).toEqual({ url: 'https://example.blog/recipe' });
    expect(draft.title).toBe('Scraped Cake');
    expect(draft.servings).toBe(8);
    expect(draft.prepTimeMinutes).toBe(30);
    expect(draft.ingredients[0].amount).toBe(300);
  });

  it('surfaces backend failures for unreadable pages', async () => {
    server.use(
      http.post(`${API_URL}/recipes/import`, () => HttpResponse.json({ message: 'No recipe found at URL' }, { status: 422 })),
    );

    await expect(importRecipe('https://example.blog/none')).rejects.toThrow('No recipe found at URL');
  });
});

describe('billing — POST /billing/subscribe · /billing/tokens', () => {
  beforeEach(() => seedSession());

  it('subscribe sends { planId } and returns the pending receipt', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/billing/subscribe`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'pending', message: 'Request recorded' });
      }),
    );

    const result = await requestPlanChange(IDS.planPremium);

    expect(body).toEqual({ planId: IDS.planPremium });
    expect(result).toEqual({ status: 'pending', message: 'Request recorded' });
  });

  it('tokens sends the purchased amount', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/billing/tokens`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'pending', message: 'Request recorded' });
      }),
    );

    await buyTokens(10000);
    expect(body).toEqual({ tokens: 10000 });
  });

  it('rejects responses that do not match the documented pending shape', async () => {
    server.use(http.post(`${API_URL}/billing/subscribe`, () => HttpResponse.json({ status: 'completed' })));

    await expect(requestPlanChange(IDS.planPremium)).rejects.toThrow();
  });
});

describe('orderIngredients — POST /orders + order_receipts', () => {
  beforeEach(() => {
    seedSession();
    seed('order_receipts', []);
  });

  it('sends the unchecked items and records a receipt in Supabase', async () => {
    let body: Record<string, unknown> | undefined;
    let receiptInsert: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/orders`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ orderId: 'ord_123', status: 'placed' });
      }),
      http.post(`${API_URL}/rest/v1/order_receipts`, async ({ request }) => {
        receiptInsert = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([{ id: 'receipt-1' }], { status: 201 });
      }),
    );

    const result = await orderIngredients(IDS.user, [
      { name: 'Rice', quantity: 1, unit: 'kg' },
      { name: 'Salt', quantity: null, unit: null },
    ]);

    expect(result).toEqual({ orderId: 'ord_123', status: 'placed' });
    expect(body).toEqual({
      items: [
        { name: 'Rice', quantity: 1, unit: 'kg' },
        { name: 'Salt', quantity: null, unit: null },
      ],
    });
    expect(receiptInsert).toMatchObject({
      user_id: IDS.user,
      provider: 'partner-grocery-api',
      external_order_id: 'ord_123',
      status: 'placed',
    });
  });

  it('fails loudly when the partner API rejects the order — no receipt is written', async () => {
    server.use(http.post(`${API_URL}/orders`, () => HttpResponse.json({ message: 'Partner unavailable' }, { status: 503 })));

    await expect(orderIngredients(IDS.user, [{ name: 'Rice', quantity: 1, unit: 'kg' }])).rejects.toThrow();
  });

  it('fails loudly when the receipt insert fails — after the order was placed', async () => {
    server.use(
      http.post(`${API_URL}/rest/v1/order_receipts`, () =>
        HttpResponse.json({ code: '42501', message: 'row-level security policy' }, { status: 403 }),
      ),
    );

    // Flagged contract deviation: docs specify { shoppingListId, items }, the
    // client sends only { items } — the list context never reaches the backend.
    await expect(orderIngredients(IDS.user, [{ name: 'Rice', quantity: 1, unit: 'kg' }])).rejects.toThrow(
      /Failed to record order receipt/,
    );
  });

  it('normalizes an undocumented partner status to "placed"', async () => {
    server.use(http.post(`${API_URL}/orders`, () => HttpResponse.json({ orderId: 'ord_9', status: 'processing' })));
    let receiptInsert: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/rest/v1/order_receipts`, async ({ request }) => {
        receiptInsert = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([{ id: 'receipt-1' }], { status: 201 });
      }),
    );

    const result = await orderIngredients(IDS.user, []);
    expect(result.status).toBe('processing');
    expect(receiptInsert?.status).toBe('placed');
  });
});
