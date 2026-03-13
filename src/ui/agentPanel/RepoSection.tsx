import { RepoHeader } from '../shared/molecules/RepoHeader';
import { AgentTile } from '../shared/molecules/AgentTile';
import { EmptyState } from '../shared/atoms/EmptyState';
import type { RepoWithAgents } from '../../types';
import { LABEL_EMPTY_AGENTS } from '../../constants/messages';

interface RepoSectionProps {
  repo: RepoWithAgents;
  selectedAgentId: string | null;
  onRepoRootClick: () => void;
  onAddAgentClick: () => void;
  onRemoveRepoClick: () => void;
  onToggleRepoClick: () => void;
  onAgentClick: (agentId: string) => void;
  onRemoveAgentClick: (agentId: string) => void;
}

export const RepoSection = ({
  repo,
  selectedAgentId,
  onRepoRootClick,
  onAddAgentClick,
  onRemoveRepoClick,
  onToggleRepoClick,
  onAgentClick,
  onRemoveAgentClick,
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
            <EmptyState text={LABEL_EMPTY_AGENTS} />
          ) : (
            repo.agents.map((agent) => (
              <AgentTile
                key={agent.agentId}
                agentId={agent.agentId}
                name={agent.name}
                status={agent.status}
                lastPrompt={agent.lastPrompt}
                startedAt={agent.startedAt}
                completedAt={agent.completedAt}
                isSelected={agent.agentId === selectedAgentId}
                onClick={onAgentClick}
                onRemoveClick={onRemoveAgentClick}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
};
