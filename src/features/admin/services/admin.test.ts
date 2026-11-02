import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_BUG_REPORTS_PAGE_SIZE, fetchAdminBugReports, resolveBugReport } from './bug-reports';
import { fetchSystemMetrics } from './metrics';
import { createModel, fetchModels, updateModel } from './models';
import { fetchPlans, updatePlan } from './plans';
import { ADMIN_RECIPES_PAGE_SIZE, adminDeleteRecipe, adminModerateRecipe, fetchAllRecipes } from './recipes';
import { ADMIN_USERS_PAGE_SIZE, fetchAdminUsers, updateUser } from './users';
import { fetchModerationReviews, moderateReview } from '@features/moderator/services/moderation-reviews';
import { fetchPendingRecipes, moderateRecipe } from '@features/moderator/services/moderation-recipes';
import { fetchReportQueue, updateReportStatus } from '@features/moderator/services/moderation-reports';
import { fetchTicketQueue, sendTicketMessage, setTicketStatus } from '@features/moderator/services/moderation-tickets';
import { rpcHandlers } from '@/test/handlers/supabase';
import {
  aiModel,
  dbRecipe,
  IDS,
  profile,
  profileInfo,
  report,
  review,
  subscriptionPlan,
  supportTicket,
  TIMESTAMPS,
} from '@/test/fixtures/db';
import { clearTables, seed, tables } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';

describe('admin services', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('fetchAdminUsers selects the admin column set; email is always null (not exposed)', async () => {
    seed('profiles', [profile({ created_at: TIMESTAMPS.t1 }), profile({ id: IDS.otherUser, created_at: TIMESTAMPS.t2 })]);
    const page = await fetchAdminUsers(null);
    expect(page.data).toHaveLength(2);
    expect(page.data[0]).toMatchObject({ id: IDS.otherUser, email: null });
    expect(page.data[0]).not.toHaveProperty('avatar_url');
    expect(page.hasNextPage).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('fetchAdminUsers walks the whole registry without repeating or skipping rows', async () => {
    const total = ADMIN_USERS_PAGE_SIZE + 2;
    seed(
      'profiles',
      Array.from({ length: total }, (_, index) =>
        profile({
          id: `3333333${(index % 8) + 1}-0000-4000-8000-${String(index).padStart(12, '0')}`,
          created_at: new Date(Date.parse(TIMESTAMPS.t1) + index * 60_000).toISOString(),
        }),
      ),
    );

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await fetchAdminUsers(cursor);
      seen.push(...page.data.map((user) => user.id));
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });

  it('updateUser routes through the admin_update_profile RPC', async () => {
    let rpcArgs: Record<string, unknown> | undefined;
    rpcHandlers['admin_update_profile'] = (args) => {
      rpcArgs = args;
      return undefined;
    };
    await updateUser(IDS.user, { role: 'moderator', subscription_tier: 'premium' });
    expect(rpcArgs).toEqual({
      target_user_id: IDS.user,
      new_role: 'moderator',
      new_subscription_tier: 'premium',
    });
    delete rpcHandlers['admin_update_profile'];
  });

  it('fetchSystemMetrics aggregates counts and breakdowns from four parallel queries', async () => {
    seed('profiles', [
      profile({ created_at: '2026-01-15T10:00:00Z' }),
      profile({ id: IDS.otherUser, created_at: '2026-01-20T10:00:00Z', subscription_tier: 'premium' }),
    ]);
    seed('recipes', [dbRecipe(), dbRecipe({ id: IDS.recipeB })]);
    seed('reviews', [review()]);

    const metrics = await fetchSystemMetrics();
    expect(metrics).toMatchObject({
      totalUsers: 2,
      premiumUsers: 1,
      totalRecipes: 2,
      totalReviews: 1,
      signupsByMonth: [{ label: '2026-01', users: 2 }],
      recipesByCuisine: [{ label: 'Italian', recipes: 2 }],
    });
  });

  it('AI models: fetch all, update by id, create enabled-by-default', async () => {
    seed('ai_models', [aiModel()]);
    expect((await fetchModels()).map((model) => model.name)).toEqual(['flash-mini']);

    await updateModel(IDS.modelEconomy, { is_enabled: false });
    expect(tables.ai_models[0].is_enabled).toBe(false);

    await createModel({ name: '  chef-pro  ', tier: 'advanced', min_tier: 'premium' });
    expect(tables.ai_models[1]).toMatchObject({ name: 'chef-pro', tier: 'advanced', is_enabled: true });
  });

  it('plans: fetch ordered by price, update returns the row', async () => {
    seed('subscription_plans', [
      subscriptionPlan({ price_minor: 2000 }),
      subscriptionPlan({ id: IDS.planPremium, name: 'Premium', price_minor: 0 }),
    ]);
    const plans = await fetchPlans();
    expect(plans.map((plan) => plan.price_minor)).toEqual([0, 2000]);

    const updated = await updatePlan(IDS.planPremium, { description: 'Now cheaper' });
    expect(updated[0].description).toBe('Now cheaper');
  });

  it('admin recipes join the author name and tolerate array-wrapped profile embeds', async () => {
    seed('profiles', [profileInfo()]);
    seed('recipes', [dbRecipe()]);
    const page = await fetchAllRecipes(null);
    expect(page.data[0].author_name).toBe('Cook');
    expect(page.data[0].recipe_steps).toHaveLength(1);
    expect(page.hasNextPage).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('admin recipes map author_name to null for anonymized rows (no user_id)', async () => {
    seed('recipes', [dbRecipe({ user_id: null })]);
    const page = await fetchAllRecipes(null);
    expect(page.data[0].author_name).toBeNull();
  });

  it('fetchAdminRecipes paginates with the keyset seek: page two continues after the cursor', async () => {
    seed(
      'recipes',
      Array.from({ length: ADMIN_RECIPES_PAGE_SIZE + 1 }, (_, index) =>
        dbRecipe({
          id: `ddddddd${(index % 8) + 1}-0000-4000-8000-${String(index).padStart(12, '0')}`,
          created_at: new Date(Date.parse(TIMESTAMPS.t1) + index * 60_000).toISOString(),
        }),
      ),
    );

    const first = await fetchAllRecipes(null);
    expect(first.data).toHaveLength(ADMIN_RECIPES_PAGE_SIZE);
    expect(first.hasNextPage).toBe(true);
    expect(first.nextCursor).not.toBeNull();

    const second = await fetchAllRecipes(first.nextCursor);
    expect(second.data).toHaveLength(1);
    expect(second.hasNextPage).toBe(false);
    expect(second.nextCursor).toBeNull();
  });

  it('fetchAdminRecipes walks the whole registry without repeating or skipping rows', async () => {
    const total = ADMIN_RECIPES_PAGE_SIZE * 2 + 3;
    seed(
      'recipes',
      Array.from({ length: total }, (_, index) =>
        dbRecipe({
          id: `ddddddd${(index % 8) + 1}-0000-4000-8000-${String(index).padStart(12, '0')}`,
          created_at: new Date(Date.parse(TIMESTAMPS.t1) + index * 60_000).toISOString(),
        }),
      ),
    );

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await fetchAllRecipes(cursor);
      seen.push(...page.data.map((recipe) => recipe.id));
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });

  it('adminDeleteRecipe removes the row; adminModerateRecipe goes through the RPC', async () => {
    seed('recipes', [dbRecipe()]);
    let rpcArgs: Record<string, unknown> | undefined;
    rpcHandlers['set_recipe_moderation'] = (args) => {
      rpcArgs = args;
      return undefined;
    };

    await adminDeleteRecipe(IDS.recipeA);
    expect(tables.recipes).toHaveLength(0);

    await adminModerateRecipe(IDS.recipeA, 'flagged');
    expect(rpcArgs).toEqual({ p_recipe: IDS.recipeA, p_status: 'flagged' });
    delete rpcHandlers['set_recipe_moderation'];
  });

  it('bug reports: fetch the bug category and resolve by id', async () => {
    seed('support_tickets', [
      supportTicket({ category: 'bug' }),
      supportTicket({ id: 'cdcdcdc2-0000-4000-8000-000000000002', category: 'billing' }),
    ]);
    const page = await fetchAdminBugReports(null);
    expect(page.data.map((ticket) => ticket.id)).toEqual([IDS.ticketLogin]);

    await resolveBugReport(IDS.ticketLogin);
    expect(tables.support_tickets[0].status).toBe('resolved');
  });

  it('fetchAdminBugReports walks the whole inbox without repeating or skipping rows', async () => {
    const total = ADMIN_BUG_REPORTS_PAGE_SIZE + 1;
    // All rows share one created_at — the walk only stays exact through the
    // unique id tie-breaker in the keyset seek.
    seed(
      'support_tickets',
      Array.from({ length: total }, (_, index) =>
        supportTicket({
          id: `cdcdcdc${(index % 8) + 1}-0000-4000-8000-${String(index).padStart(12, '0')}`,
          category: 'bug',
        }),
      ),
    );

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await fetchAdminBugReports(cursor);
      seen.push(...page.data.map((ticket) => ticket.id));
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });
});

describe('moderator services', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('fetchPendingRecipes returns pending and flagged with the author name', async () => {
    seed('profiles', [profileInfo({ id: IDS.user })]);
    seed('recipes', [
      dbRecipe({ moderation_status: 'pending' }),
      dbRecipe({ id: IDS.recipeB, moderation_status: 'approved' }),
    ]);
    const queue = await fetchPendingRecipes();
    expect(queue.map((recipe) => recipe.id)).toEqual([IDS.recipeA]);
    expect(queue[0].author_name).toBe('Cook');
  });

  it('moderateRecipe maps decisions to statuses via the RPC', async () => {
    const calls: unknown[] = [];
    rpcHandlers['set_recipe_moderation'] = (args) => {
      calls.push(args);
      return undefined;
    };
    await moderateRecipe(IDS.recipeA, 'reject');
    expect(calls).toEqual([{ p_recipe: IDS.recipeA, p_status: 'rejected' }]);
    delete rpcHandlers['set_recipe_moderation'];
  });

  it('fetchReportQueue discriminates recipe vs review targets', async () => {
    seed('reports', [
      report({ recipe_id: IDS.recipeA, review_id: null }),
      report({ id: 'fbfbfbf2-0000-4000-8000-000000000002', recipe_id: null, review_id: IDS.reviewGreat }),
    ]);
    seed('recipes', [dbRecipe()]);
    seed('reviews', [review()]);

    const queue = await fetchReportQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({ target_type: 'recipe', recipe: { title: 'Tomato Rice' } });
    expect(queue[1]).toMatchObject({ target_type: 'review', review: { comment: review().comment } });
  });

  it('fetchReportQueue fails loudly on a targetless report (reports_one_target violated)', async () => {
    seed('reports', [report({ recipe_id: null, review_id: null })]);
    await expect(fetchReportQueue()).rejects.toThrow(/no target/);
  });

  it('updateReportStatus patches only the status', async () => {
    seed('reports', [report()]);
    await updateReportStatus(IDS.reportRecipe, 'dismissed');
    expect(tables.reports[0].status).toBe('dismissed');
  });

  it('moderation reviews join author + recipe title and update status directly', async () => {
    seed('profiles', [profileInfo({ id: IDS.user })]);
    seed('recipes', [dbRecipe()]);
    seed('reviews', [review({ moderation_status: 'pending' })]);

    const queue = await fetchModerationReviews();
    expect(queue[0]).toMatchObject({ author_name: 'Cook', recipe_title: 'Tomato Rice' });

    await moderateReview(IDS.reviewGreat, 'approved');
    expect(tables.reviews[0].moderation_status).toBe('approved');
  });

  it('ticket queue carries the requester display name; messages and status round-trip', async () => {
    seed('profiles', [profileInfo({ id: IDS.user })]);
    seed('support_tickets', [supportTicket()]);

    const queue = await fetchTicketQueue();
    expect(queue[0].requester_display_name).toBe('Cook');

    const message = await sendTicketMessage(IDS.ticketLogin, IDS.moderator, '  Looking into it.  ');
    expect(message).toMatchObject({ sender_role: 'moderator', body: 'Looking into it.' });

    let rpcArgs: Record<string, unknown> | undefined;
    rpcHandlers['update_support_ticket'] = (args) => {
      rpcArgs = args;
      return undefined;
    };
    await setTicketStatus(IDS.ticketLogin, 'resolved');
    expect(rpcArgs).toEqual({ p_ticket: IDS.ticketLogin, p_status: 'resolved' });
    delete rpcHandlers['update_support_ticket'];
  });
});
