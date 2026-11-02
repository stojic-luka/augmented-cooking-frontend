import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiRecipeGeneratorPage } from './AiRecipeGeneratorPage';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/rest';

/**
 * The generator flow: requirements → POST /ai/generate-recipe → the draft
 * lands in the standard review form; backend failures surface inline.
 */
function renderGenerator() {
  return renderRoutes([{ path: '/recipes/generate', component: () => <AiRecipeGeneratorPage /> }], '/recipes/generate');
}

describe('AiRecipeGeneratorPage', () => {
  beforeEach(() => seedSession());

  it('sends the parsed ingredients and renders the draft for review', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/generate-recipe`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          recipe: {
            title: 'Tomato Rice',
            description: 'A simple one-pot dish.',
            cuisine: 'Italian',
            prepTimeMinutes: 15,
            cookTimeMinutes: null,
            servings: 2,
            ingredients: [{ name: 'tomato', amount: 400, unit: 'g' }],
            steps: [{ instruction: 'Cook the rice.' }],
            dietaryTags: ['vegetarian'],
          },
        });
      }),
    );

    renderGenerator();

    await user.type(await screen.findByLabelText('Ingredients on hand'), 'tomatoes, rice');
    await user.click(screen.getByRole('button', { name: 'Generate recipe' }));

    await waitFor(() => expect(body).toBeDefined(), { timeout: 5000 });
    // The comma-separated input is split into a clean ingredient list.
    expect(body?.ingredients).toEqual(['tomatoes', 'rice']);

    expect(await screen.findByText(/Tomato Rice/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Review AI draft')).toBeInTheDocument();
  });

  it('surfaces the backend error inline and keeps the form', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/ai/generate-recipe`, () =>
        HttpResponse.json({ message: 'Daily AI quota reached' }, { status: 429 }),
      ),
    );

    renderGenerator();

    await user.type(await screen.findByLabelText('Ingredients on hand'), 'tomatoes');
    await user.click(screen.getByRole('button', { name: 'Generate recipe' }));

    expect(await screen.findByText('Generation failed', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(within(document.body).getByText('Daily AI quota reached')).toBeInTheDocument();
    expect(screen.queryByText('Review AI draft')).not.toBeInTheDocument();
  });
});
