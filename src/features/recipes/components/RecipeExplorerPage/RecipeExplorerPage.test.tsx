import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearch } from '@tanstack/react-router';
import { RecipeExplorerPage } from './RecipeExplorerPage';
import { RecipeFilterParamsSchema } from '../../types';
import { dbRecipe, IDS, TIMESTAMPS } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';
import { server } from '@/test/server';

/**
 * The core browse flow end-to-end: URL-driven filters → infinite query →
 * grid with keyset "Load more", plus count line, empty, and error states.
 * Everything runs through the real hooks and the fake PostgREST store.
 */
function seedRecipes(count: number) {
  seed(
    'recipes',
    Array.from({ length: count }, (_, index) =>
      dbRecipe({
        id: `ddddddd${(index % 8) + 1}-0000-4000-8000-${String(index).padStart(12, '0')}`,
        title: `Recipe ${index}`,
        created_at: new Date(Date.parse(TIMESTAMPS.t1) + index * 60_000).toISOString(),
        rating_avg: 5 - (index % 5) * 0.5,
      }),
    ),
  );
}

function RecipesRoute() {
  // Mirrors Route.useSearch() on the real route file (validateSearch has run).
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  return <RecipeExplorerPage search={search as never} />;
}

function renderExplorer(initialPath = '/recipes') {
  return renderRoutes(
    [
      {
        path: '/recipes',
        validateSearch: (search) => RecipeFilterParamsSchema.parse(search) as Record<string, unknown>,
        component: RecipesRoute,
      },
    ],
    initialPath,
  );
}

describe('RecipeExplorerPage', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('renders the count line, cards, and loads the next cursor page', async () => {
    seedRecipes(14);
    const user = userEvent.setup();
    renderExplorer();

    expect(await screen.findByText('14 recipes found')).toBeInTheDocument();
    expect(await screen.findByText('Recipe 13')).toBeInTheDocument(); // newest first

    await user.click(screen.getByText('Load more recipes'));

    await waitFor(() => expect(screen.getByText('Recipe 0')).toBeInTheDocument());
    expect(screen.queryByText('Load more recipes')).not.toBeInTheDocument(); // hasNextPage false
  });

  it('shows the empty state when nothing matches', async () => {
    renderExplorer();
    expect(await screen.findByText('No recipes match your search')).toBeInTheDocument();
    expect(screen.getByText('0 recipes found')).toBeInTheDocument();
  });

  it('shows a recoverable error state when the backend fails', async () => {
    seedRecipes(3);
    server.use(http.get('*/rest/v1/recipes', () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    renderExplorer();

    expect(await screen.findByText('Could not load recipes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('reflects URL search params: results follow the initial filters', async () => {
    seed('recipes', [dbRecipe({ title: 'Tomato Rice' }), dbRecipe({ id: IDS.recipeB, title: 'Pancakes', description: 'Fluffy breakfast stacks' })]);
    renderExplorer('/recipes?q=tomato');

    expect(await screen.findByText('1 recipe found')).toBeInTheDocument();
    expect(screen.getByText('Tomato Rice')).toBeInTheDocument();
    expect(screen.queryByText('Pancakes')).not.toBeInTheDocument();
  });

  it('typing a search pushes it into the URL and refetches', async () => {
    seed('recipes', [dbRecipe({ title: 'Tomato Rice' }), dbRecipe({ id: IDS.recipeB, title: 'Pancakes', description: 'Fluffy breakfast stacks' })]);
    const user = userEvent.setup();
    renderExplorer();

    await screen.findByText('2 recipes found');
    await user.type(screen.getByLabelText('Search'), 'Tomato');

    await waitFor(() => expect(screen.getByText('1 recipe found')).toBeInTheDocument());
    expect(screen.queryByText('Pancakes')).not.toBeInTheDocument();
  });
});
