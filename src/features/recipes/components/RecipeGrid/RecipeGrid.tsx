import { Alert, Button, Loader, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { LuSoup } from 'react-icons/lu';
import { RecipeCard } from '../RecipeCard';
import type { FullRecipe } from '../../types';
import { EmptyState } from '@components';
import { useRef } from 'react';
import { useAutoLoadMore } from '../../hooks';

interface RecipeGridProps {
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
 * Result grid with "load more" paging. The isPending/isError states cover
 * refetches triggered by filter changes (query-key swaps inside the page);
 * the initial load is handled by the route's pending/error components.
 */
export function RecipeGrid({
  recipes,
  hasNextPage,
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
  isPending,
  isError,
  onRetry,
  ratings,
}: Readonly<RecipeGridProps>) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  useAutoLoadMore(sentinelRef, onLoadMore, hasNextPage && !isFetchingNextPage && !isLoadMoreError);

  if (isPending) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height={380} radius="md" />
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
        title="No recipes match your search"
        description="Try removing some filters, or check back soon — new recipes are added by cooks like you."
      />
    );
  }

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {recipes.map((recipe) => {
          const rating = ratings.get(recipe.id);
          return <RecipeCard key={recipe.id} recipe={recipe} rating={rating?.average ?? null} reviewCount={rating?.count} />;
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
