import { IconButton } from '../atoms/IconButton';
import { StatusIcon } from '../atoms/StatusIcon';
import { Timer } from './Timer';
import { TruncatedText } from '../atoms/TruncatedText';
import type { AgentStatus } from '../../../types';
import type { MouseEvent } from 'react';

const stopPropagation = (e: MouseEvent) => e.stopPropagation();

interface AgentTileProps {
  name: string;
  status: AgentStatus;
  lastPrompt: string | null;
  startedAt: number | null;
  onClick: () => void;
  onCloneClick: () => void;
  onStopClick: () => void;
  onRemoveClick: () => void;
  onClearClick: () => void;
}

export const AgentTile = ({
  name,
  status,
  lastPrompt,
  startedAt,
  onClick,
  onCloneClick,
  onStopClick,
  onRemoveClick,
  onClearClick,
}: AgentTileProps) => {
  return (
    <article className="agent-tile" onClick={onClick}>
      <div className="agent-tile-header">
        <StatusIcon status={status} />
        <span className="agent-tile-name">{name}</span>
        {status === 'running' && startedAt !== null && <Timer startedAt={startedAt} />}
      </div>
      <div className="agent-tile-prompt">
        <TruncatedText text={lastPrompt} />
      </div>
      <nav className="agent-tile-actions" onClick={stopPropagation}>
        <IconButton icon="copy" onClick={onCloneClick} title="Clone agent" />
        <IconButton icon="debug-stop" onClick={onStopClick} title="Stop agent" />
        <IconButton icon="trash" onClick={onRemoveClick} title="Remove agent" disabled={status === 'running'} />
        <IconButton icon="clear-all" onClick={onClearClick} title="Clear context" />
      </nav>
    </article>
  );
};
