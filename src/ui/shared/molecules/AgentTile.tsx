import { IconButton } from '../atoms/IconButton';
import { StatusIcon } from '../atoms/StatusIcon';
import { Timer } from './Timer';
import { ElapsedTime } from '../atoms/ElapsedTime';
import { TruncatedText } from '../atoms/TruncatedText';
import type { AgentStatus } from '../../../types';
import {
  AGENT_STATUS_CREATED,
  AGENT_STATUS_RUNNING,
  AGENT_STATUS_IDLE,
  AGENT_STATUS_ERROR,
} from '../../../constants/agent';

/** Maps every AgentStatus to its CSS modifier class. Ensures TypeScript catches missing statuses. */
const STATUS_CSS: Record<AgentStatus, string> = {
  [AGENT_STATUS_CREATED]: 'agent-tile--created',
  [AGENT_STATUS_RUNNING]: 'agent-tile--running',
  [AGENT_STATUS_IDLE]: 'agent-tile--idle',
  [AGENT_STATUS_ERROR]: 'agent-tile--error',
};
import { LABEL_REMOVE_AGENT } from '../../../constants/messages';
import { useCallback } from 'react';

interface AgentTileProps {
  agentId: string;
  name: string;
  status: AgentStatus;
  lastPrompt: string | null;
  startedAt: number | null;
  completedAt: number | null;
  isSelected: boolean;
  onClick: (agentId: string) => void;
  onRemoveClick: (agentId: string) => void;
}

export const AgentTile = ({
  agentId,
  name,
  status,
  lastPrompt,
  startedAt,
  completedAt,
  isSelected,
  onClick,
  onRemoveClick,
}: AgentTileProps) => {
  const handleClick = useCallback(() => onClick(agentId), [onClick, agentId]);
  const handleRemove = useCallback(() => onRemoveClick(agentId), [onRemoveClick, agentId]);

  const className = `agent-tile ${STATUS_CSS[status]}${isSelected ? ' agent-tile--selected' : ''}`;

  // Live timer when task is in progress (startedAt set, no completedAt yet).
  const showTimer = startedAt !== null && completedAt === null;
  // Static elapsed time when last task is complete.
  const showElapsed = startedAt !== null && completedAt !== null;

  return (
    <article className={className} onClick={handleClick} tabIndex={0}>
      <div className="agent-tile-header">
        <StatusIcon status={status} />
        <span className="agent-tile-name">{name}</span>
        {showTimer && <Timer startedAt={startedAt} />}
        {showElapsed && <ElapsedTime startedAt={startedAt} completedAt={completedAt} />}
      </div>
      <div className="agent-tile-prompt">
        <TruncatedText text={lastPrompt} />
      </div>
      <nav className="agent-tile-actions">
        <IconButton icon="trash" onClick={handleRemove} title={LABEL_REMOVE_AGENT} disabled={status === AGENT_STATUS_RUNNING} />
      </nav>
    </article>
  );
};
