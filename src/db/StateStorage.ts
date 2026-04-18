import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { Repository, Worktree, Agent, AgentTemplate } from './models';
import type { RepoWithZones, BranchZone } from '../types';
import type { AgentCli } from '../types/agent';
import { AGENT_STATUS_CREATED } from '../constants/agent';
import { DEFAULT_CURRENT_BRANCH } from '../constants/repo';
import {
  STORE_REPOSITORIES,
  STORE_AGENTS,
  STORE_WORKTREES,
  STORE_EXPLORER_STATE,
  STORE_ZONE_EXPANDED,
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
    /** Cross-workspace data (repos, agents, worktrees, templates, zones). */
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
    // Reserved for future migrations. Today's schema is backwards-compatible
    // because every optional field on Agent is defaulted in `agents()`.
    await this.state.update(STORE_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
  };

  // ── Helpers ─────────────────────────────────────────────────────

  private repos(): Repository[] {
    return this.state.get<Repository[]>(STORE_REPOSITORIES, []);
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
      outputSummary: a.outputSummary ?? null,
      forkedFrom: a.forkedFrom ?? null,
      promptQueue: Array.isArray(a.promptQueue) ? a.promptQueue : [],
      contextUsage: a.contextUsage ?? null,
    }));
  }

  private templates(): AgentTemplate[] {
    return this.state.get<AgentTemplate[]>(STORE_TEMPLATES, []);
  }

  private worktrees(): Worktree[] {
    return this.state.get<Worktree[]>(STORE_WORKTREES, []);
  }

  private explorerState(): Record<string, string[]> {
    return this.uiState.get<Record<string, string[]>>(STORE_EXPLORER_STATE, {});
  }

  private zoneExpanded(): Record<string, boolean> {
    return this.state.get<Record<string, boolean>>(STORE_ZONE_EXPANDED, {});
  }

  private zoneKey = (repoId: string, branch: string): string => `${repoId}::${branch}`;

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
    };

    await this.runExclusive(async () => {
      await this.state.update(STORE_REPOSITORIES, [...this.repos(), repo]);
    });
    this._onDidChange.fire();
    console.log('[StateStorage] addRepository: result:', repo);
    return repo;
  };

  getRepository = async (id: string): Promise<Repository | undefined> => {
    return this.repos().find((r) => r.repositoryId === id);
  };

  getAllRepositories = async (): Promise<Repository[]> => {
    return this.repos();
  };

  getAllReposWithZones = async (): Promise<RepoWithZones[]> => {
    const repos = this.repos();
    const allAgents = this.agents();
    const allWorktrees = this.worktrees();
    const expanded = this.zoneExpanded();

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

    // Pre-group worktrees by repoId → branch → path
    const worktreeByRepoBranch = new Map<string, Map<string, string>>();
    for (const wt of allWorktrees) {
      let byBranch = worktreeByRepoBranch.get(wt.repoId);
      if (!byBranch) {
        byBranch = new Map();
        worktreeByRepoBranch.set(wt.repoId, byBranch);
      }
      byBranch.set(wt.branch, wt.path);
    }

    return repos.map((repo) => {
      const byBranch = agentsByRepoBranch.get(repo.repositoryId) ?? new Map<string, Agent[]>();
      const wtByBranch = worktreeByRepoBranch.get(repo.repositoryId) ?? new Map<string, string>();

      // Collect all known branches: current + agent branches + worktree branches
      const branches = new Set<string>();
      branches.add(repo.currentBranch);
      for (const b of byBranch.keys()) branches.add(b);
      for (const b of wtByBranch.keys()) branches.add(b);

      const zones: BranchZone[] = [];

      // Current branch zone first
      zones.push({
        branch: repo.currentBranch,
        isCurrent: true,
        isExpanded: expanded[this.zoneKey(repo.repositoryId, repo.currentBranch)] ?? true,
        worktreePath: null,
        agents: byBranch.get(repo.currentBranch) ?? [],
      });

      // Other zones, alphabetically sorted
      const otherBranches = Array.from(branches)
        .filter((b) => b !== repo.currentBranch)
        .sort((a, b) => a.localeCompare(b));

      for (const branch of otherBranches) {
        zones.push({
          branch,
          isCurrent: false,
          isExpanded: expanded[this.zoneKey(repo.repositoryId, branch)] ?? true,
          worktreePath: wtByBranch.get(branch) ?? null,
          agents: byBranch.get(branch) ?? [],
        });
      }

      return { ...repo, zones };
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
      console.log('[StateStorage] updateRepository: result:', repo);
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
      console.log('[StateStorage] toggleRepoExpanded:', { id, isExpanded: list[idx].isExpanded });
    });
  };

  removeRepository = async (id: string): Promise<void> => {
    console.log('[StateStorage] removeRepository:', { id });
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

      const ze = this.zoneExpanded();
      const prefix = `${id}::`;
      const cleanedZe: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(ze)) {
        if (!k.startsWith(prefix)) cleanedZe[k] = v;
      }
      if (Object.keys(cleanedZe).length < Object.keys(ze).length) {
        writes.push(this.state.update(STORE_ZONE_EXPANDED, cleanedZe));
      }

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

  addAgent = async (repoId: string, name: string, branch: string, cli: AgentCli): Promise<Agent> => {
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
        templateName: null,
        outputSummary: null,
        forkedFrom: null,
        promptQueue: [],
        contextUsage: null,
      };

      await this.state.update(STORE_AGENTS, [...this.agents(), agent]);
      this._onDidChange.fire();
      console.log('[StateStorage] addAgent: result:', agent);
      return agent;
    });
  };

  getAgent = async (id: string): Promise<Agent | undefined> => {
    return this.agents().find((a) => a.agentId === id);
  };

  getAgentsByRepo = async (repoId: string): Promise<Agent[]> => {
    return this.agents().filter((a) => a.repoId === repoId);
  };

  getAgentsByRepoBranch = async (repoId: string, branch: string): Promise<Agent[]> => {
    return this.agents().filter((a) => a.repoId === repoId && a.branch === branch);
  };

  updateAgent = async (
    id: string,
    data: Partial<Pick<Agent, 'name' | 'status' | 'sessionId' | 'lastPrompt' | 'startedAt' | 'completedAt' | 'templateName' | 'outputSummary' | 'forkedFrom' | 'promptQueue' | 'contextUsage'>>,
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

    if (data.status !== undefined) agent.status = data.status;
    if (data.sessionId !== undefined) agent.sessionId = data.sessionId;
    if (data.lastPrompt !== undefined) agent.lastPrompt = data.lastPrompt;
    if (data.startedAt !== undefined) agent.startedAt = data.startedAt;
    if (data.completedAt !== undefined) agent.completedAt = data.completedAt;
    if (data.templateName !== undefined) agent.templateName = data.templateName;
    if (data.outputSummary !== undefined) agent.outputSummary = data.outputSummary;
    if (data.forkedFrom !== undefined) agent.forkedFrom = data.forkedFrom;
    if (data.promptQueue !== undefined) agent.promptQueue = data.promptQueue;
    if (data.contextUsage !== undefined) agent.contextUsage = data.contextUsage;

    if (
      agent.name === original.name &&
      agent.status === original.status &&
      agent.sessionId === original.sessionId &&
      agent.lastPrompt === original.lastPrompt &&
      agent.startedAt === original.startedAt &&
      agent.completedAt === original.completedAt &&
      agent.templateName === original.templateName &&
      agent.outputSummary === original.outputSummary &&
      agent.forkedFrom === original.forkedFrom &&
      agent.promptQueue.length === original.promptQueue.length &&
      agent.promptQueue.every((p, i) => p === original.promptQueue[i]) &&
      agent.contextUsage?.used === original.contextUsage?.used &&
      agent.contextUsage?.total === original.contextUsage?.total
    ) {
      return original;
    }

      list[idx] = agent;
      await this.state.update(STORE_AGENTS, list);
      this._onDidChange.fire();
      console.log('[StateStorage] updateAgent: result:', agent);
      return agent;
    });
  };

  removeAgent = async (id: string): Promise<void> => {
    console.log('[StateStorage] removeAgent:', { id });
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
      console.log('[StateStorage] focusAgent:', { agentId });
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
    console.log('[StateStorage] addWorktree: result:', worktree);
    return worktree;
  };

  getWorktreeByBranch = async (repoId: string, branch: string): Promise<Worktree | undefined> => {
    return this.worktrees().find((w) => w.repoId === repoId && w.branch === branch);
  };

  removeWorktreeByBranch = async (repoId: string, branch: string): Promise<void> => {
    console.log('[StateStorage] removeWorktreeByBranch:', { repoId, branch });
    await this.runExclusive(async () => {
      const list = this.worktrees();
      const filtered = list.filter((w) => !(w.repoId === repoId && w.branch === branch));
      if (filtered.length >= list.length) return;

      await this.state.update(STORE_WORKTREES, filtered);

      const key = this.zoneKey(repoId, branch);
      const ze = this.zoneExpanded();
      if (key in ze) {
        const { [key]: _, ...rest } = ze;
        await this.state.update(STORE_ZONE_EXPANDED, rest);
      }

      this._onDidChange.fire();
    });
  };

  getAllWorktrees = async (): Promise<Worktree[]> => {
    return this.worktrees();
  };

  // ── Zones ─────────────────────────────────────────────────────

  toggleZoneExpanded = async (repoId: string, branch: string): Promise<void> => {
    await this.runExclusive(async () => {
      const key = this.zoneKey(repoId, branch);
      const map = this.zoneExpanded();
      const current = map[key] ?? true;
      await this.state.update(STORE_ZONE_EXPANDED, { ...map, [key]: !current });
      this._onDidChange.fire();
      console.log('[StateStorage] toggleZoneExpanded:', { repoId, branch, isExpanded: !current });
    });
  };

  getFocusedAgent = async (): Promise<Agent | undefined> => {
    return this.agents().find((a) => a.isFocused);
  };

  // ── Templates ──────────────────────────────────────────────────

  addTemplate = async (name: string, prompt: string): Promise<AgentTemplate> => {
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

      const template: AgentTemplate = {
        templateId: randomUUID(),
        name: trimmedName,
        prompt: prompt.trim(),
        createdAt: Date.now(),
      };
      await this.state.update(STORE_TEMPLATES, [...existing, template]);
      this._onDidChange.fire();
      return template;
    });
  };

  getAllTemplates = (): AgentTemplate[] => {
    return this.templates();
  };

  removeTemplate = async (templateId: string): Promise<void> => {
    await this.runExclusive(async () => {
      const list = this.templates();
      const filtered = list.filter((t) => t.templateId !== templateId);
      if (filtered.length >= list.length) return;
      await this.state.update(STORE_TEMPLATES, filtered);
      this._onDidChange.fire();
    });
  };

  // ── Queue ──────────────────────────────────────────────────────

  pushToQueue = async (agentId: string, prompt: string): Promise<void> => {
    const agent = await this.getAgent(agentId);
    if (!agent) throw new Error(errAgentIdNotFound(agentId));
    const queue = [...agent.promptQueue, prompt];
    await this.updateAgent(agentId, { promptQueue: queue });
  };

  shiftFromQueue = async (agentId: string): Promise<string | undefined> => {
    const agent = await this.getAgent(agentId);
    if (!agent) return undefined;
    const queue = [...agent.promptQueue];
    if (queue.length === 0) return undefined;
    const next = queue.shift()!;
    await this.updateAgent(agentId, { promptQueue: queue });
    return next;
  };

  removeFromQueue = async (agentId: string, index: number): Promise<void> => {
    const agent = await this.getAgent(agentId);
    if (!agent) throw new Error(errAgentIdNotFound(agentId));
    const queue = [...agent.promptQueue];
    if (index >= 0 && index < queue.length) {
      queue.splice(index, 1);
      await this.updateAgent(agentId, { promptQueue: queue });
    }
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
