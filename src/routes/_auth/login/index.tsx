import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthRouteShell, LoginForm } from '@features/auth/components';

export const Route = createFileRoute('/_auth/login/')({
  validateSearch: z.object({
    next: z.string().optional(),
    message: z.string().optional(),
  }),
  component: LoginRoute,
});

const NOTICES: Record<string, string> = {
  'password-updated': 'Your password has been updated. Sign in with the new password.',
};

function LoginRoute() {
  const { next, message } = Route.useSearch();

  return (
    <AuthRouteShell
      title="Welcome back"
      description="Sign in to access your saved recipes, meal planner, shopping lists, and AI cooking assistant."
      badgeLabel="Augmented Cooking"
    >
      {/* Only a guard's `next` param is an explicit destination; without one,
          LoginForm falls back to the role's start page after sign-in. */}
      <LoginForm nextPath={next} notice={message ? NOTICES[message] : undefined} />
    </AuthRouteShell>
  );
}
