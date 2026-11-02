import type { Enums } from '@/types/database.types';

type UnitPreference = Enums<'unit_preference'>;

/**
 * Unit conversion for ingredient display. Recipes are stored in whatever unit
 * the author chose; this converts to the reader's preferred system where a
 * reliable mapping exists and leaves other units untouched.
 */

const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

const VOLUME_TO_MILLILITERS: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  cup: 236.588,
  cups: 236.588,
  'fl oz': 29.5735,
};

const VOLUME_TO_TEASPOONS: Record<string, number> = {
  ml: 0.202884,
  l: 202.884,
  tsp: 1,
  teaspoon: 1,
  teaspoons: 1,
  tbsp: 3,
  tablespoon: 3,
  tablespoons: 3,
  cup: 48,
  cups: 48,
  'fl oz': 6,
};

const IMPERIAL_MASS = ['oz', 'lb'] as const;
const IMPERIAL_VOLUME = ['tsp', 'tbsp', 'cup', 'fl oz'] as const;

export interface ConvertedIngredient {
  amount: number | null;
  unit: string;
}

function round(value: number): number {
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * Converts a (amount, unit) pair into the user's preferred unit system.
 * Units without a cross-system mapping (pieces, cloves, "to taste") pass
 * through unchanged.
 */
export function convertIngredient(amount: number | null, unit: string, system: UnitPreference): ConvertedIngredient {
  const normalized = unit.trim().toLowerCase();
  if (amount === null || !Number.isFinite(amount)) {
    return { amount, unit };
  }

  if (system === 'imperial') {
    const grams = MASS_TO_GRAMS[normalized];
    if (grams && !(IMPERIAL_MASS as readonly string[]).includes(normalized)) {
      const pounds = (amount * grams) / 453.592;
      // Below one pound the ounce scale reads better — convert the value too,
      // not just the unit label.
      return pounds >= 1 ? { amount: round(pounds), unit: 'lb' } : { amount: round(pounds * 16), unit: 'oz' };
    }
    const milliliters = VOLUME_TO_MILLILITERS[normalized];
    if (milliliters && !(IMPERIAL_VOLUME as readonly string[]).includes(normalized)) {
      const value = amount * milliliters; // total milliliters, rescaled to the chosen unit below
      if (value >= 236.588) return { amount: round(value / 236.588), unit: 'cup' };
      if (value >= 14.7868) return { amount: round(value / 14.7868), unit: 'tbsp' };
      return { amount: round(value / 4.92892), unit: 'tsp' };
    }
    return { amount, unit };
  }

  // metric
  const grams = MASS_TO_GRAMS[normalized];
  if (grams && normalized !== 'g' && normalized !== 'kg') {
    const value = amount * grams;
    return { amount: round(value), unit: value >= 1000 ? 'kg' : 'g' };
  }
  const teaspoons = VOLUME_TO_TEASPOONS[normalized];
  if (teaspoons) {
    const milliliters = (amount * teaspoons) / 0.202884;
    return { amount: round(milliliters), unit: milliliters >= 1000 ? 'l' : 'ml' };
  }
  return { amount, unit };
}

export function formatIngredientAmount(amount: number | null, unit: string): string {
  if (amount === null) {
    return unit || 'to taste';
  }
  return `${amount} ${unit}`.trim();
}
