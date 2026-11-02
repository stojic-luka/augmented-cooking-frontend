import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IngredientsChecklist } from './IngredientsChecklist';
import { dbRecipe, recipeIngredient } from '@/test/fixtures/db';
import type { FullRecipe } from '../types';

/**
 * Cook-mode checklist. Ingredients are rendered through the unit converter,
 * which must tolerate nullable DB values (any unit outside the reference
 * table is stored as NULL with the free text in `note`).
 */
describe('IngredientsChecklist', () => {
  it('renders an ingredient whose unit is null (crash regression)', () => {
    const recipe = dbRecipe({
      recipe_ingredients: [recipeIngredient({ quantity: null, unit: null, note: 'to taste' })],
    }) as unknown as FullRecipe;

    // Regression: `ingredient.unit!` fed null into unit.trim() and threw.
    render(<IngredientsChecklist recipe={recipe} unitPreference="metric" />);

    expect(screen.getByText('tomato')).toBeInTheDocument();
    expect(screen.getByText('to taste')).toBeInTheDocument();
  });

  it('reports check-off progress against the ingredient count', () => {
    const recipe = dbRecipe() as unknown as FullRecipe;
    render(<IngredientsChecklist recipe={recipe} unitPreference="metric" />);

    expect(screen.getByText('0/1 ready')).toBeInTheDocument();
  });
});
