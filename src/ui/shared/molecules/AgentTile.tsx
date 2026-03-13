import { IconButton } from '../atoms/IconButton';
import { StatusIcon } from '../atoms/StatusIcon';
import { Timer } from './Timer';
import { TruncatedText } from '../atoms/TruncatedText';
import type { AgentStatus } from '../../../types';
import type { MouseEvent } from 'react';
import { useCallback } from 'react';

const stopPropagation = (e: MouseEvent) => e.stopPropagation();

interface AgentTileProps {
  agentId: string;
  name: string;
  status: AgentStatus;
  lastPrompt: string | null;
  startedAt: number | null;
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
  isSelected,
  onClick,
  onCloneClick,
  onStopClick,
  onRemoveClick,
  onClearClick,
}: AgentTileProps) => {
  const handleClick = useCallback(() => {
    if (!isSelected) onClick(agentId);
  }, [isSelected, onClick, agentId]);

  const handleClone = useCallback(() => onCloneClick(agentId), [onCloneClick, agentId]);
  const handleStop = useCallback(() => onStopClick(agentId), [onStopClick, agentId]);
  const handleRemove = useCallback(() => onRemoveClick(agentId), [onRemoveClick, agentId]);
  const handleClear = useCallback(() => onClearClick(agentId), [onClearClick, agentId]);

  const className = isSelected ? 'agent-tile agent-tile--selected' : 'agent-tile';

  return (
    <article className={className} onClick={handleClick} tabIndex={0}>
      <div className="agent-tile-header">
        <StatusIcon status={status} />
        <span className="agent-tile-name">{name}</span>
        {status === 'running' && startedAt !== null && <Timer startedAt={startedAt} />}
      </div>
      <div className="agent-tile-prompt">
        <TruncatedText text={lastPrompt} />
      </div>
      <nav className="agent-tile-actions" onClick={stopPropagation}>
        <IconButton icon="copy" onClick={handleClone} title="Clone agent" />
        <IconButton icon="debug-stop" onClick={handleStop} title="Stop agent" />
        <IconButton icon="trash" onClick={handleRemove} title="Remove agent" disabled={status === 'running'} />
        <IconButton icon="clear-all" onClick={handleClear} title="Clear context" />
      </nav>
    </article>
  );
};
