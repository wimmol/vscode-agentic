import { IconButton } from '../atoms/IconButton';
import { StatusIcon } from '../atoms/StatusIcon';
import { Timer } from './Timer';
import { ElapsedTime } from '../atoms/ElapsedTime';
import { TruncatedText } from '../atoms/TruncatedText';
import type { AgentStatus } from '../../../types';
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
  onCloneClick: (agentId: string) => void;
  onStopClick: (agentId: string) => void;
  onRemoveClick: (agentId: string) => void;
  onClearClick: (agentId: string) => void;
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
  onCloneClick,
  onStopClick,
  onRemoveClick,
  onClearClick,
}: AgentTileProps) => {
  const handleClick = useCallback(() => onClick(agentId), [onClick, agentId]);
  const handleClone = useCallback(() => onCloneClick(agentId), [onCloneClick, agentId]);
  const handleStop = useCallback(() => onStopClick(agentId), [onStopClick, agentId]);
  const handleRemove = useCallback(() => onRemoveClick(agentId), [onRemoveClick, agentId]);
  const handleClear = useCallback(() => onClearClick(agentId), [onClearClick, agentId]);

  const className = isSelected ? 'agent-tile agent-tile--selected' : 'agent-tile';

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
        <IconButton icon="copy" onClick={handleClone} title="Clone agent" />
        <IconButton icon="debug-stop" onClick={handleStop} title="Stop agent" />
        <IconButton icon="trash" onClick={handleRemove} title="Remove agent" disabled={status === 'running'} />
        <IconButton icon="clear-all" onClick={handleClear} title="Clear context" />
      </nav>
    </article>
  );
};
