import { TabHeader } from '../shared/molecules/TabHeader';
import { RepoSection } from './RepoSection';
import { EmptyState } from '../shared/atoms/EmptyState';
import type { RepoWithZones } from '../../types';
import { LABEL_EMPTY_REPOS } from '../../constants/messages';

interface AgentPanelViewProps {
  repos: RepoWithZones[];
  onRootClick: () => void;
  onAddRepoClick: () => void;
  onRepoRootClick: (repoId: string) => void;
  onAddAgentClick: (repoId: string) => void;
  onRemoveRepoClick: (repoId: string) => void;
  onToggleRepoClick: (repoId: string) => void;
  onToggleZoneClick: (repoId: string, branch: string) => void;
  onAgentClick: (agentId: string) => void;
  onRemoveAgentClick: (agentId: string) => void;
  onCloseWorktreeClick: (repoId: string, branch: string) => void;
  onSendPrompt: (agentId: string) => void;
  onForkAgent: (agentId: string) => void;
  onRenameAgent: (agentId: string) => void;
  onRemoveQueueItem: (agentId: string, index: number) => void;
}

export const AgentPanelView = ({
  repos,
  onRootClick,
  onAddRepoClick,
  onRepoRootClick,
  onAddAgentClick,
  onRemoveRepoClick,
  onToggleRepoClick,
  onToggleZoneClick,
  onAgentClick,
  onRemoveAgentClick,
  onCloseWorktreeClick,
  onSendPrompt,
  onForkAgent,
  onRenameAgent,
  onRemoveQueueItem,
}: AgentPanelViewProps) => {
  return (
    <section className="agent-panel">
      <TabHeader onRootClick={onRootClick} onAddRepoClick={onAddRepoClick} />

      {repos.length === 0 ? (
        <EmptyState text={LABEL_EMPTY_REPOS} />
      ) : (
        repos.map((repo) => (
          <RepoSection
            key={repo.repositoryId}
            repo={repo}
            onRepoRootClick={() => onRepoRootClick(repo.repositoryId)}
            onAddAgentClick={() => onAddAgentClick(repo.repositoryId)}
            onRemoveRepoClick={() => onRemoveRepoClick(repo.repositoryId)}
            onToggleRepoClick={() => onToggleRepoClick(repo.repositoryId)}
            onToggleZoneClick={onToggleZoneClick}
            onAgentClick={onAgentClick}
            onRemoveAgentClick={onRemoveAgentClick}
            onCloseWorktreeClick={onCloseWorktreeClick}
            onSendPrompt={onSendPrompt}
            onForkAgent={onForkAgent}
            onRenameAgent={onRenameAgent}
            onRemoveQueueItem={onRemoveQueueItem}
          />
        ))
      )}
    </section>
  );
};
