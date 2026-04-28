import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { Repository, Worktree, Agent, AgentTemplate } from './models';
import type { RepoWithScopes, WorktreeScope } from '../types';
import type { AgentCli } from '../types/agent';
import { AGENT_STATUS_CREATED } from '../constants/agent';
import { DEFAULT_CURRENT_BRANCH } from '../constants/repo';
import { templateColorByIndex } from '../constants/templateColor';
import {
  STORE_REPOSITORIES,
  STORE_AGENTS,
  STORE_WORKTREES,
  STORE_EXPLORER_STATE,
  STORE_TEMPLATES,
  STORE_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION,
} from '../constants/db';
import {
  ERR_REPO_NAME_EMPTY,
  ERR_REPO_PATH_EMPTY,
  ERR_CURRENT_BRANCH_EMPTY,
  ERR_AGENT_NAME_EMPTY,
  errRepoIdNotFound,
  errAgentIdNotFound,
} from '../constants/messages';
import { logger } from '../services/Logger';

/** Scalar Agent fields `updateAgent` patches in one loop. Kept as a tuple so
 *  the accepted `AgentPatch` type is derived from it (one source of truth). */
const AGENT_SCALAR_FIELDS = [
  'status',
  'sessionId',
  'lastPrompt',
  'startedAt',
  'completedAt',
  'templateName',
  'templateColor',
  'outputSummary',
  'lastPromptShort',
  'outputShort',
] as const;

type AgentScalarKey = (typeof AGENT_SCALAR_FIELDS)[number];

type AgentPatch = Partial<
  Pick<Agent, 'name' | 'promptQueue' | 'contextUsage' | AgentScalarKey>
>;

/**
 * Manages all read/write operations against VS Code workspaceState.
 *
 * Fits between the extension layer (commands, webview provider) and the
 * storage — every public method validates input, mutates via Memento,
 * and emits a change event.
 *
 * Exists as a class (rather than loose functions) because it owns the
 * Memento reference and the EventEmitter, both of which share a lifetime.
 */
export class StateStorage implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  /**
   * Serializes all writes against a given key so that read-then-write
   * sequences cannot be interleaved. Reads are still lock-free.
   */
  private writeLock: Promise<unknown> = Promise.resolve();

  constructor(
    /** Cross-workspace data (repos, agents, worktrees, templates). */
    private readonly state: vscode.Memento,
    /** Per-workspace UI state (explorer expanded folders). */
    private readonly uiState: vscode.Memento = state,
  ) {}

  private runExclusive = async <T>(fn: () => Promise<T>): Promise<T> => {
    const previous = this.writeLock;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.writeLock = previous.then(() => gate);
    try {
      await previous;
      return await fn();
    } finally {
      release();
    }
  };

  /** Apply migrations up to CURRENT_SCHEMA_VERSION. */
  runMigrations = async (): Promise<void> => {
    const stored = this.state.get<number>(STORE_SCHEMA_VERSION, 0);
    if (stored === CURRENT_SCHEMA_VERSION) return;
    // Today's schema is read-time-compatible: missing fields are defaulted
    // in repos() / agents() / templates() and persisted on the next write.
    await this.state.update(STORE_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
  };

  // ── Helpers ─────────────────────────────────────────────────────

  private repos(): Repository[] {
    return this.state.get<Repository[]>(STORE_REPOSITORIES, []).map((r) => ({
      repositoryId: r.repositoryId,
      name: r.name,
      localPath: r.localPath,
      currentBranch: r.currentBranch,
      isExpanded: r.isExpanded ?? true,
      createdAt: r.createdAt ?? Date.now(),
      selectedWorktreeBranch: r.selectedWorktreeBranch ?? null,
    }));
  }

  private agents(): Agent[] {
    return this.state.get<Agent[]>(STORE_AGENTS, []).map((a) => ({
      agentId: a.agentId,
      repoId: a.repoId,
      name: a.name,
      branch: a.branch,
      cli: a.cli,
      status: a.status,
      isFocused: a.isFocused ?? false,
      sessionId: a.sessionId ?? null,
      lastPrompt: a.lastPrompt ?? null,
      startedAt: a.startedAt ?? null,
      completedAt: a.completedAt ?? null,
      createdAt: a.createdAt ?? Date.now(),
      templateName: a.templateName ?? null,
      templateColor: a.templateColor ?? null,
      systemPrompt: a.systemPrompt ?? null,
      outputSummary: a.outputSummary ?? null,
      lastPromptShort: a.lastPromptShort ?? null,
      outputShort: a.outputShort ?? null,
      promptQueue: Array.isArray(a.promptQueue) ? a.promptQueue : [],
      contextUsage: a.contextUsage ?? null,
    }));
  }

  /**
   * Normalize templates on every read. Missing `color` gets a deterministic
   * palette swatch based on position; missing `isDefault` resolves so that
   * exactly one template is flagged (first by insertion order if none is
   * marked). The enriched shape is picked up on the next write.
   */
  private templates(): AgentTemplate[] {
    const raw = this.state.get<AgentTemplate[]>(STORE_TEMPLATES, []);
    const anyDefault = raw.some((t) => t.isDefault === true);
    return raw.map((t, i) => ({
      templateId: t.templateId,
      name: t.name,
      prompt: t.prompt,
      createdAt: t.createdAt ?? Date.now(),
      color: t.color ?? templateColorByIndex(i),
      isDefault: t.isDefault ?? (!anyDefault && i === 0),
    }));
  }

  private worktrees(): Worktree[] {
    return this.state.get<Worktree[]>(STORE_WORKTREES, []);
  }

  private explorerState(): Record<string, string[]> {
    return this.uiState.get<Record<string, string[]>>(STORE_EXPLORER_STATE, {});
  }

  // ── Repositories ───────────────────────────────────────────────

  addRepository = async (name: string, localPath: string, currentBranch: string): Promise<Repository> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error(ERR_REPO_NAME_EMPTY);
    }

    const trimmedPath = localPath.trim();
    if (!trimmedPath) {
      throw new Error(ERR_REPO_PATH_EMPTY);
    }

    const repo: Repository = {
      repositoryId: randomUUID(),
      name: trimmedName,
      localPath: trimmedPath,
      currentBranch: currentBranch.trim() || DEFAULT_CURRENT_BRANCH,
      isExpanded: true,
      createdAt: Date.now(),
      selectedWorktreeBranch: null,
    };

    await this.runExclusive(async () => {
      await this.state.update(STORE_REPOSITORIES, [...this.repos(), repo]);
    });
    this._onDidChange.fire();
    logger.trace('StateStorage addRepository', { repo });
    return repo;
  };

  getRepository = async (id: string): Promise<Repository | undefined> => {
    return this.repos().find((r) => r.repositoryId === id);
  };

  getAllRepositories = async (): Promise<Repository[]> => {
    return this.repos();
  };

  /**
   * Primary snapshot the webview consumes. Produces one `RepoWithScopes`
   * per repo: the repo's own agents (on `currentBranch`) plus one
   * `WorktreeScope` per worktree, with `agents` populated only for the
   * selected worktree to keep the payload small.
   */
  getAllReposWithScopes = async (): Promise<RepoWithScopes[]> => {
    const repos = this.repos();
    const allAgents = this.agents();
    const allWorktrees = this.worktrees();

    // Pre-group agents by repoId → branch → Agent[]
    const agentsByRepoBranch = new Map<string, Map<string, Agent[]>>();
    for (const agent of allAgents) {
      let byBranch = agentsByRepoBranch.get(agent.repoId);
      if (!byBranch) {
        byBranch = new Map();
        agentsByRepoBranch.set(agent.repoId, byBranch);
      }
      const list = byBranch.get(agent.branch);
      if (list) {
        list.push(agent);
      } else {
        byBranch.set(agent.branch, [agent]);
      }
    }

    // Agent order inside every scope is always oldest-first by createdAt,
    // stable across snapshots so tiles never reorder when an agent's
    // status or data changes.
    const sortAgents = (list: Agent[]): Agent[] =>
      [...list].sort((a, b) => a.createdAt - b.createdAt);

    return repos.map((repo) => {
      const byBranch = agentsByRepoBranch.get(repo.repositoryId) ?? new Map<string, Agent[]>();
      const repoWorktrees = allWorktrees.filter((w) => w.repoId === repo.repositoryId);

      const currentAgents = sortAgents(byBranch.get(repo.currentBranch) ?? []);

      // Resolve selectedWorktreeBranch: explicit choice if valid, else the
      // most recently-added worktree, else null. The snapshot reports the
      // resolved value on the repo so the UI doesn't need to re-derive it.
      const selectedBranch =
        repo.selectedWorktreeBranch &&
        repoWorktrees.some((w) => w.branch === repo.selectedWorktreeBranch)
          ? repo.selectedWorktreeBranch
          : repoWorktrees.at(-1)?.branch ?? null;

      const worktrees: WorktreeScope[] = repoWorktrees.map((w) => {
        const raw = byBranch.get(w.branch) ?? [];
        const isSelected = w.branch === selectedBranch;
        return {
          branch: w.branch,
          path: w.path,
          agentCount: raw.length,
          agents: isSelected ? sortAgents(raw) : [],
        };
      });

      return {
        ...repo,
        selectedWorktreeBranch: selectedBranch,
        currentAgents,
        worktrees,
      };
    });
  };

  updateRepository = async (
    id: string,
    data: Partial<Pick<Repository, 'name' | 'currentBranch'>>,
  ): Promise<Repository> => {
    return this.runExclusive(async () => {
      const list = this.repos();
      const idx = list.findIndex((r) => r.repositoryId === id);
      if (idx === -1) {
        throw new Error(errRepoIdNotFound(id));
      }

      const original = list[idx];
      const repo = { ...original };

      if (data.name !== undefined) {
        const trimmed = data.name.trim();
        if (!trimmed) {
          throw new Error(ERR_REPO_NAME_EMPTY);
        }
        repo.name = trimmed;
      }

      if (data.currentBranch !== undefined) {
        const trimmed = data.currentBranch.trim();
        if (!trimmed) {
          throw new Error(ERR_CURRENT_BRANCH_EMPTY);
        }
        repo.currentBranch = trimmed;
      }

      if (repo.name === original.name && repo.currentBranch === original.currentBranch) {
        return original;
      }

      list[idx] = repo;
      await this.state.update(STORE_REPOSITORIES, list);
      this._onDidChange.fire();
      logger.trace('StateStorage updateRepository', { repo });
      return repo;
    });
  };

  toggleRepoExpanded = async (id: string): Promise<void> => {
    await this.runExclusive(async () => {
      const list = this.repos();
      const idx = list.findIndex((r) => r.repositoryId === id);
      if (idx === -1) {
        throw new Error(errRepoIdNotFound(id));
      }

      list[idx] = { ...list[idx], isExpanded: !list[idx].isExpanded };
      await this.state.update(STORE_REPOSITORIES, list);
      this._onDidChange.fire();
      logger.trace('StateStorage toggleRepoExpanded', { id, isExpanded: list[idx].isExpanded });
    });
  };

  /** Persist which worktree tab is active for a repo. `null` clears it. */
  setSelectedWorktree = async (repoId: string, branch: string | null): Promise<void> => {
    await this.runExclusive(async () => {
      const list = this.repos();
      const idx = list.findIndex((r) => r.repositoryId === repoId);
      if (idx === -1) {
        throw new Error(errRepoIdNotFound(repoId));
      }
      if (list[idx].selectedWorktreeBranch === branch) return;
      list[idx] = { ...list[idx], selectedWorktreeBranch: branch };
      await this.state.update(STORE_REPOSITORIES, list);
      this._onDidChange.fire();
      logger.trace('StateStorage setSelectedWorktree', { repoId, branch });
    });
  };

  removeRepository = async (id: string): Promise<void> => {
    logger.trace('StateStorage removeRepository', { id });
    await this.runExclusive(async () => {
      const list = this.repos();
      const filtered = list.filter((r) => r.repositoryId !== id);
      if (filtered.length >= list.length) return;

      const agentList = this.agents();
      const removedAgentIds = new Set(
        agentList.filter((a) => a.repoId === id).map((a) => a.agentId),
      );

      const writes: Thenable<void>[] = [
        this.state.update(STORE_AGENTS, agentList.filter((a) => a.repoId !== id)),
        this.state.update(STORE_WORKTREES, this.worktrees().filter((w) => w.repoId !== id)),
        this.state.update(STORE_REPOSITORIES, filtered),
      ];

      const es = this.explorerState();
      const cleanedKeys = Object.keys(es).filter((k) => k !== id && !removedAgentIds.has(k));
      if (cleanedKeys.length < Object.keys(es).length) {
        const cleaned: Record<string, string[]> = {};
        for (const k of cleanedKeys) cleaned[k] = es[k];
        writes.push(this.uiState.update(STORE_EXPLORER_STATE, cleaned));
      }

      await Promise.all(writes);
      this._onDidChange.fire();
    });
  };

  // ── Agents ─────────────────────────────────────────────────────

  addAgent = async (
    repoId: string,
    name: string,
    branch: string,
    cli: AgentCli,
    initial: Partial<Pick<Agent, 'templateName' | 'templateColor' | 'systemPrompt'>> = {},
  ): Promise<Agent> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error(ERR_AGENT_NAME_EMPTY);
    }

    return this.runExclusive(async () => {
      const repos = this.repos();
      const repo = repos.find((r) => r.repositoryId === repoId);
      if (!repo) {
        throw new Error(errRepoIdNotFound(repoId));
      }

      const agent: Agent = {
        agentId: randomUUID(),
        repoId,
        name: trimmedName,
        branch: branch.trim(),
        cli,
        status: AGENT_STATUS_CREATED,
        isFocused: false,
        sessionId: null,
        lastPrompt: null,
        startedAt: null,
        completedAt: null,
        createdAt: Date.now(),
        templateName: initial.templateName ?? null,
        templateColor: initial.templateColor ?? null,
        systemPrompt: initial.systemPrompt ?? null,
        outputSummary: null,
        lastPromptShort: null,
        outputShort: null,
        promptQueue: [],
        contextUsage: null,
      };

      await this.state.update(STORE_AGENTS, [...this.agents(), agent]);
      this._onDidChange.fire();
      logger.trace('StateStorage addAgent', { agent });
      return agent;
    });
  };

  getAgent = async (id: string): Promise<Agent | undefined> => {
    return this.agents().find((a) => a.agentId === id);
  };

  getAllAgents = async (): Promise<Agent[]> => {
    return this.agents();
  };

  getAgentsByRepo = async (repoId: string): Promise<Agent[]> => {
    return this.agents().filter((a) => a.repoId === repoId);
  };

  getAgentsByRepoBranch = async (repoId: string, branch: string): Promise<Agent[]> => {
    return this.agents().filter((a) => a.repoId === repoId && a.branch === branch);
  };

  updateAgent = async (
    id: string,
    data: AgentPatch,
  ): Promise<Agent> => {
    return this.runExclusive(async () => {
      const list = this.agents();
      const idx = list.findIndex((a) => a.agentId === id);
      if (idx === -1) {
        throw new Error(errAgentIdNotFound(id));
      }

      const original = list[idx];
      const agent = { ...original };

      if (data.name !== undefined) {
        const trimmed = data.name.trim();
        if (!trimmed) {
          throw new Error(ERR_AGENT_NAME_EMPTY);
        }
        const collision = list.some(
          (a) => a.agentId !== id
            && a.repoId === original.repoId
            && a.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (collision) {
          throw new Error(`An agent named "${trimmed}" already exists in this repository.`);
        }
        agent.name = trimmed;
      }

      for (const key of AGENT_SCALAR_FIELDS) {
        if (data[key] !== undefined) (agent[key] as Agent[typeof key]) = data[key]!;
      }
      if (data.promptQueue !== undefined) agent.promptQueue = data.promptQueue;
      if (data.contextUsage !== undefined) agent.contextUsage = data.contextUsage;

      const scalarUnchanged = AGENT_SCALAR_FIELDS.every((k) => agent[k] === original[k]);
      const queueUnchanged =
        agent.promptQueue.length === original.promptQueue.length &&
        agent.promptQueue.every((p, i) => p === original.promptQueue[i]);
      const usageUnchanged =
        agent.contextUsage?.used === original.contextUsage?.used &&
        agent.contextUsage?.total === original.contextUsage?.total;
      if (agent.name === original.name && scalarUnchanged && queueUnchanged && usageUnchanged) {
        return original;
      }

      list[idx] = agent;
      await this.state.update(STORE_AGENTS, list);
      this._onDidChange.fire();
      logger.trace('StateStorage updateAgent', { agentId: agent.agentId, status: agent.status });
      return agent;
    });
  };

  removeAgent = async (id: string): Promise<void> => {
    logger.trace('StateStorage removeAgent', { id });
    await this.runExclusive(async () => {
      const list = this.agents();
      const filtered = list.filter((a) => a.agentId !== id);
      if (filtered.length >= list.length) return;

      await this.state.update(STORE_AGENTS, filtered);
      const es = this.explorerState();
      if (id in es) {
        const { [id]: _, ...rest } = es;
        await this.uiState.update(STORE_EXPLORER_STATE, rest);
      }
      this._onDidChange.fire();
    });
  };

  focusAgent = async (agentId: string): Promise<void> => {
    await this.runExclusive(async () => {
      const list = this.agents();
      const idx = list.findIndex((a) => a.agentId === agentId);
      if (idx === -1) {
        throw new Error(errAgentIdNotFound(agentId));
      }
      const alreadySole = list[idx].isFocused && list.every((a) => a.agentId === agentId || !a.isFocused);
      if (alreadySole) return;

      const updated = list.map((a) => ({ ...a, isFocused: a.agentId === agentId }));
      await this.state.update(STORE_AGENTS, updated);
      this._onDidChange.fire();
      logger.trace('StateStorage focusAgent', { agentId });
    });
  };

  // ── Worktrees ─────────────────────────────────────────────────

  addWorktree = async (repoId: string, branch: string, path: string): Promise<Worktree> => {
    const worktree: Worktree = {
      worktreeId: randomUUID(),
      repoId,
      branch,
      path,
    };

    await this.runExclusive(async () => {
      await this.state.update(STORE_WORKTREES, [...this.worktrees(), worktree]);
    });
    this._onDidChange.fire();
    logger.trace('StateStorage addWorktree', { worktree });
    return worktree;
  };

  getWorktreeByBranch = async (repoId: string, branch: string): Promise<Worktree | undefined> => {
    return this.worktrees().find((w) => w.repoId === repoId && w.branch === branch);
  };

  removeWorktreeByBranch = async (repoId: string, branch: string): Promise<void> => {
    logger.trace('StateStorage removeWorktreeByBranch', { repoId, branch });
    await this.runExclusive(async () => {
      const list = this.worktrees();
      const filtered = list.filter((w) => !(w.repoId === repoId && w.branch === branch));
      if (filtered.length >= list.length) return;

      await this.state.update(STORE_WORKTREES, filtered);

      // Clear selectedWorktreeBranch if it pointed at the one being removed.
      const repoList = this.repos();
      const repoIdx = repoList.findIndex((r) => r.repositoryId === repoId);
      if (repoIdx !== -1 && repoList[repoIdx].selectedWorktreeBranch === branch) {
        repoList[repoIdx] = { ...repoList[repoIdx], selectedWorktreeBranch: null };
        await this.state.update(STORE_REPOSITORIES, repoList);
      }

      this._onDidChange.fire();
    });
  };

  getAllWorktrees = async (): Promise<Worktree[]> => {
    return this.worktrees();
  };

  getFocusedAgent = async (): Promise<Agent | undefined> => {
    return this.agents().find((a) => a.isFocused);
  };

  // ── Templates ──────────────────────────────────────────────────

  addTemplate = async (
    name: string,
    prompt: string,
    options: { color?: string; isDefault?: boolean } = {},
  ): Promise<AgentTemplate> => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Template name cannot be empty.');

    return this.runExclusive(async () => {
      const existing = this.templates();
      const collision = existing.find(
        (t) => t.name.toLowerCase() === trimmedName.toLowerCase(),
      );
      if (collision) {
        throw new Error(`Template "${trimmedName}" already exists.`);
      }

      const color = options.color ?? templateColorByIndex(existing.length);
      // First template becomes default automatically; later ones are non-default
      // unless the caller opts in.
      const wantsDefault = options.isDefault ?? existing.length === 0;
      const template: AgentTemplate = {
        templateId: randomUUID(),
        name: trimmedName,
        prompt: prompt.trim(),
        color,
        isDefault: wantsDefault,
        createdAt: Date.now(),
      };

      // Enforce the single-default invariant when opting in.
      const nextList = wantsDefault
        ? [...existing.map((t) => ({ ...t, isDefault: false })), template]
        : [...existing, template];

      await this.state.update(STORE_TEMPLATES, nextList);
      this._onDidChange.fire();
      return template;
    });
  };

  /** Update any subset of the template fields. Rejects empty names and
   *  case-insensitive name collisions with other templates. */
  updateTemplate = async (
    templateId: string,
    patch: Partial<Pick<AgentTemplate, 'name' | 'prompt' | 'color'>>,
  ): Promise<AgentTemplate> => {
    return this.runExclusive(async () => {
      const list = this.templates();
      const idx = list.findIndex((t) => t.templateId === templateId);
      if (idx === -1) {
        throw new Error(`Template ${templateId} not found.`);
      }

      const original = list[idx];
      const next = { ...original };

      if (patch.name !== undefined) {
        const trimmed = patch.name.trim();
        if (!trimmed) throw new Error('Template name cannot be empty.');
        const collision = list.some(
          (t) =>
            t.templateId !== templateId &&
            t.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (collision) {
          throw new Error(`Template "${trimmed}" already exists.`);
        }
        next.name = trimmed;
      }

      if (patch.prompt !== undefined) next.prompt = patch.prompt.trim();
      if (patch.color !== undefined) next.color = patch.color;

      if (
        next.name === original.name &&
        next.prompt === original.prompt &&
        next.color === original.color
      ) {
        return original;
      }

      list[idx] = next;
      await this.state.update(STORE_TEMPLATES, list);
      this._onDidChange.fire();
      return next;
    });
  };

  /** Mark exactly one template as default, clearing the flag on all others. */
  setDefaultTemplate = async (templateId: string): Promise<void> => {
    await this.runExclusive(async () => {
      const list = this.templates();
      const target = list.find((t) => t.templateId === templateId);
      if (!target) {
        throw new Error(`Template ${templateId} not found.`);
      }
      if (target.isDefault && list.every((t) => t.isDefault === (t.templateId === templateId))) {
        return;
      }
      const next = list.map((t) => ({
        ...t,
        isDefault: t.templateId === templateId,
      }));
      await this.state.update(STORE_TEMPLATES, next);
      this._onDidChange.fire();
    });
  };

  getAllTemplates = (): AgentTemplate[] => {
    return this.templates();
  };

  getTemplate = (templateId: string): AgentTemplate | undefined => {
    return this.templates().find((t) => t.templateId === templateId);
  };

  /**
   * Seeds a default `basic` template on first activation if the user has no
   * templates yet. Idempotent: only runs while the list is empty, so deleting
   * `basic` while keeping other templates won't trigger a re-seed.
   */
  ensureDefaultTemplate = async (): Promise<void> => {
    if (this.templates().length > 0) return;
    await this.addTemplate('basic', '', { isDefault: true });
  };

  removeTemplate = async (templateId: string): Promise<void> => {
    await this.runExclusive(async () => {
      const list = this.templates();
      const removed = list.find((t) => t.templateId === templateId);
      if (!removed) return;
      const filtered = list.filter((t) => t.templateId !== templateId);
      // If we dropped the default, promote the first survivor so the invariant
      // "exactly one default when the list is non-empty" is preserved.
      if (removed.isDefault && filtered.length > 0 && !filtered.some((t) => t.isDefault)) {
        filtered[0] = { ...filtered[0], isDefault: true };
      }
      await this.state.update(STORE_TEMPLATES, filtered);
      this._onDidChange.fire();
    });
  };

  // ── Queue ──────────────────────────────────────────────────────

  private mutateQueue = async <T>(
    agentId: string,
    missingBehavior: 'throw' | 'returnUndefined',
    mutate: (queue: string[]) => { next: string[]; result: T } | null,
  ): Promise<T | undefined> => {
    return this.runExclusive(async () => {
      const list = this.agents();
      const idx = list.findIndex((a) => a.agentId === agentId);
      if (idx === -1) {
        if (missingBehavior === 'throw') throw new Error(errAgentIdNotFound(agentId));
        return undefined;
      }
      const agent = list[idx];
      const outcome = mutate([...agent.promptQueue]);
      if (!outcome) return undefined;
      list[idx] = { ...agent, promptQueue: outcome.next };
      await this.state.update(STORE_AGENTS, list);
      this._onDidChange.fire();
      return outcome.result;
    });
  };

  pushToQueue = async (agentId: string, prompt: string): Promise<void> => {
    await this.mutateQueue(agentId, 'throw', (queue) => ({
      next: [...queue, prompt],
      result: undefined as void,
    }));
  };

  shiftFromQueue = async (agentId: string): Promise<string | undefined> => {
    return this.mutateQueue(agentId, 'returnUndefined', (queue) => {
      if (queue.length === 0) return null;
      const next = queue.shift()!;
      return { next: queue, result: next };
    });
  };

  removeFromQueue = async (agentId: string, index: number): Promise<void> => {
    await this.mutateQueue(agentId, 'throw', (queue) => {
      if (index < 0 || index >= queue.length) return null;
      queue.splice(index, 1);
      return { next: queue, result: undefined as void };
    });
  };

  // ── Convenience ─────────────────────────────────────────────────

  getAgentContext = async (
    agentId: string,
  ): Promise<{ agent: Agent; repo: Repository; worktree: Worktree | undefined } | undefined> => {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return undefined;
    }
    const repo = await this.getRepository(agent.repoId);
    if (!repo) {
      return undefined;
    }
    const worktree = await this.getWorktreeByBranch(agent.repoId, agent.branch);
    return { agent, repo, worktree };
  };

  // ── Explorer state ───────────────────────────────────────────

  getExpandedPaths = async (scopeKey: string): Promise<string[]> => {
    const map = this.explorerState();
    return map[scopeKey] ?? [];
  };

  /**
   * Persist explorer expanded-folder state. **Intentionally does not fire
   * `_onDidChange`** — explorer state is local UI state owned by
   * `FileExplorerProvider`; firing the event would cause the AgentPanel to
   * re-fetch and re-render on every collapse/expand toggle (#71).
   */
  setExpandedPaths = async (scopeKey: string, paths: string[]): Promise<void> => {
    await this.runExclusive(async () => {
      await this.uiState.update(STORE_EXPLORER_STATE, { ...this.explorerState(), [scopeKey]: paths });
    });
  };

  // ── Internal ───────────────────────────────────────────────────

  dispose = (): void => {
    this._onDidChange.dispose();
  };
}
