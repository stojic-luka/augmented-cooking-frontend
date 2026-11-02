import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TbMailCheck, TbShieldCheck, TbUserPlus } from 'react-icons/tb';
import { AuthRouteShell } from './AuthRouteShell';

const HIGHLIGHTS = [
  { title: 'Quick setup', description: 'A name, email, and password.', icon: TbUserPlus, color: 'blue' },
  { title: 'Email verification', description: 'A six-digit code.', icon: TbMailCheck, color: 'orange' },
  { title: 'You stay in control', description: 'Your data stays yours.', icon: TbShieldCheck, color: 'green' },
];

describe('AuthRouteShell', () => {
  it('renders the header, badge, form card, and the highlights routes pass', () => {
    render(
      <AuthRouteShell title="Welcome back" description="Sign in to your kitchen." badgeLabel="Hello" highlights={HIGHLIGHTS}>
        <div>form body</div>
      </AuthRouteShell>,
    );

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your kitchen.')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('form body')).toBeInTheDocument();

    // Regression: routes pass `highlights`, but the shell used to accept
    // (and drop) nothing — the cards were missing from every auth page.
    expect(screen.getByText('Quick setup')).toBeInTheDocument();
    expect(screen.getByText('Email verification')).toBeInTheDocument();
    expect(screen.getByText('You stay in control')).toBeInTheDocument();
    expect(screen.getByText('A six-digit code.')).toBeInTheDocument();
  });

  it('renders without highlights or badge', () => {
    render(
      <AuthRouteShell title="Reset your password" description="Recovery flow.">
        <div>form body</div>
      </AuthRouteShell>,
    );

    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.queryByText('Quick setup')).not.toBeInTheDocument();
  });
});
