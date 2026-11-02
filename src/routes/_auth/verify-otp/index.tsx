import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LuCircleCheck, LuKey, LuMail } from 'react-icons/lu';
import { AuthRouteShell, OtpVerificationForm } from '@features/auth/components';

export const Route = createFileRoute('/_auth/verify-otp/')({
  validateSearch: z.object({ email: z.string().optional(), next: z.string().optional() }),
  component: VerifyOtpRoute,
});

function VerifyOtpRoute() {
  const { email, next } = Route.useSearch();

  return (
    <AuthRouteShell
      title="Verify the six-digit code"
      description="Use the code from Supabase email verification or passwordless login to complete the session."
      badgeLabel="6-digit code"
      highlights={[
        {
          title: 'Email code',
          description: 'Enter the six-digit code that Supabase emailed to you.',
          icon: LuMail,
          color: 'brand',
        },
        {
          title: 'Verify account',
          description: 'Confirm a new signup or a passwordless request from the same inbox.',
          icon: LuCircleCheck,
          color: 'green',
        },
        {
          title: 'Resend on demand',
          description: 'If the code expired, request a fresh one without leaving the page.',
          icon: LuKey,
          color: 'yellow',
        },
      ]}
    >
      <OtpVerificationForm initialEmail={email} nextPath={next} />
    </AuthRouteShell>
  );
}