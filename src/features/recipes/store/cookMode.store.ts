import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CookModeState {
  /** Checked ingredient positions per recipe id. */
  checkedByRecipe: Record<string, number[]>;
  /** Chosen serving count per recipe id (scale factor = chosen / base). */
  servingsByRecipe: Record<string, number>;
  toggleChecked: (recipeId: string, position: number) => void;
  setServings: (recipeId: string, servings: number) => void;
  clearProgress: (recipeId: string) => void;
}

/**
 * Cook-mode progress lives in local storage: it is personal scratch state
 * while cooking, not server data.
 */
export const useCookModeStore = create<CookModeState>()(
  persist(
    (set) => ({
      checkedByRecipe: {},
      servingsByRecipe: {},
      toggleChecked: (recipeId, position) =>
        set((state) => {
          const current = state.checkedByRecipe[recipeId] ?? [];
          const next = current.includes(position)
            ? current.filter((entry) => entry !== position)
            : [...current, position];
          return { checkedByRecipe: { ...state.checkedByRecipe, [recipeId]: next } };
        }),
      setServings: (recipeId, servings) =>
        set((state) => ({ servingsByRecipe: { ...state.servingsByRecipe, [recipeId]: servings } })),
      clearProgress: (recipeId) =>
        set((state) => {
          const restChecked = { ...state.checkedByRecipe };
          const restServings = { ...state.servingsByRecipe };
          delete restChecked[recipeId];
          delete restServings[recipeId];
          return { checkedByRecipe: restChecked, servingsByRecipe: restServings };
        }),
    }),
    { name: 'ac-cook-mode' },
  ),
);

/**
 * Shared fallback for recipes with no check-off progress yet. getSnapshot
 * must return a stable reference — an inline `?? []` inside a selector
 * allocates on every call and can trigger a useSyncExternalStore re-render
 * loop ("Maximum update depth exceeded").
 */
const EMPTY_CHECKED: number[] = [];

/** Ingredient positions checked off for `recipeId`; empty until the first check. */
export function useCheckedIngredients(recipeId: string): number[] {
  return useCookModeStore((state) => state.checkedByRecipe[recipeId] ?? EMPTY_CHECKED);
}

/**
 * Servings the user is cooking at, falling back to `baseServings` (the
 * recipe's base count) until the user overrides it. The fallback is passed
 * in so the store module stays free of component-specific defaults.
 */
export function useRecipeServings(recipeId: string, baseServings: number): number;
export function useRecipeServings(recipeId: string, baseServings: number | undefined): number | undefined;
export function useRecipeServings(recipeId: string, baseServings: number | undefined): number | undefined {
  return useCookModeStore((state) => state.servingsByRecipe[recipeId] ?? baseServings);
}

/**
 * Cook-mode actions. Each action is a stable store reference, so selecting
 * them individually needs no shallow comparison.
 */
export function useCookModeActions(): Pick<CookModeState, 'toggleChecked' | 'setServings' | 'clearProgress'> {
  const toggleChecked = useCookModeStore((state) => state.toggleChecked);
  const setServings = useCookModeStore((state) => state.setServings);
  const clearProgress = useCookModeStore((state) => state.clearProgress);
  return { toggleChecked, setServings, clearProgress };
}
