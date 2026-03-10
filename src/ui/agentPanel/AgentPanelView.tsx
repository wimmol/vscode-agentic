import { TabHeader } from '../shared/molecules/TabHeader';
import { RepoHeader } from '../shared/molecules/RepoHeader';
import { AgentTile } from '../shared/molecules/AgentTile';
import { EmptyState } from '../shared/atoms/EmptyState';
import type { Repo } from '../shared/types';

interface AgentPanelViewProps {
  repos: Repo[];
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
          <section key={repo.id} className="repo-section">
            <RepoHeader
              name={repo.name}
              expanded={repo.expanded}
              onRootClick={() => onRepoRootClick(repo.id)}
              onAddAgentClick={() => onAddAgentClick(repo.id)}
              onRemoveClick={() => onRemoveRepoClick(repo.id)}
              onToggleClick={() => onToggleRepoClick(repo.id)}
            />

            {repo.expanded && (
              <div className="repo-agents">
                {repo.agents.length === 0 ? (
                  <EmptyState text="press + to add agent" />
                ) : (
                  repo.agents.map((agent) => (
                    <AgentTile
                      key={agent.id}
                      name={agent.name}
                      status={agent.status}
                      lastPrompt={agent.lastPrompt}
                      startedAt={agent.startedAt}
                      onClick={() => onAgentClick(agent.id)}
                      onCloneClick={() => onCloneAgentClick(agent.id)}
                      onStopClick={() => onStopAgentClick(agent.id)}
                      onRemoveClick={() => onRemoveAgentClick(agent.id)}
                      onClearClick={() => onClearAgentClick(agent.id)}
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
