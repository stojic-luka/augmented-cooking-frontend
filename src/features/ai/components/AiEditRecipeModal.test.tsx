import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiEditRecipeModal } from './AiEditRecipeModal';
import type { FullRecipe, RecipeFormValues } from '@features/recipes';
import { dbRecipe } from '@/test/fixtures/db';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';
import { server } from '@/test/server';
import { http, HttpResponse } from 'msw';
import { API_URL } from '@/test/handlers/rest';

/**
 * The two-step AI edit over a stored recipe: the request must carry the full
 * stored recipe as a draft (regression: the hand-built payload was missing
 * required draft fields and violated the Zod contract).
 */
function renderModal(recipe: FullRecipe, onApply: (values: RecipeFormValues) => void) {
  return renderRoutes(
    [
      {
        path: '/recipes',
        component: () => <AiEditRecipeModal opened onClose={vi.fn()} recipe={recipe} onApply={onApply} />,
      },
    ],
    '/recipes',
  );
}

describe('AiEditRecipeModal', () => {
  beforeEach(() => seedSession());

  it('sends the complete recipe draft, previews the edit, and applies it', async () => {
    const user = userEvent.setup();
    let editBody: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/edit-recipe`, async ({ request }) => {
        editBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          recipe: {
            title: 'Vegetarian Tomato Rice',
            description: 'A simple one-pot tomato rice.',
            cuisine: 'Italian',
            prepTimeMinutes: 15,
            cookTimeMinutes: 25,
            servings: 4,
            ingredients: [{ name: 'tomato', amount: 200, unit: 'g' }],
            steps: [{ instruction: 'Simmer the tomatoes.' }],
            dietaryTags: ['vegan'],
          },
          summary: 'Swapped animal products for plants.',
        });
      }),
    );

    const onApply = vi.fn();
    renderModal(dbRecipe() as unknown as FullRecipe, onApply);

    await user.type(await screen.findByLabelText('What should change?'), 'make it vegan');
    await user.click(screen.getByRole('button', { name: 'Generate edit' }));

    await waitFor(() => expect(editBody).toBeDefined(), { timeout: 5000 });
    // The outgoing draft is the full toAiDraft mapping — nothing dropped.
    expect(editBody?.instruction).toBe('make it vegan');
    expect(editBody?.recipe).toMatchObject({
      title: 'Tomato Rice',
      servings: 4,
      cookTimeMinutes: 25,
      ingredients: [{ name: 'tomato', amount: 200, unit: 'g' }],
    });

    expect(
      await screen.findByText('Swapped animal products for plants.', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply changes' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0] as RecipeFormValues;
    expect(applied).toMatchObject({ title: 'Vegetarian Tomato Rice', isPublic: true, dietaryTags: ['vegan'] });
  });

  it('shows the failure alert when the backend errors and applies nothing', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/ai/edit-recipe`, () => HttpResponse.json({ message: 'Model unavailable' }, { status: 503 })),
    );

    const onApply = vi.fn();
    renderModal(dbRecipe() as unknown as FullRecipe, onApply);

    await user.type(await screen.findByLabelText('What should change?'), 'make it vegan');
    await user.click(screen.getByRole('button', { name: 'Generate edit' }));

    expect(await screen.findByText('AI edit failed', {}, { timeout: 5000 })).toBeInTheDocument();
    // The surfaced backend message is embedded in the alert's sentence.
    expect(within(document.body).getByText(/Model unavailable/)).toBeInTheDocument();
    expect(within(document.body).getByText(/Nothing was changed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply changes' })).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });
});
