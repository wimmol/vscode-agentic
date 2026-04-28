import type { AgentCli, AgentStatus, ContextUsage } from '../types/agent';

// ── Attribute interfaces (plain objects for UI / transport) ─────────

export interface Repository {
  repositoryId: string;
  name: string;
  localPath: string;
  currentBranch: string;
  isExpanded: boolean;
  createdAt: number;
  /** Branch of the worktree tab currently open in the sidebar. Null means
   *  "no tab chosen yet" — the snapshot auto-picks the most recent worktree. */
  selectedWorktreeBranch: string | null;
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
  templateName: string | null;
  /** Hex colour snapshot of the template used at launch. Persists even if the
   *  template is renamed or deleted, so tile colour is stable per-agent. */
  templateColor: string | null;
  /** Snapshot of the template's prompt at launch time, re-applied on every
   *  `claude` invocation (launch + terminal reopen) via
   *  `--append-system-prompt`. Null for agents launched without a template. */
  systemPrompt: string | null;
  outputSummary: string | null;
  /** Local-LLM summary of `lastPrompt`, populated when the prompt exceeds the
   *  configured threshold. Null while short or awaiting computation. */
  lastPromptShort: string | null;
  /** Local-LLM summary of `outputSummary`, same rules. */
  outputShort: string | null;
  promptQueue: string[];
  contextUsage: ContextUsage | null;
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

export interface AgentTemplate {
  templateId: string;
  name: string;
  prompt: string;
  /** Hex colour chosen by the user from the 10-swatch palette. */
  color: string;
  /** True for exactly one template in the list. Drives the prominent chip in
   *  `LaunchRow`. Enforced by `setDefaultTemplate`. */
  isDefault: boolean;
  createdAt: number;
}
