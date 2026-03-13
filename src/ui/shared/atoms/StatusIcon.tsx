import type { AgentStatus } from '../../../types';
import {
  AGENT_STATUS_CREATED,
  AGENT_STATUS_RUNNING,
  AGENT_STATUS_IDLE,
  AGENT_STATUS_ERROR,
} from '../../../constants/agent';

const STATUS_ICONS: Record<AgentStatus, string> = {
  [AGENT_STATUS_CREATED]: 'circle-outline',
  [AGENT_STATUS_RUNNING]: 'sync',
  [AGENT_STATUS_IDLE]: 'check',
  [AGENT_STATUS_ERROR]: 'error',
};

interface StatusIconProps {
  status: AgentStatus;
}

export const StatusIcon = ({ status }: StatusIconProps) => {
  const spin = status === AGENT_STATUS_RUNNING ? ' codicon-modifier-spin' : '';
  return (
    <i
      className={`codicon codicon-${STATUS_ICONS[status]}${spin}`}
      title={status}
      aria-label={status}
    />
  );
};
