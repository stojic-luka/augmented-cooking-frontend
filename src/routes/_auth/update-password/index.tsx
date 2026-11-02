import { createFileRoute } from '@tanstack/react-router';
import { LuCircleCheck, LuKeyRound, LuShieldCheck } from 'react-icons/lu';
import { AuthRouteShell, PasswordResetForm } from '@features/auth/components';

export const Route = createFileRoute('/_auth/update-password/')({
  component: () => (
    <AuthRouteShell
      title="Update your password"
      description="Set a new password after a recovery email or a verified session has been established."
      badgeLabel="Recovery session"
      highlights={[
        {
          title: 'Strong password',
          description: 'Use a long, unique password that meets the complexity policy.',
          icon: LuKeyRound,
          color: 'brand',
        },
        {
          title: 'Session-aware',
          description: 'The recovery session can safely update the password without re-login.',
          icon: LuCircleCheck,
          color: 'green',
        },
        {
          title: 'Back to sign in',
          description: 'After saving, you can immediately return to the login flow.',
          icon: LuShieldCheck,
          color: 'yellow',
        },
      ]}
    >
      <PasswordResetForm />
    </AuthRouteShell>
  ),
});