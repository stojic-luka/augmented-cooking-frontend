import { Alert, Anchor, Button, Group, Stack, TextInput, type StackProps } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { requestPasswordReset } from '../../services';
import { getErrorMessage } from '@/utils';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from './schemas';

const FALLBACK_ERROR = 'We could not send the reset email. Please try again in a moment.';

export function ForgotPasswordForm({ className, ...props }: Readonly<StackProps>) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    initialValues: { email: '' },
    validate: schemaResolver(forgotPasswordSchema),
  });

  const handleSubmit = async ({ email }: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      await requestPasswordReset(email);
    } catch (err) {
      // Prefer the generic message unless known-safe Supabase error codes are
      // explicitly mapped to user-friendly copy.
      setError(getErrorMessage(err, FALLBACK_ERROR));
      return;
    } finally {
      setIsLoading(false);
    }

    navigate({ to: '/forgot-password/confirm', search: { email } });
  };

  return (
    <Stack className={className} gap="md" {...props}>
      {error ? (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      ) : null}

      <form noValidate onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Email"
            placeholder="you@example.com"
            type="email"
            withAsterisk
            autoComplete="email"
            data-autofocus
            disabled={isLoading}
            key={form.key('email')}
            {...form.getInputProps('email')}
          />

          <Button type="submit" fullWidth size="md" loading={isLoading}>
            Send reset email
          </Button>

          <Group justify="space-between" align="center" gap="sm">
            <Anchor component={Link} to="/login" size="sm">
              Back to login
            </Anchor>
            <Anchor component={Link} to="/verify-otp" size="sm">
              Use a verification code
            </Anchor>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
