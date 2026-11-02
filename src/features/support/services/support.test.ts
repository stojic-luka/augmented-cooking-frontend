import { beforeEach, describe, expect, it } from 'vitest';
import { addTicketMessage, createBugReport, createTicket, fetchMyTickets, fetchTicketMessages } from './supportTickets';
import { fetchRecipeReviews } from '@features/reviews/services/fetchRecipeReviews';
import { fetchRecipeRatings } from '@features/reviews/services/fetchRecipeRatings';
import { createReview, deleteReview, updateReview } from '@features/reviews/services/writeReview';
import {
  addRecipeToCollection,
  removeRecipeFromCollection,
} from '@features/collections/services/collection-recipes';
import { createCollection, deleteCollection, fetchCollection, fetchCollections, updateCollection } from '@features/collections/services/collections';
import { collection, dbRecipe, IDS, profile, review, supportTicket, ticketMessage, TIMESTAMPS } from '@/test/fixtures/db';
import { clearTables, seed, tables } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import type { NewTicketFormValues } from '../types';

const ticketInput: NewTicketFormValues = {
  subject: '  Broken print layout  ',
  category: 'bug',
  severity: 'medium',
  description: '  Printing cuts off steps.  ',
};

describe('support services', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('createTicket trims input and returns the persisted row', async () => {
    const created = await createTicket(IDS.user, ticketInput);
    expect(created.subject).toBe('Broken print layout');
    expect(created.description).toBe('Printing cuts off steps.');
    expect(tables.support_tickets[0]).toMatchObject({ user_id: IDS.user, category: 'bug', status: 'open' });
  });

  it('fetchMyTickets scopes to the user, newest first', async () => {
    seed('support_tickets', [
      supportTicket({ created_at: TIMESTAMPS.t1, updated_at: TIMESTAMPS.t1 }),
      supportTicket({ id: 'cdcdcdc2-0000-4000-8000-000000000002', user_id: IDS.otherUser, created_at: TIMESTAMPS.t2, updated_at: TIMESTAMPS.t2 }),
    ]);
    const tickets = await fetchMyTickets(IDS.user);
    expect(tickets.map((ticket) => ticket.id)).toEqual([IDS.ticketLogin]);
  });

  it('ticket messages round-trip in chronological order', async () => {
    seed('support_ticket_messages', [
      ticketMessage({ created_at: TIMESTAMPS.t2 }),
      ticketMessage({ id: 'edededed-0000-4000-8000-000000000002', created_at: TIMESTAMPS.t1 }),
    ]);
    const messages = await fetchTicketMessages(IDS.ticketLogin);
    expect(messages.map((message) => message.created_at)).toEqual([TIMESTAMPS.t1, TIMESTAMPS.t2]);

    const added = await addTicketMessage(IDS.ticketLogin, IDS.user, '  Still broken.  ');
    expect(added.body).toBe('Still broken.');
    expect(added.sender_role).toBe('user');
  });

  it('createBugReport files a bug-category ticket (no separate bug_reports table)', async () => {
    await createBugReport(IDS.user, { title: 'Crash', description: 'On save', severity: 'high' });
    expect(tables.support_tickets[0]).toMatchObject({
      user_id: IDS.user,
      subject: 'Crash',
      description: 'On save',
      category: 'bug',
      severity: 'high',
      status: 'open',
    });
  });
});

describe('reviews services', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('fetchRecipeReviews flattens the author embed and filters rejected', async () => {
    seed('profiles', [profile()]);
    seed('reviews', [
      review({ moderation_status: 'approved' }),
      review({ id: 'efefefe2-0000-4000-8000-000000000002', moderation_status: 'rejected' }),
    ]);
    const reviews = await fetchRecipeReviews(IDS.recipeA);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ author_name: 'Cook', author_avatar: null });
    expect((reviews[0] as Record<string, unknown>).public_profile_info).toBeUndefined();
  });

  it('fetchRecipeRatings builds a per-recipe map including zero-review recipes', async () => {
    seed('recipes', [
      dbRecipe({ id: IDS.recipeA, rating_avg: 4.5, review_count: 2 }),
      dbRecipe({ id: IDS.recipeB, rating_avg: 0, review_count: 0 }),
    ]);
    const ratings = await fetchRecipeRatings([IDS.recipeA, IDS.recipeB, IDS.recipeC]);
    expect(ratings.get(IDS.recipeA)).toEqual({ average: 4.5, count: 2 });
    expect(ratings.get(IDS.recipeB)).toEqual({ average: 0, count: 0 });
    expect(ratings.get(IDS.recipeC)).toBeUndefined();
    expect((await fetchRecipeRatings([])).size).toBe(0);
  });

  it('createReview trims and persists; updateReview patches owner rows; deleteReview removes them', async () => {
    const created = await createReview({ recipeId: IDS.recipeA, userId: IDS.user, rating: 4, comment: '  Solid.  ' });
    expect(created.comment).toBe('Solid.');
    expect(created.moderation_status).toBe('pending');

    await updateReview(created.id, IDS.user, { rating: 5, comment: 'Even better tomorrow.' });
    expect(tables.reviews[0]).toMatchObject({ rating: 5, comment: 'Even better tomorrow.' });

    await deleteReview(created.id, IDS.user);
    expect(tables.reviews).toHaveLength(0);
  });
});

describe('collections services', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('createCollection persists trimmed values; fetchCollections scopes to the owner', async () => {
    seed('collections', [collection({ id: 'abababa2-0000-4000-8000-000000000002', user_id: IDS.otherUser })]);

    const created = await createCollection(IDS.user, { name: '  Weeknights  ', description: '', isPublic: false });
    expect(created.name).toBe('Weeknights');
    expect(created.description).toBe('');

    const mine = await fetchCollections(IDS.user);
    expect(mine.map((row) => row.id)).toEqual([created.id]);
  });

  it('fetchCollection joins recipes through the join table and skips RLS-hidden rows', async () => {
    seed('collections', [collection()]);
    seed('collection_recipes', [
      { collection_id: IDS.collectionWeek, recipe_id: IDS.recipeA },
      { collection_id: IDS.collectionWeek, recipe_id: 'hidden-recipe' },
    ]);
    seed('recipes', [dbRecipe()]);

    const detail = await fetchCollection(IDS.collectionWeek);
    expect(detail.name).toBe('Weeknight dinners');
    expect(detail.recipes.map((recipe) => recipe.id)).toEqual([IDS.recipeA]);
  });

  it('fetchCollection rejects when the collection does not exist', async () => {
    await expect(fetchCollection('nope')).rejects.toThrow('Collection not found.');
  });

  it('updateCollection and deleteCollection scope to the owner', async () => {
    seed('collections', [collection()]);
    await updateCollection(IDS.collectionWeek, IDS.user, { name: 'Renamed', description: 'New desc', isPublic: true });
    expect(tables.collections[0]).toMatchObject({ name: 'Renamed', is_public: true });

    await deleteCollection(IDS.collectionWeek, IDS.user);
    expect(tables.collections).toHaveLength(0);
  });

  it('addRecipeToCollection is idempotent; removeRecipeFromCollection deletes only the pair', async () => {
    seed('collection_recipes', []);
    await addRecipeToCollection(IDS.collectionWeek, IDS.recipeA);
    await addRecipeToCollection(IDS.collectionWeek, IDS.recipeA); // ignoreDuplicates
    expect(tables.collection_recipes).toHaveLength(1);

    await addRecipeToCollection(IDS.collectionWeek, IDS.recipeB);
    await removeRecipeFromCollection(IDS.collectionWeek, IDS.recipeA);
    expect(tables.collection_recipes.map((row) => row.recipe_id)).toEqual([IDS.recipeB]);
  });
});
