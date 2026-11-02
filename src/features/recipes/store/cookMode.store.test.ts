import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  useCheckedIngredients,
  useCookModeActions,
  useCookModeStore,
  useRecipeServings,
} from './cookMode.store';

/**
 * UI-only stores (zustand + localStorage persist). Selector hooks must
 * return stable references — the EMPTY_CHECKED fallback guards against the
 * useSyncExternalStore allocation loop documented in AGENTS.md.
 */
describe('cookMode.store', () => {
  beforeEach(() => {
    act(() => useCookModeStore.setState({ checkedByRecipe: {}, servingsByRecipe: {} }));
  });

  it('useCheckedIngredients starts empty and toggles positions per recipe', () => {
    const { result } = renderHook(() => useCheckedIngredients('recipe-1'));
    expect(result.current).toEqual([]);

    const { result: actions } = renderHook(() => useCookModeActions());
    act(() => actions.current.toggleChecked('recipe-1', 2));
    expect(result.current).toEqual([2]);

    act(() => actions.current.toggleChecked('recipe-1', 2));
    expect(result.current).toEqual([]);

    // Other recipes are untouched.
    act(() => actions.current.toggleChecked('recipe-2', 1));
    expect(result.current).toEqual([]);
  });

  it('useRecipeServings falls back to the base servings until overridden', () => {
    const { result } = renderHook(() => useRecipeServings('recipe-1', 4));
    expect(result.current).toBe(4);

    const { result: actions } = renderHook(() => useCookModeActions());
    act(() => actions.current.setServings('recipe-1', 8));
    expect(result.current).toBe(8);
  });

  it('clearProgress drops only that recipe', () => {
    const { result: actions } = renderHook(() => useCookModeActions());
    act(() => {
      actions.current.toggleChecked('recipe-1', 1);
      actions.current.setServings('recipe-1', 6);
      actions.current.toggleChecked('recipe-2', 2);
    });
    act(() => actions.current.clearProgress('recipe-1'));

    expect(useCookModeStore.getState().checkedByRecipe['recipe-1']).toBeUndefined();
    expect(useCookModeStore.getState().servingsByRecipe['recipe-1']).toBeUndefined();
    expect(useCookModeStore.getState().checkedByRecipe['recipe-2']).toEqual([2]);
  });
});
