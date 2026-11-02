import { createFileRoute } from '@tanstack/react-router';
import { LuLock, LuMail, LuShieldCheck } from 'react-icons/lu';
import { AuthRouteShell, ForgotPasswordForm } from '@features/auth/components';

export const Route = createFileRoute('/_auth/forgot-password/')({
  component: () => (
    <AuthRouteShell
      title="Reset your password"
      description="We will send a recovery email that can complete the reset flow and move you into the update-password page."
      badgeLabel="Recovery"
      highlights={[
        {
          title: 'Reset request',
          description: 'Send a secure password reset email to the address on file.',
          icon: LuMail,
          color: 'brand',
        },
        {
          title: 'Recovery session',
          description: 'The reset link can establish a temporary session for password updates.',
          icon: LuLock,
          color: 'yellow',
        },
        {
          title: 'Account safe',
          description: 'Only the person with inbox access can continue the reset.',
          icon: LuShieldCheck,
          color: 'green',
        },
      ]}
    >
      <ForgotPasswordForm />
    </AuthRouteShell>
  ),
});