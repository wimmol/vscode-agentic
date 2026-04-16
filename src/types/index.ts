import type { Repository, Agent } from '../db/models';

export type { Repository, Worktree, Agent, AgentTemplate } from '../db/models';
export type { AgentStatus, AgentCli, ContextUsage } from './agent';

export interface BranchZone {
  branch: string;
  isCurrent: boolean;
  isExpanded: boolean;
  worktreePath: string | null;
  agents: Agent[];
}

export interface RepoWithZones extends Repository {
  zones: BranchZone[];
}
