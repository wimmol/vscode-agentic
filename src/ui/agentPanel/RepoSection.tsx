import { useMemo } from 'react';
import { RepoHeader } from '../shared/molecules/RepoHeader';
import { LaunchRow, type LaunchTemplate } from '../shared/molecules/LaunchRow';
import { WorktreeTabs } from '../shared/molecules/WorktreeTabs';
import { AgentTile } from '../shared/molecules/AgentTile';
import { EmptyAgents } from '../shared/atoms/EmptyAgents';
import { EmptyWorktree } from '../shared/atoms/EmptyWorktree';
import type { RepoWithScopes, Agent, AgentTemplate } from '../../types';

interface AgentCallbacks {
  onAgentClick: (agentId: string) => void;
  onRemoveAgentClick: (agentId: string) => void;
  onSendPrompt: (agentId: string) => void;
  onRenameAgent: (agentId: string) => void;
  onRemoveQueueItem: (agentId: string, index: number) => void;
}

interface RepoSectionProps extends AgentCallbacks {
  repo: RepoWithScopes;
  /** Global template list — same for every repo. */
  templates: AgentTemplate[];
  onRepoRootClick: () => void;
  onRemoveRepoClick: () => void;
  onToggleRepoClick: () => void;
  onCloseWorktreeClick: (repoId: string, branch: string) => void;
  /** One-click launch. Caller already resolved the scope's branch. */
  onLaunchTemplate: (repoId: string, branch: string, templateId: string | null) => void;
  onManageTemplates: () => void;
  onNewWorktree: (repoId: string) => void;
  onMergeWorktree: (repoId: string, branch: string) => void;
  onSelectWorktree: (repoId: string, branch: string | null) => void;
}

const toLaunchTemplates = (templates: AgentTemplate[]): LaunchTemplate[] =>
  templates.map((t) => ({
    templateId: t.templateId,
    name: t.name,
    color: t.color,
    isDefault: t.isDefault,
  }));

interface ScopeBodyProps extends AgentCallbacks {
  agents: Agent[];
  launchTemplates: LaunchTemplate[];
  onLaunch: (templateId: string | null) => void;
  onManage: () => void;
}

/** Launch row + agent tiles (or the empty-state one-liner) — rendered once
 *  per scope (repo's main branch and the selected worktree). */
const ScopeBody = ({
  agents,
  launchTemplates,
  onLaunch,
  onManage,
  onAgentClick,
  onRemoveAgentClick,
  onSendPrompt,
  onRenameAgent,
  onRemoveQueueItem,
}: ScopeBodyProps) => (
  <>
    <LaunchRow templates={launchTemplates} onLaunch={onLaunch} onManage={onManage} />
    {agents.length > 0 ? (
      <div className="tiles">
        {agents.map((agent) => (
          <AgentTile
            key={agent.agentId}
            agentId={agent.agentId}
            name={agent.name}
            status={agent.status}
            lastPrompt={agent.lastPrompt}
            lastPromptShort={agent.lastPromptShort}
            startedAt={agent.startedAt}
            completedAt={agent.completedAt}
            isSelected={agent.isFocused}
            templateName={agent.templateName}
            templateColor={agent.templateColor}
            outputSummary={agent.outputSummary}
            outputShort={agent.outputShort}
            promptQueue={agent.promptQueue}
            contextUsage={agent.contextUsage}
            onClick={onAgentClick}
            onRemoveClick={onRemoveAgentClick}
            onSendPrompt={onSendPrompt}
            onRenameAgent={onRenameAgent}
            onRemoveQueueItem={onRemoveQueueItem}
          />
        ))}
      </div>
    ) : (
      <EmptyAgents />
    )}
  </>
);

export const RepoSection = ({
  repo,
  templates,
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
}: RepoSectionProps) => {
  const launchTemplates = useMemo(() => toLaunchTemplates(templates), [templates]);

  const activeBranch = repo.selectedWorktreeBranch;
  const activeWt =
    activeBranch !== null
      ? repo.worktrees.find((w) => w.branch === activeBranch) ?? null
      : null;

  const tabs = useMemo(
    () =>
      repo.worktrees.map((w) => ({
        branch: w.branch,
        agentCount: w.agentCount,
      })),
    [repo.worktrees],
  );

  const agentCallbacks: AgentCallbacks = {
    onAgentClick,
    onRemoveAgentClick,
    onSendPrompt,
    onRenameAgent,
    onRemoveQueueItem,
  };

  return (
    <section className={`repo${repo.isExpanded ? '' : ' repo--collapsed'}`}>
      <RepoHeader
        name={repo.name}
        expanded={repo.isExpanded}
        onRootClick={onRepoRootClick}
        onRemoveClick={onRemoveRepoClick}
        onToggleClick={onToggleRepoClick}
      />

      {repo.isExpanded && (
        <>
          <ScopeBody
            agents={repo.currentAgents}
            launchTemplates={launchTemplates}
            onLaunch={(templateId) =>
              onLaunchTemplate(repo.repositoryId, repo.currentBranch, templateId)
            }
            onManage={onManageTemplates}
            {...agentCallbacks}
          />

          {repo.worktrees.length > 0 ? (
            <div className="wt-block">
              <WorktreeTabs
                tabs={tabs}
                selectedBranch={activeBranch}
                onSelect={(branch) => onSelectWorktree(repo.repositoryId, branch)}
                onNew={() => onNewWorktree(repo.repositoryId)}
                onMerge={(branch) => onMergeWorktree(repo.repositoryId, branch)}
                onDelete={(branch) =>
                  onCloseWorktreeClick(repo.repositoryId, branch)
                }
              />
              {activeBranch && (
                <ScopeBody
                  agents={activeWt?.agents ?? []}
                  launchTemplates={launchTemplates}
                  onLaunch={(templateId) =>
                    onLaunchTemplate(repo.repositoryId, activeBranch, templateId)
                  }
                  onManage={onManageTemplates}
                  {...agentCallbacks}
                />
              )}
            </div>
          ) : (
            <EmptyWorktree onClick={() => onNewWorktree(repo.repositoryId)} />
          )}
        </>
      )}
    </section>
  );
};
