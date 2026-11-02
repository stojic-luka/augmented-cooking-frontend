import { useEffect, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Anchor,
  Avatar,
  Box,
  Button,
  Divider,
  Group,
  Image,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { LuFlag, LuImageOff, LuPencil, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
import { notifications } from '@mantine/notifications';
import { RatingStars } from '@components';
import { useAuthUser } from '@features/auth/providers/user';
import { useCreateReport } from '@features/reports';
import { useCreateReview, useDeleteReview, useRecipeReviews, useUpdateReview } from '../hooks';
import { useReviewImageUrl } from '../hooks/useReviewImageUrl';
import type { ReviewFormValues, ReviewWithAuthor } from '../types';

interface ReviewsSectionProps {
  recipeId: string;
}

export function ReviewsSection({ recipeId }: Readonly<ReviewsSectionProps>) {
  const { user, isAuthed } = useAuthUser();
  const reviewsQuery = useRecipeReviews(recipeId);
  const createReview = useCreateReview(recipeId);
  const updateReview = useUpdateReview(recipeId);
  const deleteReview = useDeleteReview(recipeId);
  const createReport = useCreateReport();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReviewWithAuthor | null>(null);
  const [reportTarget, setReportTarget] = useState<ReviewWithAuthor | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const form = useForm<ReviewFormValues>({
    initialValues: { rating: 0, comment: '' },
    validate: {
      rating: (value: number) => (replyTo || value >= 1 ? null : 'Pick a star rating'),
      comment: (value: string) => (value.trim().length > 0 ? null : 'Write a short comment'),
    },
  });

  // Clicking the star that is already selected clears the rating (3 stars,
  // click the 3rd star again → back to 0 = unrated).
  const handleRatingSelect = (rating: number) => {
    form.setFieldValue('rating', form.values.rating === rating ? 0 : rating);
  };

  const reviews = reviewsQuery.data ?? [];
  const topLevel = reviews.filter((review) => review.parent_review_id === null);
  // One pass instead of a filter per top-level review — and the base for the
  // recursive thread rendering below (replies of replies are real data: the
  // reply action is offered on every item, so every level must render).
  const repliesByParent = new Map<string, ReviewWithAuthor[]>();
  for (const review of reviews) {
    if (review.parent_review_id === null) continue;
    const bucket = repliesByParent.get(review.parent_review_id) ?? [];
    bucket.push(review);
    repliesByParent.set(review.parent_review_id, bucket);
  }

  const handleSubmit = (values: ReviewFormValues) => {
    if (!user) return;

    const mutationInput = {
      userId: user.id,
      // Replies never carry a rating (DB CHECK: rating IS NULL when depth > 0),
      // so a reply always sends null — even if a rating was picked earlier
      // while composing a top-level review.
      rating: replyTo ? null : values.rating,
      comment: values.comment,
      imageFile,
      parentReviewId: replyTo?.id ?? null,
    };

    if (replyTo) {
      createReview.mutate(mutationInput, {
        onSuccess: () => {
          form.reset();
          setReplyTo(null);
          setImageFile(null);
        },
        onError: (error) => notifyError(error),
      });
      return;
    }

    createReview.mutate(mutationInput, {
      onSuccess: () => {
        form.reset();
        setImageFile(null);
      },
      onError: (error) => notifyError(error),
    });
  };

  const handleUpdate = (review: ReviewWithAuthor, values: ReviewFormValues) => {
    if (!user) return;
    updateReview.mutate(
      {
        reviewId: review.id,
        userId: user.id,
        // Removing your rating in the edit form sends null (unrated).
        // Replies have no rating slot, so their value is 0 → null as well.
        rating: review.parent_review_id === null ? values.rating : null,
        comment: values.comment,
      },
      {
        onSuccess: () => setEditingId(null),
        onError: (error) => notifyError(error),
      },
    );
  };

  const handleDelete = (review: ReviewWithAuthor) => {
    if (!user) return;
    deleteReview.mutate(
      { reviewId: review.id, userId: user.id },
      {
        onError: (error) => notifyError(error),
      },
    );
  };

  const handleReportSubmit = () => {
    if (!user || !reportTarget || !reportReason.trim()) return;
    createReport.mutate(
      { reporterId: user.id, targetType: 'review', targetId: reportTarget.id, reason: reportReason },
      {
        onSuccess: () => {
          notifications.show({ message: 'Report submitted. A moderator will take a look.', color: 'green' });
          setReportTarget(null);
          setReportReason('');
        },
        onError: (error) => notifyError(error),
      },
    );
  };

  const renderReview = (review: ReviewWithAuthor): ReactNode => (
    <ReviewItem
      key={review.id}
      review={review}
      currentUserId={user?.id ?? null}
      isPending={updateReview.isPending || deleteReview.isPending}
      editingId={editingId}
      onEditStart={(id) => setEditingId(id)}
      onEditCancel={() => setEditingId(null)}
      onEditSubmit={handleUpdate}
      onDelete={handleDelete}
      onReply={setReplyTo}
      onReport={setReportTarget}
      renderReplies={() => {
        const replies = repliesByParent.get(review.id) ?? [];
        if (replies.length === 0) return null;
        return (
          <Stack gap="sm" ml={{ base: 0, sm: 40 }}>
            {replies.map((reply) => renderReview(reply))}
          </Stack>
        );
      }}
    />
  );

  if (reviewsQuery.isPending) {
    return (
      <Stack gap="sm">
        <Text fw={600} size="xl">
          Reviews
        </Text>
        <Skeleton height={120} radius={12} />
      </Stack>
    );
  }

  if (reviewsQuery.isError) {
    return (
      <Stack gap="sm">
        <Text fw={600} size="xl">
          Reviews
        </Text>
        <Text size="sm" c="red">
          Could not load reviews. {reviewsQuery.error.message}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Text fw={600} size="xl">
        Reviews {topLevel.length > 0 ? `(${topLevel.length})` : ''}
      </Text>

      {isAuthed && user ? (
        <Paper withBorder p="md" radius={12}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="sm">
              {replyTo ? (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Replying to {replyTo.author_name ?? 'a cook'}
                  </Text>
                  <Anchor size="xs" onClick={() => setReplyTo(null)}>
                    Cancel
                  </Anchor>
                </Group>
              ) : (
                <Stack gap={4}>
                  <RatingStars value={form.values.rating} onChange={handleRatingSelect} size={22} />
                </Stack>
              )}
              <Textarea
                placeholder={replyTo ? 'Write your reply…' : 'Share how the recipe turned out…'}
                minRows={2}
                key={form.key('comment')}
                {...form.getInputProps('comment')}
              />
              <Group justify="space-between">
                <TextInput
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImageFile(event.currentTarget.files?.[0] ?? null)}
                  visibleFrom="sm"
                />
                <Button type="submit" loading={createReview.isPending} disabled={createReview.isPending}>
                  {replyTo ? 'Post reply' : 'Post review'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      ) : (
        <Text size="sm" c="dimmed">
          Sign in to leave a review.
        </Text>
      )}

      {topLevel.length === 0 ? (
        <Text size="sm" c="dimmed">
          No reviews yet — be the first to cook this recipe and share your experience.
        </Text>
      ) : (
        <Stack gap="md">{topLevel.map((review) => renderReview(review))}</Stack>
      )}

      <Modal opened={reportTarget !== null} onClose={() => setReportTarget(null)} title="Report review" centered>
        <Stack gap="sm">
          <Text size="sm">Tell us what is wrong with this review. A moderator will review it.</Text>
          <Textarea
            placeholder="Reason for reporting…"
            minRows={3}
            value={reportReason}
            onChange={(event) => setReportReason(event.currentTarget.value)}
          />
          <Button color="red" loading={createReport.isPending} disabled={!reportReason.trim()} onClick={handleReportSubmit}>
            Submit report
          </Button>
        </Stack>
      </Modal>

      <Divider my="xl" />
    </Stack>
  );
}

interface ReviewItemProps {
  review: ReviewWithAuthor;
  currentUserId: string | null;
  isPending: boolean;
  editingId: string | null;
  onEditStart: (id: string) => void;
  onEditCancel: () => void;
  onEditSubmit: (review: ReviewWithAuthor, values: ReviewFormValues) => void;
  onDelete: (review: ReviewWithAuthor) => void;
  onReply: (review: ReviewWithAuthor) => void;
  onReport: (review: ReviewWithAuthor) => void;
  renderReplies?: () => ReactNode;
}

function ReviewItem({
  review,
  currentUserId,
  isPending,
  editingId,
  onEditStart,
  onEditCancel,
  onEditSubmit,
  onDelete,
  onReply,
  onReport,
  renderReplies,
}: Readonly<ReviewItemProps>) {
  const { data: imageUrl, isPending: imagePending, isError, refetch } = useReviewImageUrl(review.image_url);
  const isOwn = currentUserId === review.user_id;
  const isEditing = editingId === review.id;
  // Only top-level reviews carry a rating (DB CHECK: replies have rating IS
  // NULL), so the star picker is only offered for top-level reviews.
  const canRate = review.parent_review_id === null;
  const editForm = useForm<ReviewFormValues>({
    initialValues: { rating: review.rating || 0, comment: review.comment },
  });

  // Same toggle as the composer: re-clicking the selected star clears it.
  const handleEditRatingSelect = (rating: number) => {
    editForm.setFieldValue('rating', editForm.values.rating === rating ? 0 : rating);
  };

  return (
    <Paper withBorder p="md" radius={12}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group wrap="nowrap">
          <Avatar src={review.author_avatar ?? undefined} name={review.author_name ?? 'Cook'} color="brand" size="sm" />
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              {review.author_name ?? 'Anonymous cook'}
            </Text>
            <Text size="xs" c="dimmed">
              {new Date(review.created_at).toLocaleDateString()}
            </Text>
          </Stack>
        </Group>
        {review.rating ? (
          <RatingStars value={review.rating} />
        ) : canRate ? (
          <Text size="xs" c="dimmed">
            No rating
          </Text>
        ) : null}
      </Group>

      {isEditing ? (
        <form onSubmit={editForm.onSubmit((values) => onEditSubmit(review, values))}>
          <Stack gap="sm" mt="sm">
            {canRate ? (
              <Stack gap={4}>
                <RatingStars value={editForm.values.rating} onChange={handleEditRatingSelect} size={20} />
                <Text size="xs" c="dimmed">
                  Click the same star again to remove the rating.
                </Text>
              </Stack>
            ) : null}
            <Textarea key={editForm.key('comment')} {...editForm.getInputProps('comment')} minRows={2} />
            <Group gap="xs">
              <Button type="submit" size="xs" disabled={isPending}>
                Save
              </Button>
              <Button type="button" size="xs" variant="subtle" onClick={onEditCancel}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </form>
      ) : (
        <>
          <Text size="sm" mt="sm">
            {review.comment}
          </Text>
          {review.image_url ? (
            <Box mt="sm">
              <ReviewImage
                imageUrl={imageUrl}
                loading={imagePending}
                resolutionFailed={isError}
                onRetry={() => refetch()}
                alt="Review photo"
              />
            </Box>
          ) : null}
        </>
      )}

      <Group gap="xs" mt="sm">
        {!isOwn ? (
          <ActionIcon variant="subtle" aria-label="Reply" onClick={() => onReply(review)}>
            <Text size="xs">Reply</Text>
          </ActionIcon>
        ) : null}
        {isOwn ? (
          <ActionIcon variant="subtle" aria-label="Edit review" onClick={() => onEditStart(review.id)}>
            <LuPencil size={15} />
          </ActionIcon>
        ) : null}
        {isOwn ? (
          <ActionIcon variant="subtle" color="red" aria-label="Delete review" onClick={() => onDelete(review)}>
            <LuTrash2 size={15} />
          </ActionIcon>
        ) : null}
        {!isOwn ? (
          <ActionIcon variant="subtle" aria-label="Report review" onClick={() => onReport(review)}>
            <LuFlag size={15} />
          </ActionIcon>
        ) : null}
      </Group>

      {renderReplies ? renderReplies() : null}
    </Paper>
  );
}

interface ReviewImageProps {
  imageUrl: string | null | undefined;
  alt: string;
  loading?: boolean;
  resolutionFailed?: boolean;
  onRetry?: () => void;
}

function ReviewImagePlaceholder({ children }: { children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md" maw={280}>
      <Stack align="center" gap="xs">
        {children}
      </Stack>
    </Paper>
  );
}

/**
 * Fault-tolerant rendering for a review photo, mirroring `RecipeImage` but
 * sized for an inline attachment: skeleton while the signed URL resolves or
 * the file probes, retryable placeholder when it fails, and nothing at all
 * when no URL resolves without a failure (no path → no image block).
 */
function ReviewImage({ imageUrl, alt, loading = false, resolutionFailed, onRetry }: ReviewImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!imageUrl) return;
    setStatus('loading');
    let active = true;
    const probe = new window.Image();
    probe.onload = () => active && setStatus('loaded');
    probe.onerror = () => active && setStatus('error');
    // cache-buster on retries; extra query params don't affect signed-URL validation
    probe.src = nonce > 0 ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}r=${nonce}` : imageUrl;
    return () => {
      active = false;
    };
  }, [imageUrl, nonce]);

  if (loading || status === 'loading') {
    return <Skeleton radius="md" h={180} maw={280} />;
  }

  if (!imageUrl) {
    if (!resolutionFailed) return null;
    return (
      <ReviewImagePlaceholder>
        <ThemeIcon variant="light" size={36} radius="lg" color="gray">
          <LuImageOff size={18} />
        </ThemeIcon>
        <Text size="sm" c="dimmed">
          Image unavailable
        </Text>
        {onRetry ? (
          <Button size="xs" variant="subtle" leftSection={<LuRefreshCw size={14} />} onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </ReviewImagePlaceholder>
    );
  }

  if (status === 'error') {
    return (
      <ReviewImagePlaceholder>
        <ThemeIcon variant="light" size={36} radius="lg" color="gray">
          <LuImageOff size={18} />
        </ThemeIcon>
        <Text size="sm" c="dimmed">
          Image unavailable
        </Text>
        <Button size="xs" variant="subtle" leftSection={<LuRefreshCw size={14} />} onClick={() => setNonce((n) => n + 1)}>
          Try again
        </Button>
      </ReviewImagePlaceholder>
    );
  }

  return <Image src={imageUrl} alt={alt} radius="md" maw={280} />;
}

function notifyError(error: Error) {
  notifications.show({ title: 'Something went wrong', message: error.message, color: 'red' });
}
