import { Group, Progress, Stack, Text, ThemeIcon } from '@mantine/core';
import { LuCheck, LuX } from 'react-icons/lu';

interface PasswordStrengthProps {
  password: string;
}

const REQUIREMENTS = [
  { label: '8+ characters', met: (password: string) => password.length >= 8 },
  { label: 'Uppercase', met: (password: string) => /[A-Z]/.test(password) },
  { label: 'Lowercase', met: (password: string) => /[a-z]/.test(password) },
  { label: 'Number', met: (password: string) => /\d/.test(password) },
  { label: 'Special', met: (password: string) => /[^A-Za-z0-9]/.test(password) },
] as const;

/** Live password meter shared by signup and password reset. Same red → green scale as before. */
export function PasswordStrength({ password }: Readonly<PasswordStrengthProps>) {
  const metCount = REQUIREMENTS.filter((requirement) => requirement.met(password)).length;
  // Five requirements: 0 met sits on gray, each met step climbs toward green —
  // indexing metCount directly (not metCount - 1) keeps a fully-met password
  // green instead of falling off the end of the scale.
  const color = (['gray', 'red', 'yellow', 'yellow', 'green'] as const)[metCount] ?? 'gray';

  return (
    <Stack gap={6}>
      <Progress value={metCount * 20} color={color} size={6} radius={999} transitionDuration={300} />
      <Group gap="xs" wrap="wrap">
        {REQUIREMENTS.map((requirement) => {
          const met = requirement.met(password);
          return (
            <Group key={requirement.label} gap={4} wrap="nowrap">
              <ThemeIcon size={16} radius="sm" variant={met ? 'filled' : 'light'} color={met ? 'green' : 'gray'}>
                {met ? <LuCheck size={9} /> : <LuX size={9} />}
              </ThemeIcon>
              <Text size="xs" c={met ? undefined : 'dimmed'}>
                {requirement.label}
              </Text>
            </Group>
          );
        })}
      </Group>
    </Stack>
  );
}