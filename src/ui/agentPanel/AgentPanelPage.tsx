import { useCallback } from 'react';
import { AgentPanelView } from './AgentPanelView';
import { useAgentPanel } from './useAgentPanel';
import { vscode } from '../index';
import { addAgentMessage, addRepoMessage, removeAgentMessage, removeRepoMessage, repoRootClickMessage, rootClickMessage, toggleRepoExpandedMessage } from '../../types/messages';

const noopId = (_id: string) => {};

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

  const onRemoveAgentClick = useCallback((agentId: string) => {
    vscode.postMessage(removeAgentMessage(agentId));
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
      onAgentClick={noopId}
      onCloneAgentClick={noopId}
      onStopAgentClick={noopId}
      onRemoveAgentClick={onRemoveAgentClick}
      onClearAgentClick={noopId}
    />
  );
};
