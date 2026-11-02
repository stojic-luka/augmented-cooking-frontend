import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeImportForm } from './RecipeImportForm';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/rest';

/**
 * The import flow: URL → POST /recipes/import → the scraped draft lands in
 * the standard review form; backend failures surface inline.
 */
function renderImport() {
  return renderRoutes([{ path: '/recipes/import', component: () => <RecipeImportForm /> }], '/recipes/import');
}

describe('RecipeImportForm', () => {
  beforeEach(() => seedSession());

  it('sends the URL and renders the scraped draft for review', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/recipes/import`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          recipe: {
            title: 'Best Lasagna',
            description: 'Scraped.',
            cuisine: 'Italian',
            prepTimeMinutes: 30,
            cookTimeMinutes: 60,
            servings: 6,
            ingredients: [{ name: 'pasta', amount: 500, unit: 'g' }],
            steps: [{ instruction: 'Layer.' }],
            image: null,
          },
        });
      }),
    );

    renderImport();

    await user.type(await screen.findByLabelText('Recipe URL'), 'https://example.blog/recipe');
    await user.click(screen.getByRole('button', { name: 'Import recipe' }));

    await waitFor(() => expect(body).toEqual({ url: 'https://example.blog/recipe' }), { timeout: 5000 });
    expect(await screen.findByText('Recipe imported', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Review imported recipe')).toBeInTheDocument();
  });

  it('surfaces the backend error inline', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/recipes/import`, () =>
        HttpResponse.json({ message: 'Unsupported recipe site' }, { status: 400 }),
      ),
    );

    renderImport();

    await user.type(await screen.findByLabelText('Recipe URL'), 'https://example.blog/recipe');
    await user.click(screen.getByRole('button', { name: 'Import recipe' }));

    expect(await screen.findByText('Import failed', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(within(document.body).getByText('Unsupported recipe site')).toBeInTheDocument();
    expect(screen.queryByText('Review imported recipe')).not.toBeInTheDocument();
  });
});
