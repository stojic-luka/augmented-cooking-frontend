import { Container, Skeleton, Stack } from '@mantine/core';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { EmptyState } from '@components';
import { RecipeForm, useRecipeDetails } from '@features/recipes';
import { useAuthUser } from '@features/auth/providers/user';
import { LuSoup } from 'react-icons/lu';

export const Route = createFileRoute('/_protected/recipes/$id/edit/')({
  component: EditRecipeRoute,
});

function EditRecipeRoute() {
  const { id } = Route.useParams();
  const { user } = useAuthUser();
  const recipeQuery = useRecipeDetails(id);

  if (recipeQuery.isPending) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="md">
          <Skeleton height={32} width={260} radius={8} />
          <Skeleton height={400} radius={12} />
        </Stack>
      </Container>
    );
  }

  if (recipeQuery.isError) {
    return (
      <Container size="lg" py="xl">
        <EmptyState icon={LuSoup} title="Recipe not found" description={recipeQuery.error.message} />
      </Container>
    );
  }

  const recipe = recipeQuery.data;
  if (recipe.user_id !== user?.id) {
    throw redirect({ to: '/recipes/$id', params: { id } });
  }

  return (
    <Container size="lg" py="xl">
      <RecipeForm recipe={recipe} title="Edit recipe" description="Update the details and save your changes." />
    </Container>
  );
}
