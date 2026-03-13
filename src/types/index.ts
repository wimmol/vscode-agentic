import type { Repository, Agent } from '../db/models';

export type { Repository, Worktree, Agent } from '../db/models';
export type { AgentStatus, AgentCli } from './agent';

export interface RepoWithAgents extends Repository {
  agents: Agent[];
}
