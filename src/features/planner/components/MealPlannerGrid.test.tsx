import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealPlannerGrid } from './MealPlannerGrid';

// Local Monday midnight (Oct 26 2026). In timezones east of UTC,
// toISOString() reports the previous Sunday — which used to detach the
// column from the entries' stored local dates.
const WEEK_DAYS = Array.from({ length: 7 }, (_, index) => new Date(2026, 9, 26 + index));

function renderGrid() {
  const onAddMeal = vi.fn();
  render(
    <MealPlannerGrid
      weekDays={WEEK_DAYS}
      entries={[]}
      dayNutrition={new Map()}
      onAddMeal={onAddMeal}
      onRemoveEntry={() => {}}
      onOpenRecipe={() => {}}
      removing={false}
    />,
  );
  return onAddMeal;
}

describe('MealPlannerGrid', () => {
  it('keys day columns by the local date, not the UTC-shifted one', async () => {
    const onAddMeal = renderGrid();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Add Breakfast on Mon, Oct 26'));

    // Regression: this used to fire with '2026-10-25' (Sunday in UTC) for any
    // runner east of UTC, so meals never appeared in the week they were
    // planned for.
    expect(onAddMeal).toHaveBeenCalledWith('2026-10-26', 'breakfast');
  });

  it('renders one column per day of the given week', () => {
    renderGrid();
    expect(screen.getByText('Mon, Oct 26')).toBeInTheDocument();
    expect(screen.getByText('Sun, Nov 1')).toBeInTheDocument();
  });
});
