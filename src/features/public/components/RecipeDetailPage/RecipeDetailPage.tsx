import { Container } from '@mantine/core';
import { RecipeDetailView, useRecipeDetails } from '@features/recipes';
import { useRecipeRatings } from '@features/reviews';

interface RecipeDetailPageProps {
  id: string;
}

/** Single recipe view with aggregated rating. Data is prefetched by the route loader. */
export function RecipeDetailPage({ id }: Readonly<RecipeDetailPageProps>) {
  const recipeQuery = useRecipeDetails(id);
  const ratingsQuery = useRecipeRatings(recipeQuery.data ? [recipeQuery.data.id] : []);

  const recipe = recipeQuery.data;
  if (!recipe) {
    // Covered by the route's pending/error components; defensive only.
    return null;
  }

  const rating = ratingsQuery.data?.get(recipe.id);

  return (
    <Container size="lg" py="xl">
      <RecipeDetailView
        recipe={recipe}
        averageRating={rating?.average ?? null}
        reviewCount={rating?.count ?? 0}
      />
    </Container>
  );
}