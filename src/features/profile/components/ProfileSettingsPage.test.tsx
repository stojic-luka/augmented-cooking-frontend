import { describe, beforeEach, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ProfileSettingsPage } from './ProfileSettingsPage';
import { profile } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';

/**
 * The profile form's fields initialize from the profile row exactly once, so
 * they must populate from a profile that arrives AFTER mount (session restore
 * → profile fetch) instead of seeding with blanks and defaults.
 */
describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
    seed('profiles', [profile({ display_name: 'Cook', unit_preference: 'imperial', dietary_preferences: ['vegetarian'] })]);
  });

  function renderProfile() {
    return renderRoutes([{ path: '/profile', component: () => <ProfileSettingsPage /> }], '/profile');
  }

  it('populates the form from the late-arriving profile (regression)', async () => {
    renderProfile();

    // Regression: the fields used to initialize at mount — before the profile
    // resolved — leaving the display name blank and units/diet at defaults,
    // where an auto-save control could overwrite the stored values.
    expect(await screen.findByDisplayValue('Cook', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Imperial (oz, cups)')).toBeInTheDocument();
    expect(screen.getByText('vegetarian')).toBeInTheDocument();
  });
});
