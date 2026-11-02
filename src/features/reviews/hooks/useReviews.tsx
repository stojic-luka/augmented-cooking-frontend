import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { reviewKeys } from '../query-keys';
import {
  createReview,
  deleteReview,
  fetchRecipeReviews,
  updateReview,
  uploadReviewImage,
  type ReviewWriteInput,
} from '../services';

export const useRecipeReviewsOptions = (recipeId: string) =>
  queryOptions({
    queryKey: reviewKeys.recipe(recipeId),
    queryFn: () => fetchRecipeReviews(recipeId),
    enabled: Boolean(recipeId),
  });
export const useRecipeReviews = (recipeId: string) => useQuery(useRecipeReviewsOptions(recipeId));

export function useCreateReview(recipeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<ReviewWriteInput, 'recipeId'> & { imageFile?: File | null }) => {
      let imageUrl: string | null = null;
      if (input.imageFile) {
        imageUrl = await uploadReviewImage(input.userId, input.imageFile);
      }
      return createReview({ ...input, recipeId, imageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.recipe(recipeId) });
      notifications.show({ message: 'Review posted.', color: 'green' });
    },
  });
}

export function useUpdateReview(recipeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reviewId,
      userId,
      rating,
      comment,
    }: {
      reviewId: string;
      userId: string;
      rating: number | null;
      comment: string;
    }) => updateReview(reviewId, userId, { rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.recipe(recipeId) });
      notifications.show({ message: 'Review updated.', color: 'green' });
    },
  });
}

export function useDeleteReview(recipeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, userId }: { reviewId: string; userId: string }) => deleteReview(reviewId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.recipe(recipeId) });
      notifications.show({ message: 'Review deleted.', color: 'green' });
    },
  });
}
