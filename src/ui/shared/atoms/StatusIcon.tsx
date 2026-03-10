import type { AgentStatus } from '../types';

const STATUS_ICONS: Record<AgentStatus, string> = {
  created: 'circle-outline',
  running: 'sync~spin',
  completed: 'check',
  error: 'error',
};

interface StatusIconProps {
  status: AgentStatus;
}

export const StatusIcon = ({ status }: StatusIconProps) => {
  return (
    <i
      className={`codicon codicon-${STATUS_ICONS[status]}`}
      title={status}
      aria-label={status}
    />
  );
};
