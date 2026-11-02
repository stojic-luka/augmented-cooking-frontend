import { Alert, Button, Container, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LuChefHat, LuPlus } from 'react-icons/lu';
import { EmptyState, PageHeader } from '@components';
import { UserRecipeGrid, useUserRecipes } from '@features/recipes';
import { useAuthUser } from '@features/auth/providers/user';
import { useRecipeRatings } from '@features/reviews';

export const Route = createFileRoute('/_protected/my-recipes/')({
  component: MyRecipesPage,
});

function MyRecipesPage() {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const userRecipesQuery = useUserRecipes(user?.id ?? null);
  const recipesFlattened = userRecipesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const ratingsQuery = useRecipeRatings(recipesFlattened.map((recipe) => recipe.id));

  if (userRecipesQuery.isPending) {
    return (
      <Container size="lg" py="xl">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height={380} radius="md" />
          ))}
        </SimpleGrid>
      </Container>
    );
  }

  if (userRecipesQuery.isError) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" variant="light" title="Could not load your recipes">
          <Stack gap="sm">
            <Text size="sm">{userRecipesQuery.error.message}</Text>
            <Button variant="light" color="red" size="sm" maw="fit-content" onClick={() => userRecipesQuery.refetch()}>
              Retry
            </Button>
          </Stack>
        </Alert>
      </Container>
    );
  }

  const recipes = userRecipesQuery.recipes;

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <PageHeader
          title="My recipes"
          description="Everything you have created, imported, or copied — private drafts included."
          rightSection={
            <Button leftSection={<LuPlus size={16} />} onClick={() => navigate({ to: '/recipes/create' })}>
              New recipe
            </Button>
          }
        />

        {recipes.length === 0 ? (
          <EmptyState
            icon={LuChefHat}
            title="You have not created any recipes yet"
            description="Write your own, import one from the web, or let AI draft something from the ingredients you have."
            actionLabel="Create your first recipe"
            onAction={() => navigate({ to: '/recipes/create' })}
          />
        ) : (
          <UserRecipeGrid
            recipes={recipes}
            hasNextPage={userRecipesQuery.hasNextPage}
            isFetchingNextPage={userRecipesQuery.isFetchingNextPage}
            isLoadMoreError={userRecipesQuery.isFetchNextPageError}
            onLoadMore={() => userRecipesQuery.fetchNextPage()}
            isPending={userRecipesQuery.isPending}
            isError={userRecipesQuery.isError}
            onRetry={() => userRecipesQuery.refetch()}
            ratings={ratingsQuery.data ?? new Map()}
          />
        )}
      </Stack>
    </Container>
  );
}
