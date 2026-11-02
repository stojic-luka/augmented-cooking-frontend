import { ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core';
import { LuMoon, LuSun } from 'react-icons/lu';

export function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tooltip label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <ActionIcon
        variant="default"
        size={28}
        radius={7}
        onClick={() => toggleColorScheme()}
        aria-label="Toggle color scheme"
      >
        {isDark ? <LuSun size={15} /> : <LuMoon size={15} />}
      </ActionIcon>
    </Tooltip>
  );
}
