import { useCallback } from 'react';
import { AgentPanelView } from './AgentPanelView';
import { useAgentPanel } from './useAgentPanel';
import { vscode } from '../index';

const noop = () => {};
const noopId = (_id: string) => {};

export const AgentPanelPage = () => {
  const repos = useAgentPanel();

  const onToggleRepoClick = useCallback((repoId: string) => {
    vscode.postMessage({ type: 'command', command: 'toggleRepoExpanded', data: { repoId } });
  }, []);

  return (
    <AgentPanelView
      repos={repos}
      onRootClick={noop}
      onAddRepoClick={noop}
      onRepoRootClick={noopId}
      onAddAgentClick={noopId}
      onRemoveRepoClick={noopId}
      onToggleRepoClick={onToggleRepoClick}
      onAgentClick={noopId}
      onCloneAgentClick={noopId}
      onStopAgentClick={noopId}
      onRemoveAgentClick={noopId}
      onClearAgentClick={noopId}
    />
  );
};
