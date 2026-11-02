import { Alert, Anchor, Button, PasswordInput, Stack, Text } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type ComponentPropsWithoutRef } from 'react';
import { updatePassword } from '../../services';
import { getErrorMessage } from '@/utils';
import { PasswordStrength } from '../PasswordStrength';
import { passwordResetSchema, type PasswordResetFormValues } from './schemas';

const FALLBACK_ERROR = 'Unable to save your new password. Please try again.';

export function PasswordResetForm({ className, ...props }: Readonly<ComponentPropsWithoutRef<'div'>>) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PasswordResetFormValues>({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    validate: schemaResolver(passwordResetSchema),
  });

  const handleSubmit = async (values: PasswordResetFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      await updatePassword(values.password);
    } catch (err) {
      setError(getErrorMessage(err, FALLBACK_ERROR));
      return;
    } finally {
      setIsLoading(false);
    }

    navigate({ to: '/login', search: { message: 'password-updated' } });
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
          <PasswordInput
            label="New password"
            placeholder="Create a new password"
            autoComplete="new-password"
            disabled={isLoading}
            key={form.key('password')}
            {...form.getInputProps('password')}
          />

          <PasswordStrength password={form.values.password} />

          <PasswordInput
            label="Confirm new password"
            placeholder="Repeat the password"
            autoComplete="new-password"
            disabled={isLoading}
            key={form.key('confirmPassword')}
            {...form.getInputProps('confirmPassword')}
          />

          <Button type="submit" fullWidth size="md" loading={isLoading} mt="xs">
            Save new password
          </Button>

          <Text size="sm" c="dimmed" ta="center">
            Need to return later?{' '}
            <Anchor component={Link} to="/login">
              Back to login
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Stack>
  );
}
