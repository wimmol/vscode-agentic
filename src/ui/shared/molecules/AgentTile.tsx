import { IconButton } from '../atoms/IconButton';
import { StatusIcon } from '../atoms/StatusIcon';
import { Timer } from './Timer';
import { TruncatedText } from '../atoms/TruncatedText';
import type { AgentStatus } from '../../../types';
import type { MouseEvent } from 'react';
import { useMemo } from 'react';

const stopPropagation = (e: MouseEvent) => e.stopPropagation();

interface AgentTileProps {
  name: string;
  status: AgentStatus;
  lastPrompt: string | null;
  startedAt: number | null;
  isSelected: boolean;
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
  isSelected,
  onClick,
  onCloneClick,
  onStopClick,
  onRemoveClick,
  onClearClick,
}: AgentTileProps) => {
  const [onAgentClick, className] = useMemo(() => {
    if (isSelected) {
      return [() => null, 'agent-tile agent-tile--selected'];
    }
    return [onClick, 'agent-tile'];
  }, [isSelected])
  return (
    <article className={className} onClick={onAgentClick} tabIndex={0}>
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
