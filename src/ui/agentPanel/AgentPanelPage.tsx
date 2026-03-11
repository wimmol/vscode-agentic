import { useCallback } from 'react';
import { AgentPanelView } from './AgentPanelView';
import { useAgentPanel } from './useAgentPanel';
import { vscode } from '../index';
import { addRepoMessage, removeRepoMessage, rootClickMessage, toggleRepoExpandedMessage } from '../../types/messages';

const noopId = (_id: string) => {};

export const AgentPanelPage = () => {
  const repos = useAgentPanel();

  const onRootClick = useCallback(() => {
    vscode.postMessage(rootClickMessage());
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

  return (
    <AgentPanelView
      repos={repos}
      onRootClick={onRootClick}
      onAddRepoClick={onAddRepoClick}
      onRepoRootClick={noopId}
      onAddAgentClick={noopId}
      onRemoveRepoClick={onRemoveRepoClick}
      onToggleRepoClick={onToggleRepoClick}
      onAgentClick={noopId}
      onCloneAgentClick={noopId}
      onStopAgentClick={noopId}
      onRemoveAgentClick={noopId}
      onClearAgentClick={noopId}
    />
  );
};
