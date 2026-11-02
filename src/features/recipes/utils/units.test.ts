import { describe, expect, it } from 'vitest';
import { convertIngredient, formatIngredientAmount } from './units';

describe('convertIngredient', () => {
  it('metric: imperial mass converts to g/kg', () => {
    // Metric mass only switches to kg at >= 1000 g.
    expect(convertIngredient(1, 'lb', 'metric')).toEqual({ amount: 454, unit: 'g' });
    expect(convertIngredient(2, 'oz', 'metric')).toEqual({ amount: 56.7, unit: 'g' });
    expect(convertIngredient(300, 'g', 'metric')).toEqual({ amount: 300, unit: 'g' });
  });

  it('metric: imperial volume converts to ml/l', () => {
    expect(convertIngredient(2, 'cups', 'metric')).toEqual({ amount: 473, unit: 'ml' });
    expect(convertIngredient(2, 'tbsp', 'metric')).toEqual({ amount: 29.6, unit: 'ml' });
    expect(convertIngredient(2, 'l', 'metric')).toEqual({ amount: 2000, unit: 'l' });
  });

  it('imperial: metric mass converts to oz/lb with the right unit for the magnitude', () => {
    // Regression: sub-pound masses used to show the POUND quantity under an
    // "oz" label (100 g rendered as "0.22 oz"); the value must convert too.
    expect(convertIngredient(100, 'g', 'imperial')).toEqual({ amount: 3.53, unit: 'oz' });
    expect(convertIngredient(50, 'g', 'imperial')).toEqual({ amount: 1.76, unit: 'oz' });
    expect(convertIngredient(453.592, 'g', 'imperial')).toEqual({ amount: 1, unit: 'lb' });
    expect(convertIngredient(2, 'kg', 'imperial')).toEqual({ amount: 4.41, unit: 'lb' });
  });

  it('imperial: metric volume converts to cup/tbsp/tsp with the right unit for the magnitude', () => {
    expect(convertIngredient(500, 'ml', 'imperial')).toEqual({ amount: 2.11, unit: 'cup' });
    expect(convertIngredient(30, 'ml', 'imperial')).toEqual({ amount: 2.03, unit: 'tbsp' });
    expect(convertIngredient(5, 'ml', 'imperial')).toEqual({ amount: 1.01, unit: 'tsp' });
  });

  it('already-imperial units pass through unchanged (no double conversion)', () => {
    expect(convertIngredient(3, 'tbsp', 'imperial')).toEqual({ amount: 3, unit: 'tbsp' });
    expect(convertIngredient(1, 'lb', 'imperial')).toEqual({ amount: 1, unit: 'lb' });
  });

  it('units without a cross-system mapping pass through unchanged', () => {
    expect(convertIngredient(2, 'cloves', 'imperial')).toEqual({ amount: 2, unit: 'cloves' });
    expect(convertIngredient(2, 'pc', 'metric')).toEqual({ amount: 2, unit: 'pc' });
  });

  it('null and non-finite amounts pass through regardless of system', () => {
    expect(convertIngredient(null, 'g', 'imperial')).toEqual({ amount: null, unit: 'g' });
    expect(convertIngredient(Number.NaN, 'g', 'metric')).toEqual({ amount: Number.NaN, unit: 'g' });
  });

  it('unit matching is case- and whitespace-insensitive', () => {
    expect(convertIngredient(1, ' KG ', 'imperial')).toEqual({ amount: 2.2, unit: 'lb' });
  });

  it('already-metric units skip re-scaling in metric mode', () => {
    expect(convertIngredient(1.5, 'kg', 'metric')).toEqual({ amount: 1.5, unit: 'kg' });
  });
});

describe('formatIngredientAmount', () => {
  it('formats amount + unit and falls back for null amounts', () => {
    expect(formatIngredientAmount(200, 'g')).toBe('200 g');
    expect(formatIngredientAmount(null, '')).toBe('to taste');
    expect(formatIngredientAmount(null, 'pinch')).toBe('pinch');
    expect(formatIngredientAmount(2, '')).toBe('2');
  });
});
