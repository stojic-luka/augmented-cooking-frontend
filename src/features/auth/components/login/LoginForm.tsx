import { Alert, Anchor, Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { login } from '../../services';
import { roleStartPath } from '../../utils';
import { getErrorMessage } from '@/utils';
import { loginSchema, type LoginFormValues } from './schemas';

const FALLBACK_ERROR = 'Unable to sign in. Please try again.';

interface LoginFormProps {
  /** Explicit post-login destination from a guard's `next` param; wins over the role default. */
  nextPath?: string;
  notice?: string;
}

export function LoginForm({ nextPath, notice }: Readonly<LoginFormProps>) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    initialValues: {
      email: '',
      password: '',
    },
    validate: schemaResolver(loginSchema),
  });

  const handleSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    let target: string;
    try {
      // The role resolves from the fresh session's profile inside the login
      // service before any navigation, so a role default is never guessed.
      const signedIn = await login(values.email, values.password);
      target = nextPath ?? roleStartPath(signedIn.data.role);
    } catch (err) {
      // Navigation stays outside the try so a failed route transition
      // is not reported as a failed sign-in.
      setError(getErrorMessage(err, FALLBACK_ERROR));
      return;
    } finally {
      setIsLoading(false);
    }

    navigate({ to: target });
  };

  return (
    <Stack gap="md">
      {notice ? (
        <Alert variant="light">{notice}</Alert>
      ) : null}

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

          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isLoading}
            key={form.key('password')}
            {...form.getInputProps('password')}
          />

          <Group justify="space-between" align="center" gap="sm">
            <Anchor component={Link} to="/forgot-password" size="sm">
              Forgot password?
            </Anchor>
            <Anchor
              component="button"
              type="button"
              size="sm"
              onClick={() =>
                navigate({
                  to: '/verify-otp',
                  search: { email: form.values.email || undefined, next: nextPath },
                })
              }
            >
              Use a six-digit code
            </Anchor>
          </Group>

          <Button type="submit" fullWidth size="md" loading={isLoading}>
            Sign in
          </Button>

          <Text size="sm" c="dimmed" ta="center">
            Need an account?{' '}
            <Anchor component={Link} to="/sign-up">
              Create one
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Stack>
  );
}
