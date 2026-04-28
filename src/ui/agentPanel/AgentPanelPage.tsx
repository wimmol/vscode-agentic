import { useCallback } from 'react';
import { AgentPanelView } from './AgentPanelView';
import { useAgentPanel } from './useAgentPanel';
import { vscode } from '../index';
import {
  addRepoMessage,
  agentClickMessage,
  closeWorktreeMessage,
  removeAgentMessage,
  removeRepoMessage,
  repoRootClickMessage,
  rootClickMessage,
  toggleRepoExpandedMessage,
  sendPromptMessage,
  renameAgentMessage,
  removeQueueItemMessage,
  launchTemplateMessage,
  manageTemplatesMessage,
  newWorktreeMessage,
  mergeWorktreeMessage,
  selectWorktreeMessage,
} from '../../types/messages';

export const AgentPanelPage = () => {
  const { repos, templates } = useAgentPanel();

  const onRootClick = useCallback(() => {
    vscode.postMessage(rootClickMessage());
  }, []);

  const onRepoRootClick = useCallback((repoId: string) => {
    vscode.postMessage(repoRootClickMessage(repoId));
  }, []);

  const onAddRepoClick = useCallback(() => {
    vscode.postMessage(addRepoMessage());
  }, []);

  const onRemoveRepoClick = useCallback((repoId: string) => {
    vscode.postMessage(removeRepoMessage(repoId));
  }, []);

  const onToggleRepoClick = useCallback((repoId: string) => {
    vscode.postMessage(toggleRepoExpandedMessage(repoId));
  }, []);

  const onRemoveAgentClick = useCallback((agentId: string) => {
    vscode.postMessage(removeAgentMessage(agentId));
  }, []);

  const onAgentClick = useCallback((agentId: string) => {
    vscode.postMessage(agentClickMessage(agentId));
  }, []);

  const onCloseWorktreeClick = useCallback((repoId: string, branch: string) => {
    vscode.postMessage(closeWorktreeMessage(repoId, branch));
  }, []);

  const onSendPrompt = useCallback((agentId: string) => {
    vscode.postMessage(sendPromptMessage(agentId));
  }, []);

  const onRenameAgent = useCallback((agentId: string) => {
    vscode.postMessage(renameAgentMessage(agentId));
  }, []);

  const onRemoveQueueItem = useCallback((agentId: string, index: number) => {
    vscode.postMessage(removeQueueItemMessage(agentId, index));
  }, []);

  const onLaunchTemplate = useCallback(
    (repoId: string, branch: string, templateId: string | null) => {
      vscode.postMessage(launchTemplateMessage(repoId, branch, templateId));
    },
    [],
  );

  const onManageTemplates = useCallback(() => {
    vscode.postMessage(manageTemplatesMessage());
  }, []);

  const onNewWorktree = useCallback((repoId: string) => {
    vscode.postMessage(newWorktreeMessage(repoId));
  }, []);

  const onMergeWorktree = useCallback((repoId: string, branch: string) => {
    vscode.postMessage(mergeWorktreeMessage(repoId, branch));
  }, []);

  const onSelectWorktree = useCallback((repoId: string, branch: string | null) => {
    vscode.postMessage(selectWorktreeMessage(repoId, branch));
  }, []);

  return (
    <AgentPanelView
      repos={repos}
      templates={templates}
      onRootClick={onRootClick}
      onAddRepoClick={onAddRepoClick}
      onRepoRootClick={onRepoRootClick}
      onRemoveRepoClick={onRemoveRepoClick}
      onToggleRepoClick={onToggleRepoClick}
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
  );
};
