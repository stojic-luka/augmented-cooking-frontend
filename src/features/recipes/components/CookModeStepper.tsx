import { useEffect, useState } from 'react';
import { Button, Group, Paper, Stack, Stepper, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LuChevronLeft, LuChevronRight, LuPlay } from 'react-icons/lu';

export interface CookStep {
  instruction: string;
}

interface CookModeStepperProps {
  steps: CookStep[];
}

export function CookModeStepper({ steps }: Readonly<CookModeStepperProps>) {
  const [active, setActive] = useState(0);
  const [isReading, setIsReading] = useState(false);

  // Stop any narration when leaving cook mode.
  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  const goToStep = (step: number) => {
    window.speechSynthesis.cancel();
    setIsReading(false);
    setActive(step);
  };

  const handleReadAloud = () => {
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(steps[active].instruction);
    utterance.onend = () => setIsReading(false);
    window.speechSynthesis.speak(utterance);
    setIsReading(true);
  };

  const handleFinish = () => {
    notifications.show({
      title: 'Cooking complete',
      message: 'Nice work! Enjoy your meal.',
      color: 'green',
    });
  };

  return (
    <Stack gap="xl">
      <Stepper
        active={active}
        onStepClick={goToStep}
        allowNextStepsSelect={false}
        size="sm"
        orientation="vertical"
        styles={{
          stepLabel: { fontSize: 'var(--mantine-font-size-xs)' },
          stepDescription: { fontSize: 'var(--mantine-font-size-xs)' },
        }}
      >
        {steps.map((_step, index) => (
          <Stepper.Step key={index} label={`Step ${index + 1}`} />
        ))}
      </Stepper>

      <Paper withBorder p="xl" radius={12}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={0}>
              <Text c="dimmed" size="xs" fw={600} tt="uppercase">
                Current Step {active + 1}/{steps.length}
              </Text>
              <Title order={3}>{`Step ${active + 1}`}</Title>
            </Stack>
            <Button
              variant="light"
              color="yellow"
              leftSection={<LuPlay size={16} fill="currentColor" />}
              size="xs"
              onClick={handleReadAloud}
            >
              {isReading ? 'Stop' : 'Read Aloud'}
            </Button>
          </Group>

          <Text size="lg" style={{ lineHeight: 1.6 }}>
            {steps[active].instruction}
          </Text>

          <Group justify="space-between" mt="xl">
            <Button
              variant="default"
              onClick={() => goToStep(Math.max(0, active - 1))}
              disabled={active === 0}
              leftSection={<LuChevronLeft size={16} />}
            >
              Previous
            </Button>
            {active === steps.length - 1 ? (
              <Button color="green" onClick={handleFinish}>
                Complete Cooking
              </Button>
            ) : (
              <Button
                rightSection={<LuChevronRight size={16} />}
                onClick={() => goToStep(Math.min(steps.length - 1, active + 1))}
              >
                Next Step
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
