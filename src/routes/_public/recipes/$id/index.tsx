import { createFileRoute } from '@tanstack/react-router';
import { recipeDetailsOptions } from '@features/recipes';
import { recipeRatingsOptions } from '@features/reviews';
import { RecipeDetailPage, RecipeDetailPageError, RecipeDetailPagePending } from '@features/public/components';

function PublicRecipeDetailRoute() {
  const { id } = Route.useParams();
  return <RecipeDetailPage id={id} />;
}

export const Route = createFileRoute('/_public/recipes/$id/')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.query(recipeDetailsOptions(params.id)),
      context.queryClient.query(recipeRatingsOptions([params.id])),
    ]);
  },
  pendingComponent: RecipeDetailPagePending,
  errorComponent: ({ error }) => <RecipeDetailPageError error={error} />,
  component: PublicRecipeDetailRoute,
});
