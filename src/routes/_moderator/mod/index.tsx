import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_moderator/mod/')({
  // The _moderator layout's beforeLoad has already verified session and role
  // by the time this child runs, so the redirect is unconditional.
  beforeLoad: () => {
    throw redirect({ to: '/mod/dashboard' });
  },
});
