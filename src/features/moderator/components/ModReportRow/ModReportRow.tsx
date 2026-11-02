import { useState, type ComponentType, type ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Code,
  CopyButton,
  Divider,
  Group,
  Menu,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { LuCheck, LuChevronDown, LuCopy, LuEye, LuShieldCheck, LuX } from 'react-icons/lu';
import type { ModReport } from '../../services';
import type { PublicReportStatus } from '@/types/schemas';

type SettableReportStatus = Exclude<PublicReportStatus, 'open'>;

interface ModReportRowProps {
  report: ModReport;
  /** Called after the mod has picked (and, if needed, confirmed) a status. */
  onSetStatus: (status: SettableReportStatus) => void;
}

interface StatusOption {
  value: SettableReportStatus;
  label: string;
  description: string;
  color: string;
  /** Queue-removing statuses require an explicit confirmation. */
  confirm: boolean;
  icon: ComponentType<{ size?: number | string }>;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'reviewed',
    label: 'Reviewed',
    description: 'Seen and acknowledged — no action taken yet.',
    color: 'blue',
    confirm: false,
    icon: LuEye,
  },
  {
    value: 'actioned',
    label: 'Actioned',
    description: 'Action was taken on the reported content.',
    color: 'red',
    confirm: true,
    icon: LuShieldCheck,
  },
  {
    value: 'dismissed',
    label: 'Dismissed',
    description: 'The report is not a violation.',
    color: 'gray',
    confirm: true,
    icon: LuX,
  },
];

/** One label / value line inside the report details modal. */
function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Group gap={4} wrap="nowrap" justify="flex-end" style={{ minWidth: 0 }}>
        {children}
      </Group>
    </Group>
  );
}

/** Single reported-content row in the moderation report queue. */
export function ModReportRow({ report, onSetStatus }: Readonly<ModReportRowProps>) {
  const [targetInfoOpen, setTargetInfoOpen] = useState(false);
  const targetId = report.target_type === 'recipe' ? report.recipe_id : report.review_id;

  const requestStatusChange = (option: StatusOption) => {
    if (!option.confirm) {
      onSetStatus(option.value);
      return;
    }

    modals.openConfirmModal({
      title: `Mark report as “${option.label}”?`,
      children: (
        <Stack gap="xs">
          <Text size="sm">{option.description}</Text>
          <Text size="xs" c="dimmed">
            The report will leave the open queue — double-check the details before confirming.
          </Text>
        </Stack>
      ),
      labels: { confirm: `Mark as ${option.label}`, cancel: 'Cancel' },
      confirmProps: { color: option.color },
      onConfirm: () => onSetStatus(option.value),
    });
  };

  return (
    <Paper withBorder p="md" radius={12}>
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Badge size="xs">{report.target_type}</Badge>
            <Text size="xs" c="dimmed">
              {targetId?.slice(0, 8) ?? 'Target id'}…
            </Text>
          </Group>
          <Text size="sm">{report.reason}</Text>
          <Text size="xs" c="dimmed">
            reported {new Date(report.created_at).toLocaleDateString()}
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Button variant="subtle" size="xs" onClick={() => setTargetInfoOpen(true)}>
            View target
          </Button>
          <Menu width={280} position="bottom-end" withinPortal>
            <Menu.Target>
              <Button variant="subtle" size="xs" rightSection={<LuChevronDown size={14} />}>
                Set status
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Mark this report</Menu.Label>
              {STATUS_OPTIONS.map((option) => (
                <Menu.Item
                  key={option.value}
                  leftSection={<option.icon size={14} />}
                  color={option.color}
                  onClick={() => requestStatusChange(option)}
                >
                  <Stack gap={2}>
                    <Text size="sm" lh={1.25}>
                      {option.label}
                    </Text>
                  </Stack>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Modal opened={targetInfoOpen} onClose={() => setTargetInfoOpen(false)} title="Report details" centered>
        <Stack gap="md">
          <Group gap="xs">
            <Badge size="sm" variant="light">
              {report.target_type}
            </Badge>
            <Badge size="sm" variant="light" color={report.status === 'open' ? 'orange' : 'green'}>
              {report.status}
            </Badge>
          </Group>

          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Reason
            </Text>
            <Text size="sm">{report.reason}</Text>
          </Stack>

          <Divider />

          <Stack gap={8}>
            <MetaRow label="Reported">
              <Text size="sm">{new Date(report.created_at).toLocaleString()}</Text>
            </MetaRow>

            <MetaRow label="Target id">
              {targetId ? (
                <>
                  <Code fz="xs">{targetId}</Code>
                  <CopyButton value={targetId}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color={copied ? 'teal' : 'gray'}
                          onClick={copy}
                          aria-label="Copy target id"
                        >
                          {copied ? <LuCheck size={14} /> : <LuCopy size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  Unknown
                </Text>
              )}
            </MetaRow>

            <MetaRow label="Report id">
              <Code fz="xs">{report.id}</Code>
            </MetaRow>
          </Stack>

          <Text size="xs" c="dimmed">
            {report.target_type === 'recipe'
              ? 'Open the recipe page and check its content before deciding.'
              : 'Open the recipe this review belongs to and read it in full context.'}
          </Text>
        </Stack>
      </Modal>
    </Paper>
  );
}
