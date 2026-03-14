import type { Repository, Agent } from '../db/models';

export type { Repository, Worktree, Agent } from '../db/models';
export type { AgentStatus, AgentCli } from './agent';

export interface BranchZone {
  branch: string;
  isDevelop: boolean;
  isExpanded: boolean;
  agents: Agent[];
}

export interface RepoWithZones extends Repository {
  zones: BranchZone[];
}
