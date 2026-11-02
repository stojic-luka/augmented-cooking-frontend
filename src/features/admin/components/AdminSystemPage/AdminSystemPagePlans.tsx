import { Card, Group, Loader, NumberInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useAdminPlans, useUpdatePlan } from '../../hooks';

export function AdminPlansSection() {
  const plansQuery = useAdminPlans();
  const updatePlan = useUpdatePlan();

  if (plansQuery.isPending) {
    return (
      <Stack gap="md">
        <Title order={3}>Subscription plans</Title>
        <Loader size="sm" />
      </Stack>
    );
  }

  if (plansQuery.isError) {
    return (
      <Stack gap="md">
        <Title order={3}>Subscription plans</Title>
        <Text size="sm" c="dimmed">
          {plansQuery.error.message} — create the `subscription_plans` table (see docs/DATABASE_REFERENCE.md) to edit plans
          here.
        </Text>
      </Stack>
    );
  }

  const adminPlans = plansQuery.data ?? [];

  return (
    <Stack gap="md">
      <Title order={3}>Subscription plans</Title>
      {adminPlans.map((plan) => (
        <Card key={plan.id}>
          <Stack gap="sm">
            <Group grow>
              <TextInput
                label="Name"
                defaultValue={plan.name}
                onBlur={(event) => updatePlan.mutate({ planId: plan.id, patch: { name: event.currentTarget.value } })}
              />
              <NumberInput
                label="Price (EUR cents)"
                defaultValue={plan.price_minor}
                onBlur={(event) =>
                  updatePlan.mutate({ planId: plan.id, patch: { price_minor: Number(event.currentTarget.value) || 0 } })
                }
              />
            </Group>
            <Group grow>
              <NumberInput
                label="AI actions / day (blank = unlimited)"
                defaultValue={plan.ai_actions_per_day ?? undefined}
                onBlur={(event) =>
                  updatePlan.mutate({
                    planId: plan.id,
                    patch: {
                      ai_actions_per_day: event.currentTarget.value === '' ? null : Number(event.currentTarget.value),
                    },
                  })
                }
              />
              <NumberInput
                label="Tokens / month (blank = unlimited)"
                defaultValue={plan.tokens_per_month ?? undefined}
                onBlur={(event) =>
                  updatePlan.mutate({
                    planId: plan.id,
                    patch: {
                      tokens_per_month: event.currentTarget.value === '' ? null : Number(event.currentTarget.value),
                    },
                  })
                }
              />
            </Group>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
