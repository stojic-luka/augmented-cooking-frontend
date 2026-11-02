import { Badge, Button, Container, Group, Paper, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { LuMessageSquareWarning, LuTicket, LuTrash2 } from 'react-icons/lu';
import { EmptyState } from '@components';
import { ModQueueCard } from '../ModQueueCard';
import { ModReportRow } from '../ModReportRow';
import {
  useModerateRecipe,
  useModerateReview,
  useModerationReviews,
  usePendingRecipes,
  useReportQueue,
  useSetReportStatus,
} from '../../hooks';

type ModTab = 'recipes' | 'reviews' | 'reports';

interface ModDashboardPageProps {
  /** Tab selected on first render; lets /mod/reviews deep-link into the reviews queue. */
  initialTab?: ModTab;
}

/** Moderator dashboard: pending recipes, review queue, and reported content. */
export function ModDashboardPage({ initialTab = 'recipes' }: Readonly<ModDashboardPageProps>) {
  const pendingQuery = usePendingRecipes();
  const reviewsQuery = useModerationReviews();
  const reportsQuery = useReportQueue();
  const moderateRecipe = useModerateRecipe();
  const moderateReview = useModerateReview();
  const setReportStatus = useSetReportStatus();

  const pending = pendingQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const reports = reportsQuery.data ?? [];

  const decide = (recipeId: string, decision: 'approve' | 'reject' | 'flag', title: string) => {
    if (decision === 'approve') {
      moderateRecipe.mutate({ recipeId, decision });
      return;
    }
    modals.openConfirmModal({
      title: decision === 'reject' ? 'Reject recipe' : 'Flag recipe',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            {decision === 'reject'
              ? `Reject “${title}”? It will no longer appear publicly.`
              : `Flag “${title}” for another moderation pass?`}
          </Text>
          <Text size="xs" c="dimmed">
            A reason note can be added later once moderator messaging ships.
          </Text>
        </Stack>
      ),
      labels: { confirm: decision === 'reject' ? 'Reject' : 'Flag', cancel: 'Cancel' },
      confirmProps: { color: decision === 'reject' ? 'red' : 'yellow' },
      onConfirm: () => moderateRecipe.mutate({ recipeId, decision }),
    });
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Title order={1}>Moderation dashboard</Title>

        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <ModQueueCard icon={<LuMessageSquareWarning size={18} />} label="Recipes awaiting review" value={pending.length} />
          <ModQueueCard icon={<LuMessageSquareWarning size={18} />} label="Reviews to moderate" value={reviews.length} />
          <ModQueueCard icon={<LuTicket size={18} />} label="Open reports" value={reports.length} />
        </SimpleGrid>

        <Tabs defaultValue={initialTab}>
          <Tabs.List>
            <Tabs.Tab value="recipes">Recipes ({pending.length})</Tabs.Tab>
            <Tabs.Tab value="reviews">Reviews ({reviews.length})</Tabs.Tab>
            <Tabs.Tab value="reports">Reports ({reports.length})</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="recipes" pt="lg">
            {pendingQuery.isPending ? (
              <Text size="sm" c="dimmed">
                Loading queue…
              </Text>
            ) : pendingQuery.isError ? (
              <Text size="sm" c="red">
                {pendingQuery.error.message}
              </Text>
            ) : pending.length === 0 ? (
              <EmptyState
                icon={LuMessageSquareWarning}
                title="Queue is clear"
                description="No public recipes are waiting for moderation right now."
              />
            ) : (
              <Stack gap="sm">
                {pending.map((recipe) => (
                  <Paper key={recipe.id} withBorder p="md" radius={12}>
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={2} style={{ minWidth: 0 }}>
                        <Group gap="xs">
                          <Text fw={600}>{recipe.title}</Text>
                          <Badge size="xs" color={recipe.moderation_status === 'flagged' ? 'red' : 'yellow'}>
                            {recipe.moderation_status}
                          </Badge>
                        </Group>
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {recipe.description}
                        </Text>
                        <Text size="xs" c="dimmed">
                          by {recipe.author_name ?? recipe.user_id?.slice(0, 8) ?? 'User'} ·{' '}
                          {new Date(recipe.created_at).toLocaleDateString()}
                        </Text>
                      </Stack>
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          color="green"
                          variant="subtle"
                          size="xs"
                          onClick={() => decide(recipe.id, 'approve', recipe.title)}
                        >
                          Approve
                        </Button>
                        <Button
                          color="yellow"
                          variant="subtle"
                          size="xs"
                          onClick={() => decide(recipe.id, 'flag', recipe.title)}
                        >
                          Flag
                        </Button>
                        <Button
                          color="red"
                          variant="subtle"
                          size="xs"
                          onClick={() => decide(recipe.id, 'reject', recipe.title)}
                        >
                          Reject
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="reviews" pt="lg">
            {reviewsQuery.isPending ? (
              <Text size="sm" c="dimmed">
                Loading reviews…
              </Text>
            ) : reviewsQuery.isError ? (
              <Text size="sm" c="red">
                {reviewsQuery.error.message}
              </Text>
            ) : reviews.length === 0 ? (
              <EmptyState
                icon={LuMessageSquareWarning}
                title="No reviews to moderate"
                description="Flagged and pending reviews land here."
              />
            ) : (
              <Stack gap="sm">
                {reviews.map((review) => (
                  <Paper key={review.id} withBorder p="md" radius={12}>
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={2} style={{ minWidth: 0 }}>
                        <Group gap="xs">
                          <Text fw={600}>{review.recipe_title ?? 'Unknown recipe'}</Text>
                          <Badge size="xs" color={review.moderation_status === 'flagged' ? 'red' : 'yellow'}>
                            {review.moderation_status}
                          </Badge>
                          <Badge size="xs" variant="light">
                            {review.rating}★
                          </Badge>
                        </Group>
                        <Text size="sm">{review.comment}</Text>
                        <Text size="xs" c="dimmed">
                          by {review.author_name ?? review.user_id?.slice(0, 8) ?? 'User'}
                        </Text>
                      </Stack>
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          color="green"
                          variant="subtle"
                          size="xs"
                          onClick={() => moderateReview.mutate({ reviewId: review.id, decision: 'approved' })}
                        >
                          Approve
                        </Button>
                        <Button
                          color="red"
                          variant="subtle"
                          size="xs"
                          onClick={() => moderateReview.mutate({ reviewId: review.id, decision: 'rejected' })}
                        >
                          Remove
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="reports" pt="lg">
            {reportsQuery.isPending ? (
              <Text size="sm" c="dimmed">
                Loading reports…
              </Text>
            ) : reportsQuery.isError ? (
              <Text size="sm" c="red">
                {reportsQuery.error.message}
              </Text>
            ) : reports.length === 0 ? (
              <EmptyState
                icon={LuTrash2}
                title="No open reports"
                description="User reports on recipes and reviews appear here."
              />
            ) : (
              <Stack gap="sm">
                {reports.map((report) => (
                  <ModReportRow
                    key={report.id}
                    report={report}
                    onSetStatus={(status) => setReportStatus.mutate({ reportId: report.id, status })}
                  />
                ))}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
