import { useState, useCallback, useMemo } from 'react';
import { IconButton } from '../atoms/IconButton';
import { StatusIcon } from '../atoms/StatusIcon';
import { Timer } from './Timer';
import { ElapsedTime } from '../atoms/ElapsedTime';
import { TruncatedText } from '../atoms/TruncatedText';
import type { AgentStatus, ContextUsage } from '../../../types';
import {
  AGENT_STATUS_CREATED,
  AGENT_STATUS_RUNNING,
  AGENT_STATUS_IDLE,
  AGENT_STATUS_ERROR,
} from '../../../constants/agent';
import {
  LABEL_REMOVE_AGENT,
  LABEL_SEND_PROMPT,
  LABEL_FORK_AGENT,
  LABEL_RENAME_AGENT,
  LABEL_REMOVE_QUEUE_ITEM,
  LABEL_QUEUED,
  LABEL_FORK,
} from '../../../constants/messages';
import { stripXmlTags } from '../../../utils/stripXmlTags';
import { formatCompact, contextLevel } from '../utils/formatContext';

/** Maps every AgentStatus to its CSS modifier class. */
const STATUS_CSS: Record<AgentStatus, string> = {
  [AGENT_STATUS_CREATED]: 'agent-tile--created',
  [AGENT_STATUS_RUNNING]: 'agent-tile--running',
  [AGENT_STATUS_IDLE]: 'agent-tile--idle',
  [AGENT_STATUS_ERROR]: 'agent-tile--error',
};

interface AgentTileProps {
  agentId: string;
  name: string;
  status: AgentStatus;
  lastPrompt: string | null;
  startedAt: number | null;
  completedAt: number | null;
  isSelected: boolean;
  templateName: string | null;
  outputSummary: string | null;
  forkedFrom: string | null;
  promptQueue: string[];
  contextUsage: ContextUsage | null;
  branch: string;
  worktreePath: string | null;
  onClick: (agentId: string) => void;
  onRemoveClick: (agentId: string) => void;
  onSendPrompt: (agentId: string) => void;
  onForkAgent: (agentId: string) => void;
  onRenameAgent: (agentId: string) => void;
  onRemoveQueueItem: (agentId: string, index: number) => void;
}

export const AgentTile = ({
  agentId,
  name,
  status,
  lastPrompt,
  startedAt,
  completedAt,
  isSelected,
  templateName,
  outputSummary,
  forkedFrom,
  promptQueue,
  contextUsage,
  branch,
  worktreePath,
  onClick,
  onRemoveClick,
  onSendPrompt,
  onForkAgent,
  onRenameAgent,
  onRemoveQueueItem,
}: AgentTileProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = useCallback(() => {
    onClick(agentId);
    setIsExpanded((prev) => !prev);
  }, [onClick, agentId]);

  const handleRemove = useCallback(() => onRemoveClick(agentId), [onRemoveClick, agentId]);
  const handleSendPrompt = useCallback(() => onSendPrompt(agentId), [onSendPrompt, agentId]);
  const handleFork = useCallback(() => onForkAgent(agentId), [onForkAgent, agentId]);
  const handleRename = useCallback(() => onRenameAgent(agentId), [onRenameAgent, agentId]);

  const className = `agent-tile ${STATUS_CSS[status]}${isSelected ? ' agent-tile--selected' : ''}`;

  const showTimer = startedAt !== null && completedAt === null;
  const showElapsed = startedAt !== null && completedAt !== null;

  const cleanPrompt = useMemo(() => lastPrompt ? stripXmlTags(lastPrompt) : null, [lastPrompt]);
  const cleanSummary = useMemo(() => outputSummary ? stripXmlTags(outputSummary) : null, [outputSummary]);

  const ctxLevel = contextUsage ? contextLevel(contextUsage.used, contextUsage.total) : null;
  const ctxText = contextUsage
    ? `${formatCompact(contextUsage.used)} / ${formatCompact(contextUsage.total)}`
    : null;
  const ctxPct = contextUsage ? (contextUsage.used / contextUsage.total) * 100 : 0;

  const summaryIsError = status === AGENT_STATUS_ERROR;

  return (
    <article className={className} onClick={handleClick} tabIndex={0}>
      <div className="agent-tile-header">
        <StatusIcon status={status} />
        <span className="agent-tile-name">{name}</span>
        {templateName && <span className="template-badge">{templateName}</span>}
        {forkedFrom && <span className="fork-badge">{LABEL_FORK}</span>}
        {promptQueue.length > 0 && (
          <span className="queue-badge">{promptQueue.length} {LABEL_QUEUED}</span>
        )}
        {ctxText && (
          <span className={`context-usage context-usage--${ctxLevel}`}>{ctxText}</span>
        )}
        {showTimer && <Timer startedAt={startedAt} />}
        {showElapsed && <ElapsedTime startedAt={startedAt} completedAt={completedAt} />}
      </div>

      <div className="agent-tile-prompt">
        <TruncatedText text={cleanPrompt} />
      </div>

      {cleanSummary && (
        <div className={`agent-summary${summaryIsError ? ' agent-summary--error' : ''}`}>
          <i className={`codicon codicon-${summaryIsError ? 'warning' : 'arrow-right'}`} />
          <span className="summary-text">{cleanSummary}</span>
        </div>
      )}

      {contextUsage && (
        <div className="context-bar">
          <div
            className={`context-bar-fill context-bar-fill--${ctxLevel}`}
            style={{ width: `${Math.min(ctxPct, 100)}%` }}
          />
        </div>
      )}

      {isExpanded && (
        <div className="agent-detail">
          <div className="detail-row">
            <span className="detail-label">Branch</span>
            <span className="detail-value">{branch}</span>
          </div>
          {worktreePath && (
            <div className="detail-row">
              <span className="detail-label">Worktree</span>
              <span className="detail-value">{worktreePath}</span>
            </div>
          )}
          {contextUsage && (
            <div className="detail-row">
              <span className="detail-label">Context</span>
              <span className={`detail-value${ctxLevel !== 'normal' ? ` context-usage--${ctxLevel}` : ''}`}>
                {contextUsage.used.toLocaleString()} / {contextUsage.total.toLocaleString()} tokens ({Math.round(ctxPct)}%)
              </span>
            </div>
          )}
          {lastPrompt && (
            <div className="detail-row">
              <span className="detail-label">Prompt</span>
              <span className="detail-value detail-value--wrap">{cleanPrompt}</span>
            </div>
          )}

          {promptQueue.length > 0 && (
            <div className="queue-list">
              {promptQueue.map((item, i) => (
                <div key={`${i}-${item.slice(0, 30)}`} className="queue-item">
                  <span className="queue-num">{i + 1}.</span>
                  <span className="queue-text">{stripXmlTags(item)}</span>
                  <button
                    className="queue-remove"
                    onClick={(e) => { e.stopPropagation(); onRemoveQueueItem(agentId, i); }}
                    title={LABEL_REMOVE_QUEUE_ITEM}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="detail-actions">
            <button className="detail-btn" onClick={(e) => { e.stopPropagation(); handleSendPrompt(); }}>
              <i className="codicon codicon-edit" /> {LABEL_SEND_PROMPT}
            </button>
            <button
              className={`detail-btn${ctxLevel === 'warn' || ctxLevel === 'danger' ? ' detail-btn--warn' : ''}`}
              onClick={(e) => { e.stopPropagation(); handleFork(); }}
            >
              <i className="codicon codicon-repo-forked" /> {LABEL_FORK_AGENT}
            </button>
            <button className="detail-btn" onClick={(e) => { e.stopPropagation(); handleRename(); }}>
              <i className="codicon codicon-pencil" /> {LABEL_RENAME_AGENT}
            </button>
          </div>
        </div>
      )}

      <nav className="agent-tile-actions">
        <IconButton icon="trash" onClick={handleRemove} title={LABEL_REMOVE_AGENT} disabled={status === AGENT_STATUS_RUNNING} />
      </nav>
    </article>
  );
};
