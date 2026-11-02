import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  List,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { LuCheck, LuCoins, LuSparkles, LuX } from 'react-icons/lu';
import { useAuthUser } from '@features/auth/providers/user';
import { useBuyTokens, useRequestPlanChange, useSubscriptionPlans } from '../hooks';

const TOKEN_TOPUPS = [5000, 10000, 25000];

function priceLabel(cents: number): string {
  return cents === 0 ? 'Free' : `€${cents / 100}/month`;
}

export function SubscriptionPage() {
  const { profile } = useAuthUser();
  const plansQuery = useSubscriptionPlans();
  const requestPlanChange = useRequestPlanChange();
  const buyTokens = useBuyTokens();
  const [topup, setTopup] = useState('10000');

  // A tier's identity is its name (the rest of the page compares by name), so
  // dedupe by name: the query can return the same tier twice when the plans
  // table was seeded more than once. One row per tier, cheapest first for a
  // stable layout. (React Compiler memoizes this expression.)
  const seen = new Set<string>();
  const plans = (plansQuery.data ?? [])
    .filter((plan) => {
      const key = plan.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.price_minor - b.price_minor);

  const currentTier = profile?.subscription_tier ?? 'free';

  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Subscription</Title>
        <Text c="dimmed">
          You are on the{' '}
          <Text span fw={600}>
            {currentTier === 'premium' ? 'Premium' : 'Free'}
          </Text>{' '}
          plan.
          {profile && profile.tokens_remaining != null
            ? ` ${profile.tokens_remaining.toLocaleString()} tokens remaining.`
            : ''}
        </Text>
      </div>

      {plansQuery.isPending ? (
        <Group gap="lg" align="stretch">
          {[0, 1].map((index) => (
            <Skeleton key={index} h={260} radius="md" style={{ flex: 1, minWidth: 280 }} />
          ))}
        </Group>
      ) : plansQuery.isError ? (
        <Alert color="red" variant="light" title="Could not load plans">
          <Stack gap="sm">
            <Text size="sm">{plansQuery.error.message}</Text>
            <Button variant="light" color="red" size="sm" maw="fit-content" onClick={() => plansQuery.refetch()}>
              Retry
            </Button>
          </Stack>
        </Alert>
      ) : plans.length === 0 ? (
        <Text size="sm" c="dimmed">
          No plans are configured yet — the launch tiers appear once the plans table is provisioned.
        </Text>
      ) : (
        <Group align="stretch" gap="lg">
          {plans.map((plan) => {
            const isCurrent = plan.name.toLowerCase() === currentTier;
            return (
              <Card key={plan.id} style={{ flex: 1, minWidth: 280 }}>
                <Stack gap="sm" h="100%">
                  <Group justify="space-between">
                    <Text fw={600} size="xl">
                      {plan.name}
                    </Text>
                    {isCurrent ? <Badge color="brand">Current plan</Badge> : null}
                  </Group>
                  <Text fw={600} size="lg" c="brand">
                    {priceLabel(plan.price_minor)}
                  </Text>
                  <Text size="sm" c="dimmed" mb="sm">
                    {plan.description}
                  </Text>
                  <List
                    spacing="xs"
                    size="sm"
                    icon={
                      <ThemeIcon size={16} color="green" variant="light">
                        <LuCheck size={10} />
                      </ThemeIcon>
                    }
                  >
                    <List.Item>
                      {plan.ai_actions_per_day === null
                        ? 'Unlimited AI actions'
                        : `${plan.ai_actions_per_day} AI actions per day`}
                    </List.Item>
                    <List.Item>
                      {plan.tokens_per_month === null
                        ? 'No token quota needed'
                        : `${plan.tokens_per_month.toLocaleString()} tokens per month`}
                    </List.Item>
                    <List.Item>
                      {plan.name === 'Premium' ? 'Access to advanced AI models' : 'Economical AI models'}
                    </List.Item>
                  </List>

                  {!isCurrent ? (
                    <Button
                      mt="auto"
                      variant={plan.name === 'Premium' ? 'filled' : 'light'}
                      loading={requestPlanChange.isPending}
                      onClick={() => requestPlanChange.mutate(plan.id)}
                    >
                      {plan.name === 'Premium' ? 'Upgrade to Premium' : 'Switch to Free'}
                    </Button>
                  ) : (
                    <Text size="xs" c="dimmed" mt="auto">
                      Payment integration is a placeholder — the request is recorded, no charge happens yet.
                    </Text>
                  )}
                </Stack>
              </Card>
            );
          })}
        </Group>
      )}

      {currentTier === 'premium' ? (
        <Paper withBorder p="xl" radius={12}>
          <Stack gap="sm">
            <Group gap="sm">
              <ThemeIcon color="yellow" variant="light">
                <LuCoins size={18} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Buy extra tokens</Text>
                <Text size="sm" c="dimmed">
                  Top up your monthly quota when you run heavy on AI cooking.
                </Text>
              </div>
            </Group>
            <Group>
              <SegmentedControl value={topup} onChange={(value) => setTopup(value)} data={TOKEN_TOPUPS.map(String)} />
              <Button
                leftSection={<LuSparkles size={16} />}
                loading={buyTokens.isPending}
                onClick={() => buyTokens.mutate(Number(topup))}
              >
                Buy {Number(topup).toLocaleString()} tokens
              </Button>
            </Group>
            <Group gap={4} c="dimmed">
              <LuX size={12} />
              <Text size="xs" c="dimmed">
                No real payment happens — the request is recorded on the billing endpoint until payment is integrated.
              </Text>
            </Group>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
