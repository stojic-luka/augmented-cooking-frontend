import { Group, Image, Text } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { LuChefHat } from 'react-icons/lu';

interface BrandLogoProps {
  to?: string;
}
export function BrandLogo({ to = '/' }: Readonly<BrandLogoProps>) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }} aria-label="Augmented Cooking home">
      <Group gap="xs" wrap="nowrap">
        <LuChefHat size={24} color="var(--accent)" aria-hidden />
        <Text fw={700} size="14.5" style={{ letterSpacing: '0.04em' }} visibleFrom="xs">
          AUGMENTED COOKING
        </Text>
      </Group>
    </Link>
  );
}

interface BrandAvatarProps {
  url?: string | null;
  name: string;
}
export function BrandAvatar({ url, name }: Readonly<BrandAvatarProps>) {
  if (url) {
    return <Image src={url} alt={name} w={26} h={26} radius={999} fit="cover" />;
  }
  return (
    <Text size="sm" fw={700} c="brand" aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </Text>
  );
}
