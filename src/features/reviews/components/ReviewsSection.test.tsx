import { describe, beforeEach, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewsSection } from './ReviewsSection';
import { IDS, TIMESTAMPS, profile, review } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';

/**
 * Threaded reviews: replies of any depth render, the header counts top-level
 * reviews only, and editing someone's review never touches the create form's
 * in-progress draft.
 */
const REPLY = 'efefefe1-0000-4000-8000-000000000002';
const REPLY_TO_REPLY = 'efefefe1-0000-4000-8000-000000000003';

function seedThread() {
  seed('profiles', [profile(), profile({ id: IDS.otherUser, display_name: 'Other cook' })]);
  seed('reviews', [
    review({
      id: IDS.reviewGreat,
      user_id: IDS.otherUser,
      rating: 5,
      comment: 'Great recipe!',
      parent_review_id: null,
      moderation_status: 'approved',
      created_at: TIMESTAMPS.t0,
    }),
    review({
      id: REPLY,
      user_id: IDS.user,
      rating: null,
      comment: 'Thanks for the tips!',
      parent_review_id: IDS.reviewGreat,
      root_review_id: IDS.reviewGreat,
      depth: 1,
      moderation_status: 'approved',
      created_at: TIMESTAMPS.t1,
    }),
    review({
      id: REPLY_TO_REPLY,
      user_id: IDS.otherUser,
      rating: null,
      comment: 'Anytime — enjoy!',
      parent_review_id: REPLY,
      root_review_id: IDS.reviewGreat,
      depth: 2,
      moderation_status: 'approved',
      created_at: TIMESTAMPS.t2,
    }),
  ]);
}

function renderReviews() {
  return renderRoutes([{ path: '/recipes/$id', component: () => <ReviewsSection recipeId={IDS.recipeA} /> }], '/recipes/x');
}

describe('ReviewsSection', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
    seedThread();
  });

  it('renders the full thread, replies of replies included (regression)', async () => {
    renderReviews();

    expect(await screen.findByText('Great recipe!')).toBeInTheDocument();
    expect(screen.getByText('Thanks for the tips!')).toBeInTheDocument();
    // Regression: depth-2 replies were fetched but never rendered — a user
    // could post one and watch it disappear.
    expect(screen.getByText('Anytime — enjoy!')).toBeInTheDocument();
  });

  it('counts top-level reviews only in the section header', async () => {
    renderReviews();

    expect(await screen.findByText('Reviews (1)')).toBeInTheDocument();
  });

  it('starting an edit does not clobber the create form draft (regression)', async () => {
    const user = userEvent.setup();
    renderReviews();

    const draft = await screen.findByPlaceholderText('Share how the recipe turned out…');
    await user.type(draft, 'my half-written draft');

    // The reply is the signed-in user's own review → it offers Edit.
    await user.click(screen.getByRole('button', { name: 'Edit review' }));

    // Regression: onEditStart used to copy the review into the create form
    // (and onEditCancel reset it), wiping whatever the user was typing.
    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(draft).toHaveValue('my half-written draft');
  });
});
