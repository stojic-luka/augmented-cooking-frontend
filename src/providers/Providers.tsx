import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { theme } from '@styles/mantine';
import { queryClient } from '@lib/query-client';
import { AuthUserProvider } from '@features/auth/providers/user';

interface ProvidersProps {
  children: ReactNode;
}
export default function Providers({ children }: Readonly<ProvidersProps>): ReactNode {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <ModalsProvider>
          <Notifications position="bottom-right" limit={5} />
          <AuthUserProvider>
            {children} {/**/}
          </AuthUserProvider>
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
