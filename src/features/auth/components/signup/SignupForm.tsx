import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type ComponentPropsWithoutRef } from 'react';
import { signup } from '../../services';
import { getErrorMessage } from '@/utils';
import { PasswordStrength } from '../PasswordStrength';
import { signupSchema, type SignupFormValues } from './schemas';

const FALLBACK_ERROR = 'Unable to create your account. Please try again.';

export function SignupForm({ className, ...props }: Readonly<ComponentPropsWithoutRef<'div'>>) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupFormValues>({
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validate: schemaResolver(signupSchema),
  });

  const handleSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      await signup(values.email, values.password, values.username);
    } catch (err) {
      setError(getErrorMessage(err, FALLBACK_ERROR));
      return;
    } finally {
      setIsLoading(false);
    }

    navigate({ to: '/verify-otp', search: { email: values.email } });
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
            label="Display name"
            placeholder="e.g. Maria the home cook"
            withAsterisk
            disabled={isLoading}
            key={form.key('username')}
            {...form.getInputProps('username')}
          />

          <TextInput
            label="Email"
            placeholder="you@example.com"
            type="email"
            withAsterisk
            autoComplete="email"
            disabled={isLoading}
            key={form.key('email')}
            {...form.getInputProps('email')}
          />

          <PasswordInput
            label="Password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            disabled={isLoading}
            key={form.key('password')}
            {...form.getInputProps('password')}
          />

          <PasswordStrength password={form.values.password} />

          <PasswordInput
            label="Confirm password"
            placeholder="Repeat the password"
            autoComplete="new-password"
            disabled={isLoading}
            key={form.key('confirmPassword')}
            {...form.getInputProps('confirmPassword')}
          />

          <Button type="submit" fullWidth size="md" loading={isLoading} mt="xs">
            Create account
          </Button>

          <Text size="sm" c="dimmed" ta="center">
            Already have an account?{' '}
            <Anchor component={Link} to="/login">
              Sign in
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Stack>
  );
}
