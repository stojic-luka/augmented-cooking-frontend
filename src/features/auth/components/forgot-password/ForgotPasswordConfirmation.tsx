import { Badge, Code, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { LuMailCheck } from 'react-icons/lu';

interface ForgotPasswordConfirmationProps {
  email?: string;
}

const RESET_LINK_EXPIRY = '1 hour';

export function ForgotPasswordConfirmation({ email }: Readonly<ForgotPasswordConfirmationProps>) {
  return (
    <Stack gap="md" align="center" ta="center" component="section" aria-live="polite">
      <ThemeIcon variant="light" color="green" size={56}>
        <LuMailCheck size={24} />
      </ThemeIcon>

      <Stack gap={4}>
        <Title order={3}>Check your inbox</Title>
        <Text size="sm" c="dimmed" maw={380}>
          We sent a password reset link to {email ? <Code>{email}</Code> : 'your email address'}.
        </Text>
      </Stack>

      <Badge variant="light" color="green">
        Email sent
      </Badge>

      <Text size="xs" c="dimmed" maw={400}>
        Click the link in the email to set a new password. The link expires in {RESET_LINK_EXPIRY}. Can't find it? Check your
        spam folder.
      </Text>
    </Stack>
  );
}
