import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LuArrowRight, LuCircleCheck, LuMailOpen } from 'react-icons/lu';
import { AuthRouteShell, ForgotPasswordConfirmation } from '@features/auth/components';

export const Route = createFileRoute('/_auth/forgot-password/confirm/')({
  validateSearch: z.object({ email: z.string().optional() }),
  component: ForgotPasswordConfirmRoute,
});

function ForgotPasswordConfirmRoute() {
  const { email } = Route.useSearch();

  return (
    <AuthRouteShell
      title="Password reset started"
      description="The recovery email is on the way. Use it to open the password update page and finish the flow."
      badgeLabel="Next step"
      highlights={[
        {
          title: 'Inbox check',
          description: 'Open the message sent to the address you entered.',
          icon: LuMailOpen,
          color: 'brand',
        },
        {
          title: 'Finish recovery',
          description: 'Use the reset link to reach the password update form.',
          icon: LuCircleCheck,
          color: 'green',
        },
        {
          title: 'Continue safely',
          description: 'Once the new password is saved, sign in again with the updated credentials.',
          icon: LuArrowRight,
          color: 'yellow',
        },
      ]}
    >
      <ForgotPasswordConfirmation email={email} />
    </AuthRouteShell>
  );
}