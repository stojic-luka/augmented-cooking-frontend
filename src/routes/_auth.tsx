import { Box, Container } from '@mantine/core';
import { Outlet, createFileRoute } from '@tanstack/react-router';

function AuthLayout() {
  return (
    <Box mih="100dvh">
      <Container size="sm" py={{ base: 'xl', md: 80 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});
