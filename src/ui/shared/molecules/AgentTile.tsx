import { memo, useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { TemplateLabel } from '../atoms/TemplateLabel';
import { ContextBadge } from '../atoms/ContextBadge';
import { Timer } from './Timer';
import { ElapsedTime } from '../atoms/ElapsedTime';
import { TileActions } from './TileActions';
import type { AgentStatus, ContextUsage } from '../../../types';
import {
  AGENT_STATUS_RUNNING,
  AGENT_STATUS_IDLE,
  AGENT_STATUS_ERROR,
} from '../../../constants/agent';
import { LABEL_REMOVE_QUEUE_ITEM } from '../../../constants/messages';
import { stripXmlTags } from '../../../utils/stripXmlTags';

/** Derive the tile's state modifier class from the agent status. */
const STATUS_CLS: Record<AgentStatus, string> = {
  created: '',
  running: 'tile--running',
  idle:    'tile--idle',
  error:   'tile--err',
};

interface AgentTileProps {
  agentId: string;
  name: string;
  status: AgentStatus;
  lastPrompt: string | null;
  /** Short version of `lastPrompt` produced by the local summariser. When
   *  present, rendered in place of `lastPrompt`. */
  lastPromptShort: string | null;
  startedAt: number | null;
  completedAt: number | null;
  isSelected: boolean;
  templateName: string | null;
  templateColor: string | null;
  outputSummary: string | null;
  /** Short version of `outputSummary`, same rules. */
  outputShort: string | null;
  promptQueue: string[];
  contextUsage: ContextUsage | null;
  onClick: (agentId: string) => void;
  onRemoveClick: (agentId: string) => void;
  onSendPrompt: (agentId: string) => void;
  onRenameAgent: (agentId: string) => void;
  onRemoveQueueItem: (agentId: string, index: number) => void;
}

const AgentTileImpl = ({
  agentId,
  name,
  status,
  lastPrompt,
  lastPromptShort,
  startedAt,
  completedAt,
  isSelected,
  templateName,
  templateColor,
  outputSummary,
  outputShort,
  promptQueue,
  contextUsage,
  onClick,
  onRemoveClick,
  onSendPrompt,
  onRenameAgent,
  onRemoveQueueItem,
}: AgentTileProps) => {
  const handleClick = useCallback(() => onClick(agentId), [onClick, agentId]);
  const handleRemove = useCallback(() => onRemoveClick(agentId), [onRemoveClick, agentId]);
  const handleSendPrompt = useCallback(() => onSendPrompt(agentId), [onSendPrompt, agentId]);
  const handleRename = useCallback(() => onRenameAgent(agentId), [onRenameAgent, agentId]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick(agentId);
      }
    },
    [onClick, agentId],
  );

  const promptSource = lastPromptShort ?? lastPrompt;
  const summarySource = outputShort ?? outputSummary;
  const isPromptSummarised = lastPromptShort !== null;
  const isOutputSummarised = outputShort !== null;

  const cleanPrompt = useMemo(
    () => (promptSource ? stripXmlTags(promptSource) : null),
    [promptSource],
  );
  const cleanSummary = useMemo(
    () => (summarySource ? stripXmlTags(summarySource) : null),
    [summarySource],
  );

  const isRunning = status === AGENT_STATUS_RUNNING;
  const showTimer = isRunning && startedAt !== null;
  const showDuration =
    (status === AGENT_STATUS_IDLE || status === AGENT_STATUS_ERROR) &&
    startedAt !== null &&
    completedAt !== null;

  const hasResult = !isRunning && cleanSummary !== null;

  const className = [
    'tile',
    STATUS_CLS[status],
    isSelected ? 'tile--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const mainTextClassName = [
    'tile__text',
    hasResult ? 'tile__text--result' : '',
    status === AGENT_STATUS_ERROR && hasResult ? 'tile__text--err' : '',
    hasResult
      ? isOutputSummarised ? 'tile__text--summarised' : ''
      : isPromptSummarised ? 'tile__text--summarised' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const mainText = hasResult ? cleanSummary : cleanPrompt;

  return (
    <article
      className={className}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
    >
      <div className="tile__rail" aria-hidden />
      <div className="tile__body">
        <div className="tile__row-top">
          {templateName && <TemplateLabel name={templateName} color={templateColor} />}
          <span className="tile__name">{name}</span>
          {showTimer && startedAt !== null && <Timer startedAt={startedAt} />}
          {showDuration && startedAt !== null && completedAt !== null && (
            <ElapsedTime startedAt={startedAt} completedAt={completedAt} />
          )}
        </div>

        {hasResult && cleanPrompt && (
          <div className="tile__prompt-line">{cleanPrompt}</div>
        )}

        <div className="tile__content">
          <div className={mainTextClassName}>{mainText}</div>
          <ContextBadge usage={contextUsage} />
        </div>

        {promptQueue.length > 0 && (
          <div className="queue-rows">
            {promptQueue.map((item, i) => (
              <div key={`${agentId}:q:${i}:${item}`} className="queue-rows__row">
                <span className="queue-rows__idx">{i + 1}</span>
                <span className="queue-rows__txt">{stripXmlTags(item)}</span>
                <button
                  type="button"
                  className="queue-rows__x"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveQueueItem(agentId, i);
                  }}
                  title={LABEL_REMOVE_QUEUE_ITEM}
                >
                  <i className="codicon codicon-close" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <TileActions
        onSendPrompt={handleSendPrompt}
        onRename={handleRename}
        onRemove={handleRemove}
        canRemove={!isRunning}
      />
    </article>
  );
};

export const AgentTile = memo(AgentTileImpl);
