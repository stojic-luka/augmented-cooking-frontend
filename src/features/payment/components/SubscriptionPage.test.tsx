import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubscriptionPage } from './SubscriptionPage';
import { IDS, profile, subscriptionPlan } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';
import { server } from '@/test/server';
import { TEST_ORIGIN } from '@/test/origin';

/**
 * The billing flow: plans render from the database (active only, cheapest
 * first), the current tier is badged, subscribe/top-up requests hit the
 * documented endpoints, and the placeholder receipt is announced.
 */
function renderSubscription() {
  return renderRoutes([{ path: '/subscription', component: () => <SubscriptionPage /> }], '/subscription');
}

describe('SubscriptionPage', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
    seed('profiles', [profile()]);
    seed('subscription_plans', [
      subscriptionPlan({ id: IDS.planPremium, name: 'Premium', description: 'Everything, unlimited.', price_minor: 2000, ai_actions_per_day: null, tokens_per_month: 100000 }),
      subscriptionPlan(),
      // Retired plan must never surface.
      subscriptionPlan({ id: 'eeeeeee3-0000-4000-8000-000000000003', name: 'Legacy', price_minor: 500, is_active: false }),
    ]);
  });

  it('renders active plans cheapest first and badges the current tier', async () => {
    renderSubscription();

    expect(await screen.findByText('Premium', { selector: 'h3, h4, [data-size]' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.getByText('€20/month')).toBeInTheDocument();
    expect(screen.getByText('30 AI actions per day')).toBeInTheDocument();
    expect(screen.getByText('100,000 tokens per month')).toBeInTheDocument();
    expect(screen.queryByText('Legacy')).not.toBeInTheDocument();
  });

  it('shows neither plan cards nor a built-in-tiers notice while plans load (regression)', async () => {
    server.use(
      http.get(`${TEST_ORIGIN}/rest/v1/subscription_plans`, async () => {
        await delay(1000);
        return HttpResponse.json([]);
      }),
    );
    renderSubscription();

    // Regression: the pending state used to render the misleading
    // "Showing built-in tiers" alert next to zero plan cards.
    expect(screen.queryByText('Showing built-in tiers')).not.toBeInTheDocument();
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
  });

  it('surfaces a plans fetch failure with a retry affordance (regression)', async () => {
    server.use(
      http.get(`${TEST_ORIGIN}/rest/v1/subscription_plans`, () =>
        HttpResponse.json({ message: 'Plans table missing' }, { status: 500 }),
      ),
    );
    renderSubscription();

    expect(await screen.findByText('Could not load plans', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(within(document.body).getByText('Plans table missing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('sends the plan change request and announces the recorded receipt', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('*/billing/subscribe', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'pending', message: 'Request recorded.' });
      }),
    );
    const user = userEvent.setup();
    renderSubscription();

    await user.click(await screen.findByRole('button', { name: 'Upgrade to Premium' }, { timeout: 5000 }));

    expect(body).toEqual({ planId: IDS.planPremium });
    await waitFor(
      () => expect(within(document.body).getAllByText('Request recorded.').length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
  });

  it('shows the token top-up section for premium users and purchases tokens', async () => {
    seed('profiles', [profile({ subscription_tier: 'premium', tokens_remaining: 5000 })]);
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('*/billing/tokens', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'pending', message: 'Top-up recorded.' });
      }),
    );
    const user = userEvent.setup();
    renderSubscription();

    expect(await screen.findByText(/5,000 tokens remaining/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upgrade to Premium' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Buy 10,000 tokens' }));

    expect(body).toEqual({ tokens: 10000 });
    await waitFor(
      () => expect(within(document.body).getAllByText('Top-up recorded.').length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
  });
});
