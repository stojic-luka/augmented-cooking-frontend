import { describe, beforeEach, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { RecipeDetailView } from './RecipeDetailView';
import { dbRecipe, ingredientRow, recipeIngredient } from '@/test/fixtures/db';
import { clearTables } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';
import type { FullRecipe } from '../types';

/**
 * The recipe detail surface. Ingredients run through the unit converter —
 * nullable units (anything outside the units reference table) must render,
 * not crash.
 */
describe('RecipeDetailView', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  function renderDetail(recipe: FullRecipe) {
    return renderRoutes([{ path: '/recipes/$id', component: () => <RecipeDetailView recipe={recipe} /> }], '/recipes/x');
  }

  it('renders ingredients with a null unit without crashing (regression)', async () => {
    const recipe = dbRecipe({
      recipe_ingredients: [
        recipeIngredient({ position: 1, quantity: 200, unit: 'g' }),
        recipeIngredient({
          id: 'eeeeeeee-0000-4000-8000-000000000002',
          position: 2,
          quantity: null,
          unit: null,
          note: 'to taste',
          ingredient: ingredientRow({ id: 'bbbbbbb4-0000-4000-8000-000000000004', name: 'salt' }),
        }),
      ],
    }) as unknown as FullRecipe;

    renderDetail(recipe);

    expect(await screen.findByText('Tomato Rice')).toBeInTheDocument();
    expect(screen.getByText('tomato')).toBeInTheDocument();
    // The unit-less row used to throw in convertIngredient (unit.trim on null).
    expect(screen.getByText('salt')).toBeInTheDocument();
    expect(screen.getByText('to taste')).toBeInTheDocument();
    expect(screen.getByText('200 g')).toBeInTheDocument();
  });
});
