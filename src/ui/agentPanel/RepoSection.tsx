import { RepoHeader } from '../shared/molecules/RepoHeader';
import { AgentTile } from '../shared/molecules/AgentTile';
import { EmptyState } from '../shared/atoms/EmptyState';
import type { RepoWithAgents } from '../../types';

interface RepoSectionProps {
  repo: RepoWithAgents;
  selectedAgentId: string | null;
  onRepoRootClick: () => void;
  onAddAgentClick: () => void;
  onRemoveRepoClick: () => void;
  onToggleRepoClick: () => void;
  onAgentClick: (agentId: string) => void;
  onCloneAgentClick: (agentId: string) => void;
  onStopAgentClick: (agentId: string) => void;
  onRemoveAgentClick: (agentId: string) => void;
  onClearAgentClick: (agentId: string) => void;
}

export const RepoSection = ({
  repo,
  selectedAgentId,
  onRepoRootClick,
  onAddAgentClick,
  onRemoveRepoClick,
  onToggleRepoClick,
  onAgentClick,
  onCloneAgentClick,
  onStopAgentClick,
  onRemoveAgentClick,
  onClearAgentClick,
}: RepoSectionProps) => {
  return (
    <section className="repo-section">
      <RepoHeader
        name={repo.name}
        expanded={repo.isExpanded}
        onRootClick={onRepoRootClick}
        onAddAgentClick={onAddAgentClick}
        onRemoveClick={onRemoveRepoClick}
        onToggleClick={onToggleRepoClick}
      />

      {repo.isExpanded && (
        <div className="repo-agents">
          {repo.agents.length === 0 ? (
            <EmptyState text="press + to add agent" />
          ) : (
            repo.agents.map((agent) => (
              <AgentTile
                key={agent.agentId}
                agentId={agent.agentId}
                name={agent.name}
                status={agent.status}
                lastPrompt={agent.lastPrompt}
                startedAt={agent.startedAt}
                isSelected={agent.agentId === selectedAgentId}
                onClick={onAgentClick}
                onCloneClick={onCloneAgentClick}
                onStopClick={onStopAgentClick}
                onRemoveClick={onRemoveAgentClick}
                onClearClick={onClearAgentClick}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
};
