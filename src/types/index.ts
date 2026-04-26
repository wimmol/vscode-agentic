import type { Repository, Agent } from '../db/models';

export type { Repository, Worktree, Agent, AgentTemplate } from '../db/models';
export type { AgentStatus, AgentCli, ContextUsage } from './agent';

export interface WorktreeScope {
  /** Branch of the worktree. */
  branch: string;
  /** Absolute path on disk. */
  path: string;
  /** Total agent count in this scope — always present, even when `agents` is
   *  empty. Lets the tab header show the count without shipping every agent. */
  agentCount: number;
  /** Agents in this scope. Populated only for the repo's selected worktree;
   *  empty array for every other worktree. */
  agents: Agent[];
}

export interface RepoWithScopes extends Repository {
  /** Agents living on the repo's main checkout (its `currentBranch`). */
  currentAgents: Agent[];
  /** One entry per worktree. Ordered oldest → newest (stable for UI). */
  worktrees: WorktreeScope[];
}
