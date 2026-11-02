import { describe, expect, it } from 'vitest';
import { guessCategory } from './categories';

describe('guessCategory', () => {
  it.each([
    ['Roma tomatoes', 'produce'],
    ['whole milk', 'dairy'],
    ['chicken breast', 'meat'],
    ['smoked salmon', 'seafood'],
    ['basmati rice', 'grains'],
    ['smoked paprika', 'spices'],
    ['olive oil', 'pantry'],
    ['frozen peas', 'frozen'],
    ['baguette', 'bakery'],
    ['sparkling water', 'beverages'],
    ['paper towels', 'other'],
    ['', 'other'],
  ])('%s → %s', (name, expected) => {
    expect(guessCategory(name)).toBe(expected);
  });

  it('earlier keyword groups win: produce beats beverages for "orange juice"', () => {
    // Documented precedence — the first matching group in the KEYWORDS table
    // decides, so produce-adjacent drinks land in produce.
    expect(guessCategory('orange juice')).toBe('produce');
  });

  it('matches are case-insensitive on any word', () => {
    expect(guessCategory('FREE-RANGE EGGS')).toBe('dairy');
  });
});
