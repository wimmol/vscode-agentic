import type { AgentStatus } from '../../../types';

const STATUS_ICONS: Record<AgentStatus, string> = {
  created: 'circle-outline',
  running: 'sync',
  idle: 'check',
  error: 'error',
};

interface StatusIconProps {
  status: AgentStatus;
}

export const StatusIcon = ({ status }: StatusIconProps) => {
  const spin = status === 'running' ? ' codicon-modifier-spin' : '';
  return (
    <i
      className={`codicon codicon-${STATUS_ICONS[status]}${spin}`}
      title={status}
      aria-label={status}
    />
  );
};
