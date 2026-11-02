import { Alert, Button, Container, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LuHeart } from 'react-icons/lu';
import { EmptyState, PageHeader } from '@components';
import { RecipeCard, useFavoriteRecipes } from '@features/recipes';
import { useAuthUser } from '@features/auth/providers/user';
import { useRecipeRatings } from '@features/reviews';

export const Route = createFileRoute('/_protected/favorites/')({
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const favoritesQuery = useFavoriteRecipes(user?.id ?? null);
  const recipesFlattened = favoritesQuery.data ?? [];
  const ratingsQuery = useRecipeRatings(recipesFlattened.map((recipe) => recipe.id));

  if (favoritesQuery.isPending) {
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

  if (favoritesQuery.isError) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" variant="light" title="Could not load favorites">
          <Stack gap="sm">
            <Text size="sm">{favoritesQuery.error.message}</Text>
            <Button variant="light" color="red" size="sm" maw="fit-content" onClick={() => favoritesQuery.refetch()}>
              Retry
            </Button>
          </Stack>
        </Alert>
      </Container>
    );
  }

  const recipes = favoritesQuery.data ?? [];
  const ratings = ratingsQuery.data ?? new Map();

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <PageHeader title="Favorites" description="The recipes you keep coming back to." />

        {recipes.length === 0 ? (
          <EmptyState
            icon={LuHeart}
            title="No favorites yet"
            description="Tap the heart on any recipe to keep it here for quick access."
            actionLabel="Find something to cook"
            onAction={() => navigate({ to: '/recipes', search: {} })}
          />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {recipes.map((recipe) => {
              const rating = ratings.get(recipe.id);
              return (
                <RecipeCard key={recipe.id} recipe={recipe} rating={rating?.average ?? null} reviewCount={rating?.count} />
              );
            })}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
