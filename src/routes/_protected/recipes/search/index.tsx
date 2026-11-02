import { createFileRoute, redirect } from '@tanstack/react-router';
import { getSupabaseBrowserClient } from '@lib/supabase';
import {
  RecipeExplorerPage,
  RecipeExplorerPageError,
  RecipeExplorerPagePending,
  RecipeFilterParamsSchema,
} from '@features/recipes';

export const Route = createFileRoute('/_protected/recipes/search/')({
  validateSearch: RecipeFilterParamsSchema,
  pendingComponent: RecipeExplorerPagePending,
  errorComponent: ({ error }) => <RecipeExplorerPageError error={error} />,
  // The explorer has a public twin at /recipes: this group's layout would
  // send anonymous visitors to the login wall, so this route intercepts them
  // first and keeps them on the public explorer, query string intact. The
  // decision waits on getSession(), so it never fires before the session is
  // restored.
  beforeLoad: async ({ search }) => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      throw redirect({ to: '/recipes', search });
    }
  },
  component: ProtectedRecipesSearchRoute,
});

function ProtectedRecipesSearchRoute() {
  const searchParams = Route.useSearch();
  return <RecipeExplorerPage search={searchParams} />;
}
