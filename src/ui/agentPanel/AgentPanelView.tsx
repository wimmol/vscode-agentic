import { TabHeader } from '../shared/molecules/TabHeader';
import { RepoSection } from './RepoSection';
import { EmptyState } from '../shared/atoms/EmptyState';
import type { RepoWithAgents } from '../../types';

interface AgentPanelViewProps {
  repos: RepoWithAgents[];
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
          <RepoSection
            key={repo.repositoryId}
            repo={repo}
            onRepoRootClick={() => onRepoRootClick(repo.repositoryId)}
            onAddAgentClick={() => onAddAgentClick(repo.repositoryId)}
            onRemoveRepoClick={() => onRemoveRepoClick(repo.repositoryId)}
            onToggleRepoClick={() => onToggleRepoClick(repo.repositoryId)}
            onAgentClick={onAgentClick}
            onCloneAgentClick={onCloneAgentClick}
            onStopAgentClick={onStopAgentClick}
            onRemoveAgentClick={onRemoveAgentClick}
            onClearAgentClick={onClearAgentClick}
          />
        ))
      )}
    </section>
  );
};
