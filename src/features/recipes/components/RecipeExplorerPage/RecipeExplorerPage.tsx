import { Button, Container, Group, Skeleton, Stack, Text } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { PageHeader } from '@components';
import { useRecipeCount, useRecipes } from '../../hooks';
import type { RecipeFilterParams } from '../../types';
import { useRecipeRatings } from '@features/reviews';
import { RecipeFilters } from '../RecipeFilters';
import { RecipeGrid } from '../RecipeGrid/RecipeGrid';
import { useQueryClient } from '@tanstack/react-query';
import { recipeKeys } from '@features/recipes/query-keys';

interface RecipeExplorerPageProps {
  /** Search state from the URL; owned by the route, passed down read-only. */
  search: RecipeFilterParams;
}

/**
 * Recipe explorer: URL-driven filters, result grid, and "load more" paging.
 * The count line uses a one-shot total (cursor pages carry no count).
 */
export function RecipeExplorerPage({ search }: Readonly<RecipeExplorerPageProps>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recipesQuery = useRecipes(search);
  const countQuery = useRecipeCount(search);
  const recipes = recipesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const ratingsQuery = useRecipeRatings(recipes.map((recipe) => recipe.id));

  const invalidateRecipes = () => queryClient.invalidateQueries({ queryKey: recipeKeys.all, refetchType: 'none' });

  const handleSearchChange = (patch: Partial<RecipeFilterParams>) => {
    // Any filter change starts a new result set, so the stale cursor drops.
    // '.' writes back to whichever route (public or protected twin) mounted the page.
    invalidateRecipes();
    navigate({
      to: '.',
      search: (prev: RecipeFilterParams) => ({ ...prev, ...patch, cursor: undefined }),
      replace: true,
    });
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <PageHeader
          title="Recipe explorer"
          description="Discover your next favorite meal — filter by what you have, how long you have, and how you eat."
        />
        <RecipeFilters
          search={search}
          onChange={handleSearchChange}
          onClear={() => {
            invalidateRecipes();
            navigate({ to: '.', search: {}, replace: true });
          }}
        />
        {countQuery.isPending ? (
          <Skeleton height={16} width={120} radius="sm" />
        ) : countQuery.isError ? (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Couldn&apos;t load the recipe count.
            </Text>
            <Button variant="transparent" size="compact-sm" p={0} onClick={() => countQuery.refetch()}>
              Retry
            </Button>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            {countQuery.data} recipe{countQuery.data === 1 ? '' : 's'} found
          </Text>
        )}
        <RecipeGrid
          recipes={recipes}
          hasNextPage={recipesQuery.hasNextPage}
          isFetchingNextPage={recipesQuery.isFetchingNextPage}
          isLoadMoreError={recipesQuery.isFetchNextPageError}
          onLoadMore={() => recipesQuery.fetchNextPage()}
          isPending={recipesQuery.isPending}
          isError={recipesQuery.isError}
          onRetry={() => recipesQuery.refetch()}
          ratings={ratingsQuery.data ?? new Map()}
        />
      </Stack>
    </Container>
  );
}
