import { useCallback, useState } from 'react';
import { AgentPanelView } from './AgentPanelView';
import { useAgentPanel } from './useAgentPanel';
import { vscode } from '../index';
import { addAgentMessage, addRepoMessage, agentClickMessage, removeAgentMessage, removeRepoMessage, repoRootClickMessage, rootClickMessage, toggleRepoExpandedMessage } from '../../types/messages';

const noop = (_id: string) => {};

export const AgentPanelPage = () => {
  const repos = useAgentPanel();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

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

  const onAgentClick = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    vscode.postMessage(agentClickMessage(agentId));
  }, []);

  return (
    <AgentPanelView
      repos={repos}
      selectedAgentId={selectedAgentId}
      onRootClick={onRootClick}
      onAddRepoClick={onAddRepoClick}
      onRepoRootClick={onRepoRootClick}
      onAddAgentClick={onAddAgentClick}
      onRemoveRepoClick={onRemoveRepoClick}
      onToggleRepoClick={onToggleRepoClick}
      onAgentClick={onAgentClick}
      onCloneAgentClick={noop}
      onStopAgentClick={noop}
      onRemoveAgentClick={onRemoveAgentClick}
      onClearAgentClick={noop}
    />
  );
};
