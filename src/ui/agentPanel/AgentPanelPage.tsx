import { AgentPanelView } from './AgentPanelView';
import type { Repo } from '../shared/types';

const placeholderRepos: Repo[] = [];

const onRootClick = () => {};
const onAddRepoClick = () => {};
const onRepoRootClick = (_repoId: string) => {};
const onAddAgentClick = (_repoId: string) => {};
const onRemoveRepoClick = (_repoId: string) => {};
const onToggleRepoClick = (_repoId: string) => {};
const onAgentClick = (_agentId: string) => {};
const onCloneAgentClick = (_agentId: string) => {};
const onStopAgentClick = (_agentId: string) => {};
const onRemoveAgentClick = (_agentId: string) => {};
const onClearAgentClick = (_agentId: string) => {};

export const AgentPanelPage = () => {
  return (
    <AgentPanelView
      repos={placeholderRepos}
      onRootClick={onRootClick}
      onAddRepoClick={onAddRepoClick}
      onRepoRootClick={onRepoRootClick}
      onAddAgentClick={onAddAgentClick}
      onRemoveRepoClick={onRemoveRepoClick}
      onToggleRepoClick={onToggleRepoClick}
      onAgentClick={onAgentClick}
      onCloneAgentClick={onCloneAgentClick}
      onStopAgentClick={onStopAgentClick}
      onRemoveAgentClick={onRemoveAgentClick}
      onClearAgentClick={onClearAgentClick}
    />
  );
};
