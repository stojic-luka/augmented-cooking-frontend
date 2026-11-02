import { Box, Loader } from '@mantine/core';

export function AdminSystemPagePending() {
  return (
    <Box py="xl" style={{ display: 'grid', placeItems: 'center' }}>
      <Loader size="lg" />
    </Box>
  );
}