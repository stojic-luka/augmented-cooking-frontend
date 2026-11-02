import { Group, Text } from '@mantine/core';
import { LuStar } from 'react-icons/lu';

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  withValueLabel?: boolean;
}

export function RatingStars({ value, onChange, size = 16, withValueLabel = false }: Readonly<RatingStarsProps>) {
  const interactive = typeof onChange === 'function';

  return (
    <Group gap={2} wrap="nowrap">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const starsPluralSuffix = star > 1 ? 's' : '';
        return (
          <LuStar
            key={star}
            size={size}
            fill={filled ? 'currentColor' : 'none'}
            style={{
              color: filled ? 'var(--warning)' : 'var(--border-strong)',
              cursor: interactive ? 'pointer' : 'default',
            }}
            onClick={interactive ? () => onChange?.(star) : undefined}
            onKeyDown={
              interactive
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onChange?.(star);
                    }
                  }
                : undefined
            }
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `Rate ${star} star${starsPluralSuffix}` : undefined}
            role={interactive ? 'button' : undefined}
          />
        );
      })}
      {withValueLabel ? (
        <Text size="sm" c="dimmed" ml={4}>
          {value.toFixed(1)}
        </Text>
      ) : null}
    </Group>
  );
}
