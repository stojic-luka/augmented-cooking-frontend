import { useRef, useState } from 'react';
import { Alert, Button, Loader, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { LuSoup } from 'react-icons/lu';
import { UserRecipeCard } from '../RecipeCard';
import { confirmDeleteRecipe, useDeleteRecipe } from '../../hooks'; // ← adjust to your actual hooks path/name
import type { FullRecipe } from '../../types';
import { EmptyState } from '@components';
import { useAuthUser } from '@features/auth/providers/user';
import { useAutoLoadMore } from '../../hooks';

interface UserRecipeGridProps {
  /** Flattened pages of the current result set, in cursor order. */
  recipes: FullRecipe[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** True when the last "load more" fetch failed — the button retries it. */
  isLoadMoreError: boolean;
  onLoadMore: () => void;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  ratings: Map<string, { average: number; count: number }>;
}

/**
 * Grid for the user's own recipes: standard recipe cards plus per-card
 * Edit / Delete actions. The isPending/isError states cover refetches
 * triggered by filter changes (query-key swaps inside the page); the
 * initial load is handled by the route's pending/error components.
 */
export function UserRecipeGrid({
  recipes,
  hasNextPage,
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
  isPending,
  isError,
  onRetry,
  ratings,
}: Readonly<UserRecipeGridProps>) {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const deleteRecipe = useDeleteRecipe(user?.id ?? null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useAutoLoadMore(sentinelRef, onLoadMore, hasNextPage && !isFetchingNextPage && !isLoadMoreError);

  if (isPending) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height={420} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  if (isError) {
    return (
      <Alert color="red" title="Could not load recipes">
        <Stack gap="sm">
          <Text size="sm">Something went wrong while fetching recipes. Please try again.</Text>
          <Button variant="light" color="red" maw="fit-content" onClick={onRetry}>
            Retry
          </Button>
        </Stack>
      </Alert>
    );
  }

  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={LuSoup}
        title="You haven't shared any recipes yet"
        description="Create your first recipe and share it with the community — your kitchen creations are just a few clicks away."
      />
    );
  }

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {recipes.map((recipe) => {
          const rating = ratings.get(recipe.id);
          return (
            <Paper key={recipe.id} p={0} radius={12}>
              <UserRecipeCard
                recipe={recipe}
                rating={rating?.average ?? null}
                reviewCount={rating?.count}
                onEdit={() => navigate({ to: '/recipes/$id/edit', params: { id: recipe.id } })}
                deletePending={deletingId === recipe.id && deleteRecipe.isPending}
                onDelete={() => {
                  setDeletingId(recipe.id);
                  confirmDeleteRecipe(recipe.title, () =>
                    deleteRecipe.mutate({ id: recipe.id, title: recipe.title }, { onSettled: () => setDeletingId(null) }),
                  );
                }}
              />
            </Paper>
          );
        })}
      </SimpleGrid>

      <Stack ref={sentinelRef} gap="xs" align="center" py="md">
        {isLoadMoreError ? (
          <>
            <Text size="sm" c="red">
              Couldn&apos;t load more recipes.
            </Text>
            <Button variant="light" onClick={onLoadMore}>
              Retry
            </Button>
          </>
        ) : isFetchingNextPage ? (
          <Loader size="sm" />
        ) : !hasNextPage ? (
          <Text size="sm" c="dimmed">
            You&apos;ve reached the end
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}
