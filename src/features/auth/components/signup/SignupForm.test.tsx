import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupForm } from './SignupForm';
import { clearSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';

/** Satisfies the full signup password policy: 8+, upper, lower, digit, special. */
const STRONG_PASSWORD = 'Recipe!C00k1e';

/** Passes every policy check except the special-character requirement. */
const NO_SPECIAL_PASSWORD = 'Weakpass1';

/**
 * The sign-up flow: client-side validation (required fields, password policy,
 * confirmation match), the real GoTrue sign-up through MSW, error surfacing,
 * and navigation to OTP verification on success.
 */
function renderSignup() {
  return renderRoutes(
    [
      { path: '/signup', component: () => <SignupForm /> },
      // The form navigates here with `search: { email }` after a successful sign-up.
      { path: '/verify-otp', component: () => <div>verify otp</div> },
      { path: '/login', component: () => <div>login</div> },
    ],
    '/signup',
  );
}

describe('SignupForm', () => {
  it('blocks submission with field errors for empty required fields and never calls the network', async () => {
    clearSession();
    const user = userEvent.setup();
    renderSignup();

    await user.click(await screen.findByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    // Both password fields are empty and therefore equal — the confirmation
    // mismatch check must not fire.
    expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
    // No exact assertion on the empty-password message: with several failing
    // checks zod emits multiple issues for the field and the resolver may
    // surface any of them — the block itself is what matters here.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('verify otp')).not.toBeInTheDocument();
  });

  it('enforces the password policy and confirmation match without calling the network', async () => {
    clearSession();
    const user = userEvent.setup();
    renderSignup();

    await user.type(await screen.findByPlaceholderText('e.g. Maria the home cook'), 'Maria');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'newcook@example.com');
    await user.type(screen.getByPlaceholderText('Create a strong password'), NO_SPECIAL_PASSWORD);
    await user.type(screen.getByPlaceholderText('Repeat the password'), 'Different123!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    // NO_SPECIAL_PASSWORD fails exactly one policy check, so this message is
    // deterministic regardless of which issue the resolver picks.
    expect(await screen.findByText('Password must contain at least one special character')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('verify otp')).not.toBeInTheDocument();
  });

  it('signs up with valid credentials and navigates to OTP verification', async () => {
    clearSession();
    const user = userEvent.setup();
    renderSignup();

    await user.type(await screen.findByPlaceholderText('e.g. Maria the home cook'), 'Maria the Home Cook');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'newcook@example.com');
    await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD);
    await user.type(screen.getByPlaceholderText('Repeat the password'), STRONG_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('verify otp')).toBeInTheDocument();
  });

  it('surfaces sign-up failures in a dismissible alert and stays on the form', async () => {
    clearSession();
    const user = userEvent.setup();
    renderSignup();

    // cook@example.com already exists in the fixtures (the LoginForm tests
    // sign in with it) — GoTrue rejects the duplicate registration.
    await user.type(await screen.findByPlaceholderText('e.g. Maria the home cook'), 'Maria');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'cook@example.com');
    await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD);
    await user.type(screen.getByPlaceholderText('Repeat the password'), STRONG_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/User already registered/i));
    expect(screen.getByPlaceholderText('you@example.com')).toHaveValue('cook@example.com');
    expect(screen.queryByText('verify otp')).not.toBeInTheDocument();
  });
});
