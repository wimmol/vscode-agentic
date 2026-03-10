import { TabHeader } from '../shared/molecules/TabHeader';
import { RepoHeader } from '../shared/molecules/RepoHeader';
import { AgentTile } from '../shared/molecules/AgentTile';
import { EmptyState } from '../shared/atoms/EmptyState';
import type { RepoWithAgents } from '../../types';

interface AgentPanelViewProps {
  repos: RepoWithAgents[];
  expandedRepoIds: Set<string>;
  onRootClick: () => void;
  onAddRepoClick: () => void;
  onRepoRootClick: (repoId: string) => void;
  onAddAgentClick: (repoId: string) => void;
  onRemoveRepoClick: (repoId: string) => void;
  onToggleRepoClick: (repoId: string) => void;
  onAgentClick: (agentId: string) => void;
  onCloneAgentClick: (agentId: string) => void;
  onStopAgentClick: (agentId: string) => void;
  onRemoveAgentClick: (agentId: string) => void;
  onClearAgentClick: (agentId: string) => void;
}

export const AgentPanelView = ({
  repos,
  expandedRepoIds,
  onRootClick,
  onAddRepoClick,
  onRepoRootClick,
  onAddAgentClick,
  onRemoveRepoClick,
  onToggleRepoClick,
  onAgentClick,
  onCloneAgentClick,
  onStopAgentClick,
  onRemoveAgentClick,
  onClearAgentClick,
}: AgentPanelViewProps) => {
  return (
    <section className="agent-panel">
      <TabHeader onRootClick={onRootClick} onAddRepoClick={onAddRepoClick} />

      {repos.length === 0 ? (
        <EmptyState text="press + to add repo" />
      ) : (
        repos.map((repo) => (
          <section key={repo.repositoryId} className="repo-section">
            <RepoHeader
              name={repo.name}
              expanded={expandedRepoIds.has(repo.repositoryId)}
              onRootClick={() => onRepoRootClick(repo.repositoryId)}
              onAddAgentClick={() => onAddAgentClick(repo.repositoryId)}
              onRemoveClick={() => onRemoveRepoClick(repo.repositoryId)}
              onToggleClick={() => onToggleRepoClick(repo.repositoryId)}
            />

            {expandedRepoIds.has(repo.repositoryId) && (
              <div className="repo-agents">
                {repo.agents.length === 0 ? (
                  <EmptyState text="press + to add agent" />
                ) : (
                  repo.agents.map((agent) => (
                    <AgentTile
                      key={agent.agentId}
                      name={agent.name}
                      status={agent.status}
                      lastPrompt={agent.lastPrompt}
                      startedAt={agent.startedAt}
                      onClick={() => onAgentClick(agent.agentId)}
                      onCloneClick={() => onCloneAgentClick(agent.agentId)}
                      onStopClick={() => onStopAgentClick(agent.agentId)}
                      onRemoveClick={() => onRemoveAgentClick(agent.agentId)}
                      onClearClick={() => onClearAgentClick(agent.agentId)}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        ))
      )}
    </section>
  );
};
