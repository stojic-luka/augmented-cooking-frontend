import { ActionIcon, Group, Popover, Stack, Switch, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { LuSettings2 } from 'react-icons/lu';

interface ChatOptionsPopoverProps {
  streamAnswer: boolean;
  onStreamAnswerChange: (streamAnswer: boolean) => void;
}

/**
 * Options popup left of the prompt box: the global stream-answer toggle.
 * A Popover (not a Menu) so the Switch is a real interactive control, and
 * toggling it keeps the panel open. Model selection lives in the header chip.
 */
export function ChatOptionsPopover({ streamAnswer, onStreamAnswerChange }: Readonly<ChatOptionsPopoverProps>) {
  const [opened, { open, close, toggle }] = useDisclosure(false);

  return (
    <Popover
      width={280}
      position="top-start"
      withinPortal
      opened={opened}
      onChange={(next) => (next ? open() : close())}
      closeOnClickOutside
      closeOnEscape
    >
      <Tooltip label="Chat options" openDelay={300}>
        <Popover.Target>
          {/* Centered on the textarea's midline; the composer Group bottom-aligns
              its other items, so this is the one exception. */}
          <ActionIcon variant="subtle" aria-label="Chat options" mb={4} onClick={toggle}>
            <LuSettings2 size={18} />
          </ActionIcon>
        </Popover.Target>
      </Tooltip>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text size="sm">Stream answer</Text>
            <Switch
              size="xs"
              aria-label="Stream answer"
              checked={streamAnswer}
              onChange={(event) => onStreamAnswerChange(event.currentTarget.checked)}
            />
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
