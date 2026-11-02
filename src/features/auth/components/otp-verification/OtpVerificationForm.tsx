import { Alert, Anchor, Button, Group, PinInput, Stack, Text, TextInput, type StackProps } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { sendOtp, verifyOtp } from '../../services';
import { getErrorMessage } from '@/utils';
import { otpVerificationSchema, type OtpVerificationFormValues } from './schemas';

const COPY = {
  verifyError: 'Unable to verify the code. Please try again.',
  sendError: 'Unable to send a verification code. Please try again.',
  emailRequired: 'Enter an email address before sending a code',
} as const;

const FALLBACK_NEXT_PATH = '/recipes';

interface OtpVerificationFormProps {
  initialEmail?: string;
  nextPath?: string;
}

export function OtpVerificationForm({
  initialEmail = '',
  nextPath = FALLBACK_NEXT_PATH,
  className,
  ...props
}: Readonly<OtpVerificationFormProps & StackProps>) {
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isBusy = isVerifying || isSending;

  const form = useForm<OtpVerificationFormValues>({
    initialValues: {
      email: initialEmail,
      token: '',
    },
    validate: schemaResolver(otpVerificationSchema),
  });

  const handleSubmit = async ({ email, token }: OtpVerificationFormValues) => {
    setIsVerifying(true);
    setError(null);

    try {
      await verifyOtp(email, token);
    } catch (err) {
      setError(getErrorMessage(err, COPY.verifyError));
      return;
    } finally {
      setIsVerifying(false);
    }

    navigate({ to: nextPath });
  };

  const handleSendCode = async () => {
    const email = form.values.email.trim();

    if (!email) {
      form.setFieldError('email', COPY.emailRequired);
      return;
    }

    setIsSending(true);
    setStatus(null);
    setError(null);

    try {
      await sendOtp(email);
      setStatus(`A fresh code was sent to ${email}.`);
    } catch (err) {
      setError(getErrorMessage(err, COPY.sendError));
    } finally {
      setIsSending(false); // this action never navigates — finally is correct here
    }
  };

  return (
    <Stack className={className} gap="md" {...props}>
      {status ? (
        <Alert color="green" variant="light" role="status">
          {status}
        </Alert>
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
            disabled={isBusy}
            key={form.key('email')}
            {...form.getInputProps('email')}
          />

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Verification code
            </Text>
            <PinInput
              key={form.key('token')}
              length={6}
              type="number"
              inputMode="numeric"
              size="md"
              disabled={isBusy}
              aria-label="Verification code"
              {...form.getInputProps('token')}
            />
          </Stack>

          <Button type="submit" fullWidth size="md" loading={isVerifying} disabled={isSending} mt="xs">
            Verify code
          </Button>

          <Button type="button" variant="subtle" onClick={handleSendCode} loading={isSending} disabled={isVerifying}>
            Send a fresh code
          </Button>

          <Group justify="space-between" align="center" gap="sm">
            <Anchor component={Link} to="/login" size="sm">
              Back to login
            </Anchor>
            <Anchor component={Link} to="/forgot-password" size="sm">
              Reset password instead
            </Anchor>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
