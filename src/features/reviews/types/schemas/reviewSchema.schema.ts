import { z } from 'zod';
import {
  publicProfilesRowSchema,
  publicRecipesRowSchema,
  publicReviewsRowSchema,
  type PublicProfilesRow,
} from '@/types/schemas';

export const reviewWithAuthorSchema = publicReviewsRowSchema.extend({
  public_profile_info: publicProfilesRowSchema.pick({ display_name: true, avatar_url: true }).nullable(),
});

export type ReviewWithAuthor = Omit<z.infer<typeof reviewWithAuthorSchema>, 'public_profile_info'> & {
  author_name: PublicProfilesRow['display_name'] | null;
  author_avatar: PublicProfilesRow['avatar_url'] | null;
};

// export type ReviewWithAuthor = z.infer<typeof reviewWithAuthorSchema>;

export const reviewFormSchema = z.object({
  rating: z.number().int().min(1, { error: 'Pick a star rating' }).max(5),
  comment: z.string().min(1, { error: 'Write a short comment' }).max(2000, { error: 'Comment is too long' }),
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

/**
 * Select for recipe-level rating aggregates read from `recipes`. Rating
 * aggregates never come from `reviews` — that table holds raw per-review rows.
 */
export const RECIPE_RATINGS_SELECT = 'id, rating_avg, review_count';

/**
 * Contract for {@link RECIPE_RATINGS_SELECT} — schema and select must change
 * together: the select is the data source, this schema is the validation.
 *
 * Validates the denormalized aggregates on `recipes` (maintained by the
 * `recalc_recipe_rating` trigger: avg/count over approved, depth-0 reviews).
 * The columns are `NOT NULL DEFAULT 0`, so a recipe with zero reviews parses
 * as `rating_avg: 0, review_count: 0`.
 */
export const recipeRatingAggregateSchema = publicRecipesRowSchema.pick({
  id: true,
  rating_avg: true,
  review_count: true,
});
export type RecipeRatingAggregate = z.infer<typeof recipeRatingAggregateSchema>;
