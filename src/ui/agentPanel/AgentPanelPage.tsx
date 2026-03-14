import { useCallback } from 'react';
import { AgentPanelView } from './AgentPanelView';
import { useAgentPanel } from './useAgentPanel';
import { vscode } from '../index';
import {
  addAgentMessage,
  addRepoMessage,
  agentClickMessage,
  closeWorktreeMessage,
  removeAgentMessage,
  removeRepoMessage,
  repoRootClickMessage,
  rootClickMessage,
  toggleRepoExpandedMessage,
  toggleZoneExpandedMessage,
} from '../../types/messages';

export const AgentPanelPage = () => {
  const repos = useAgentPanel();

  const onAddAgentClick = useCallback((repoId: string) => {
    vscode.postMessage(addAgentMessage(repoId));
  }, []);

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

  const onToggleZoneClick = useCallback((repoId: string, branch: string) => {
    vscode.postMessage(toggleZoneExpandedMessage(repoId, branch));
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

  return (
    <AgentPanelView
      repos={repos}
      onRootClick={onRootClick}
      onAddRepoClick={onAddRepoClick}
      onRepoRootClick={onRepoRootClick}
      onAddAgentClick={onAddAgentClick}
      onRemoveRepoClick={onRemoveRepoClick}
      onToggleRepoClick={onToggleRepoClick}
      onToggleZoneClick={onToggleZoneClick}
      onAgentClick={onAgentClick}
      onRemoveAgentClick={onRemoveAgentClick}
      onCloseWorktreeClick={onCloseWorktreeClick}
    />
  );
};
