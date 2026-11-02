import { createFileRoute } from '@tanstack/react-router';
import { LuMailCheck, LuShieldCheck, LuUserPlus } from 'react-icons/lu';
import { AuthRouteShell, SignupForm } from '@features/auth/components';

export const Route = createFileRoute('/_auth/sign-up/')({
  component: () => (
    <AuthRouteShell
      title="Create your account"
      description="Join Augmented Cooking with an email, password, and a verification step that can also support a six-digit code flow."
      badgeLabel="Account setup"
      highlights={[
        {
          title: 'Quick setup',
          description: 'A display name, email, and a strong password are all it takes.',
          icon: LuUserPlus,
          color: 'brand',
        },
        {
          title: 'Email verification',
          description: 'Confirm your address with a six-digit code right after signing up.',
          icon: LuMailCheck,
          color: 'yellow',
        },
        {
          title: 'You stay in control',
          description: 'Your recipes, plans, and lists stay private to your account.',
          icon: LuShieldCheck,
          color: 'green',
        },
      ]}
    >
      <SignupForm />
    </AuthRouteShell>
  ),
});