import { createFileRoute, redirect } from '@tanstack/react-router';
import { getSupabaseBrowserClient } from '@lib/supabase';
import {
  RecipeFilterParamsSchema,
  RecipeExplorerPage,
  RecipeExplorerPageError,
  RecipeExplorerPagePending,
  RECIPES_SEARCH_PATH,
} from '@features/recipes';

export const Route = createFileRoute('/_public/recipes/')({
  validateSearch: RecipeFilterParamsSchema,
  pendingComponent: RecipeExplorerPagePending,
  errorComponent: ({ error }) => <RecipeExplorerPageError error={error} />,
  // Signed-in visitors get the protected twin (sidebar layout) instead; the
  // query string travels along so active filters survive the hand-off. The
  // decision waits on getSession(), so it never fires before the session is
  // restored — anonymous users see this page exactly as before.
  beforeLoad: async ({ search }) => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      throw redirect({ to: RECIPES_SEARCH_PATH, search });
    }
  },
  component: PublicRecipesRoute,
});

function PublicRecipesRoute() {
  const searchParams = Route.useSearch();
  return <RecipeExplorerPage search={searchParams} />;
}
