import type { AgentCli, AgentStatus } from '../types/agent';

// ── Attribute interfaces (plain objects for UI / transport) ─────────

export interface Repository {
  repositoryId: string;
  name: string;
  localPath: string;
  currentBranch: string;
  isExpanded: boolean;
  createdAt: number;
}

export interface Agent {
  agentId: string;
  repoId: string;
  name: string;
  branch: string;
  cli: AgentCli;
  status: AgentStatus;
  isFocused: boolean;
  sessionId: string | null;
  lastPrompt: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

export interface Worktree {
  worktreeId: string;
  repoId: string;
  branch: string;
  path: string;
}

export interface ExplorerState {
  scopeKey: string;
  expandedPaths: string;
}
