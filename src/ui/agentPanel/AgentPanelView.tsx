import { TabHeader } from '../shared/molecules/TabHeader';
import { RepoSection } from './RepoSection';
import { EmptyAgents } from '../shared/atoms/EmptyAgents';
import type { RepoWithScopes, AgentTemplate } from '../../types';
import { LABEL_EMPTY_REPOS } from '../../constants/messages';

interface AgentPanelViewProps {
  repos: RepoWithScopes[];
  templates: AgentTemplate[];
  onRootClick: () => void;
  onAddRepoClick: () => void;
  onRepoRootClick: (repoId: string) => void;
  onRemoveRepoClick: (repoId: string) => void;
  onToggleRepoClick: (repoId: string) => void;
  onAgentClick: (agentId: string) => void;
  onRemoveAgentClick: (agentId: string) => void;
  onCloseWorktreeClick: (repoId: string, branch: string) => void;
  onSendPrompt: (agentId: string) => void;
  onRenameAgent: (agentId: string) => void;
  onRemoveQueueItem: (agentId: string, index: number) => void;
  onLaunchTemplate: (repoId: string, branch: string, templateId: string | null) => void;
  onManageTemplates: () => void;
  onNewWorktree: (repoId: string) => void;
  onMergeWorktree: (repoId: string, branch: string) => void;
  onSelectWorktree: (repoId: string, branch: string | null) => void;
}

export const AgentPanelView = ({
  repos,
  templates,
  onRootClick,
  onAddRepoClick,
  onRepoRootClick,
  onRemoveRepoClick,
  onToggleRepoClick,
  onAgentClick,
  onRemoveAgentClick,
  onCloseWorktreeClick,
  onSendPrompt,
  onRenameAgent,
  onRemoveQueueItem,
  onLaunchTemplate,
  onManageTemplates,
  onNewWorktree,
  onMergeWorktree,
  onSelectWorktree,
}: AgentPanelViewProps) => (
  <section className="agent-panel">
    <TabHeader onRootClick={onRootClick} onAddRepoClick={onAddRepoClick} />
    {repos.length === 0 ? (
      <EmptyAgents text={LABEL_EMPTY_REPOS} />
    ) : (
      repos.map((repo) => (
        <RepoSection
          key={repo.repositoryId}
          repo={repo}
          templates={templates}
          onRepoRootClick={() => onRepoRootClick(repo.repositoryId)}
          onRemoveRepoClick={() => onRemoveRepoClick(repo.repositoryId)}
          onToggleRepoClick={() => onToggleRepoClick(repo.repositoryId)}
          onAgentClick={onAgentClick}
          onRemoveAgentClick={onRemoveAgentClick}
          onCloseWorktreeClick={onCloseWorktreeClick}
          onSendPrompt={onSendPrompt}
          onRenameAgent={onRenameAgent}
          onRemoveQueueItem={onRemoveQueueItem}
          onLaunchTemplate={onLaunchTemplate}
          onManageTemplates={onManageTemplates}
          onNewWorktree={onNewWorktree}
          onMergeWorktree={onMergeWorktree}
          onSelectWorktree={onSelectWorktree}
        />
      ))
    )}
  </section>
);
