import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { reviewKeys } from '@features/reviews';
import { moderatorKeys } from '../query-keys';
import { fetchModerationReviews, moderateReview } from '../services';
import type { PublicModerationStatus } from '@/types/schemas';

export const moderationReviewsOptions = () =>
  queryOptions({
    queryKey: moderatorKeys.reviews(),
    queryFn: fetchModerationReviews,
  });
export const useModerationReviews = () => useQuery(moderationReviewsOptions());

interface ModerateReviewFnProps {
  reviewId: string;
  decision: Exclude<PublicModerationStatus, 'pending'>;
}
export function useModerateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, decision }: Readonly<ModerateReviewFnProps>) => moderateReview(reviewId, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderatorKeys.reviews() });
      queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      notifications.show({ message: 'Review moderated.', color: 'green' });
    },
  });
}
