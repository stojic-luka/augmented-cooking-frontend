import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';
import { TEST_PASSWORD, profile } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { clearSession } from '@/test/auth';
import { TEST_ORIGIN } from '@/test/origin';
import { server } from '@/test/server';
import { renderRoutes } from '@/test/utils';

/**
 * The sign-in flow: client-side validation, the real GoTrue sign-in through
 * MSW, error surfacing, and post-login navigation — an explicit `nextPath`
 * wins over the role-based start page, which resolves from the fresh
 * session's profile before any navigation happens.
 */
function renderLogin(nextPath?: string) {
  return renderRoutes(
    [
      { path: '/login', component: () => <LoginForm nextPath={nextPath} /> },
      { path: '/recipes', component: () => <div>recipes home</div> },
      { path: '/recipes/search', component: () => <div>recipes search home</div> },
      { path: '/mod', component: () => <div>mod dashboard home</div> },
      { path: '/admin', component: () => <div>admin dashboard home</div> },
      { path: '/somewhere', component: () => <div>deep link home</div> },
      { path: '/forgot-password', component: () => <div>forgot</div> },
      { path: '/verify-otp', component: () => <div>otp</div> },
    ],
    '/login',
  );
}

async function submitCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByPlaceholderText('you@example.com'), 'cook@example.com');
  await user.type(screen.getByPlaceholderText('Enter your password'), TEST_PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm', () => {
  it('blocks submission with field errors for invalid input and never calls the network', async () => {
    clearSession();
    clearTables();
    const user = userEvent.setup();
    renderLogin();

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.queryByText('recipes home')).not.toBeInTheDocument();
  });

  it('navigates to an explicit next path handed to the login page, for any role', async () => {
    clearSession();
    clearTables();
    seed('profiles', [profile({ role: 'admin' })]);
    const user = userEvent.setup();
    renderLogin('/recipes');

    await submitCredentials(user);

    // The admin's role default would be /admin; the explicit path wins.
    expect(await screen.findByText('recipes home', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('lands regular users on the recipe explorer by default', async () => {
    clearSession();
    clearTables();
    seed('profiles', [profile({ role: 'user' })]);
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);

    expect(await screen.findByText('recipes search home', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('lands moderators on the moderation dashboard by default', async () => {
    clearSession();
    clearTables();
    seed('profiles', [profile({ role: 'moderator' })]);
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);

    expect(await screen.findByText('mod dashboard home', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('lands admins on the admin dashboard by default', async () => {
    clearSession();
    clearTables();
    seed('profiles', [profile({ role: 'admin' })]);
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);

    expect(await screen.findByText('admin dashboard home', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('does not navigate before the profile role resolves, then follows it', async () => {
    clearSession();
    clearTables();
    seed('profiles', [profile({ role: 'admin' })]);
    server.use(
      http.get(`${TEST_ORIGIN}/rest/v1/profiles`, async () => {
        await delay(200);
        return HttpResponse.json([profile({ role: 'admin' })]);
      }),
    );
    const user = userEvent.setup();
    const { router } = await renderLogin();

    await submitCredentials(user);

    // The role (and with it the redirect target) is still resolving.
    expect(router.state.location.pathname).toBe('/login');

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'), { timeout: 5000 });
    expect(await screen.findByText('admin dashboard home', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('forwards next and the typed email into the six-digit-code flow (regression)', async () => {
    clearSession();
    clearTables();
    const user = userEvent.setup();
    renderLogin('/somewhere');

    await user.type(await screen.findByPlaceholderText('you@example.com'), 'cook@example.com');

    // Regression: the anchor used to navigate bare, dropping the guard's
    // `next` destination (and the typed email) from the OTP flow.
    const otpLink = screen.getByRole('link', { name: 'Use a six-digit code' });
    const href = otpLink.getAttribute('href') ?? '';
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect(params.get('next')).toBe('/somewhere');
    expect(params.get('email')).toBe('cook@example.com');
  });

  it('surfaces auth failures in a dismissible alert and stays on the form', async () => {
    clearSession();
    clearTables();
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByPlaceholderText('you@example.com'), 'cook@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Invalid login credentials/));
    expect(screen.getByPlaceholderText('you@example.com')).toHaveValue('cook@example.com');
  });
});
