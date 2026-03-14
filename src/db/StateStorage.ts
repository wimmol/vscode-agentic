import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { Repository, Worktree, Agent } from './models';
import type { RepoWithZones, BranchZone } from '../types';
import type { AgentCli } from '../types/agent';
import { AGENT_STATUS_CREATED } from '../constants/agent';
import { DEFAULT_DEVELOP_BRANCH } from '../constants/repo';
import {
  STORE_REPOSITORIES,
  STORE_AGENTS,
  STORE_WORKTREES,
  STORE_EXPLORER_STATE,
  STORE_ZONE_EXPANDED,
} from '../constants/db';
import {
  ERR_REPO_NAME_EMPTY,
  ERR_REPO_PATH_EMPTY,
  ERR_DEVELOP_BRANCH_EMPTY,
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

  constructor(private readonly state: vscode.Memento) {}

  // ── Helpers ─────────────────────────────────────────────────────

  private repos(): Repository[] {
    return this.state.get<Repository[]>(STORE_REPOSITORIES, []);
  }

  private agents(): Agent[] {
    return this.state.get<Agent[]>(STORE_AGENTS, []);
  }

  private worktrees(): Worktree[] {
    return this.state.get<Worktree[]>(STORE_WORKTREES, []);
  }

  private explorerState(): Record<string, string[]> {
    return this.state.get<Record<string, string[]>>(STORE_EXPLORER_STATE, {});
  }

  private zoneExpanded(): Record<string, boolean> {
    return this.state.get<Record<string, boolean>>(STORE_ZONE_EXPANDED, {});
  }

  private zoneKey = (repoId: string, branch: string): string => `${repoId}::${branch}`;

  // ── Repositories ───────────────────────────────────────────────

  addRepository = async (name: string, localPath: string, developBranch: string): Promise<Repository> => {
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
      developBranch: developBranch.trim() || DEFAULT_DEVELOP_BRANCH,
      isExpanded: true,
      createdAt: Date.now(),
    };

    await this.state.update(STORE_REPOSITORIES, [...this.repos(), repo]);
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

    // Pre-group worktrees by repoId
    const worktreesByRepo = new Map<string, Worktree[]>();
    for (const wt of allWorktrees) {
      const list = worktreesByRepo.get(wt.repoId);
      if (list) {
        list.push(wt);
      } else {
        worktreesByRepo.set(wt.repoId, [wt]);
      }
    }

    return repos.map((repo) => {
      const byBranch = agentsByRepoBranch.get(repo.repositoryId) ?? new Map<string, Agent[]>();
      const repoWorktrees = worktreesByRepo.get(repo.repositoryId) ?? [];

      // Collect all known branches: develop + agent branches + worktree branches
      const branches = new Set<string>();
      branches.add(repo.developBranch);
      for (const b of byBranch.keys()) branches.add(b);
      for (const wt of repoWorktrees) branches.add(wt.branch);

      const zones: BranchZone[] = [];

      // Develop zone first
      zones.push({
        branch: repo.developBranch,
        isDevelop: true,
        isExpanded: expanded[this.zoneKey(repo.repositoryId, repo.developBranch)] ?? true,
        agents: byBranch.get(repo.developBranch) ?? [],
      });

      // Other zones, alphabetically sorted
      const otherBranches = Array.from(branches)
        .filter((b) => b !== repo.developBranch)
        .sort((a, b) => a.localeCompare(b));

      for (const branch of otherBranches) {
        zones.push({
          branch,
          isDevelop: false,
          isExpanded: expanded[this.zoneKey(repo.repositoryId, branch)] ?? true,
          agents: byBranch.get(branch) ?? [],
        });
      }

      return { ...repo, zones };
    });
  };

  updateRepository = async (
    id: string,
    data: Partial<Pick<Repository, 'name' | 'developBranch'>>,
  ): Promise<Repository> => {
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

    if (data.developBranch !== undefined) {
      const trimmed = data.developBranch.trim();
      if (!trimmed) {
        throw new Error(ERR_DEVELOP_BRANCH_EMPTY);
      }
      repo.developBranch = trimmed;
    }

    if (repo.name === original.name && repo.developBranch === original.developBranch) {
      return original;
    }

    list[idx] = repo;
    await this.state.update(STORE_REPOSITORIES, list);
    this._onDidChange.fire();
    console.log('[StateStorage] updateRepository: result:', repo);
    return repo;
  };

  toggleRepoExpanded = async (id: string): Promise<void> => {
    const list = this.repos();
    const idx = list.findIndex((r) => r.repositoryId === id);
    if (idx === -1) {
      throw new Error(errRepoIdNotFound(id));
    }

    list[idx] = { ...list[idx], isExpanded: !list[idx].isExpanded };
    await this.state.update(STORE_REPOSITORIES, list);
    this._onDidChange.fire();
    console.log('[StateStorage] toggleRepoExpanded:', { id, isExpanded: list[idx].isExpanded });
  };

  removeRepository = async (id: string): Promise<void> => {
    console.log('[StateStorage] removeRepository:', { id });
    const list = this.repos();
    const filtered = list.filter((r) => r.repositoryId !== id);
    if (filtered.length < list.length) {
      const agentList = this.agents();
      const removedAgentIds = new Set(
        agentList.filter((a) => a.repoId === id).map((a) => a.agentId),
      );

      // Prepare all cleanup data before writes
      const writes: Thenable<void>[] = [
        this.state.update(STORE_AGENTS, agentList.filter((a) => a.repoId !== id)),
        this.state.update(STORE_WORKTREES, this.worktrees().filter((w) => w.repoId !== id)),
        this.state.update(STORE_REPOSITORIES, filtered),
      ];

      // Clean zone expanded state
      const ze = this.zoneExpanded();
      const prefix = `${id}::`;
      const cleanedZe: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(ze)) {
        if (!k.startsWith(prefix)) cleanedZe[k] = v;
      }
      if (Object.keys(cleanedZe).length < Object.keys(ze).length) {
        writes.push(this.state.update(STORE_ZONE_EXPANDED, cleanedZe));
      }

      // Clean explorer state
      const es = this.explorerState();
      const cleanedKeys = Object.keys(es).filter((k) => k !== id && !removedAgentIds.has(k));
      if (cleanedKeys.length < Object.keys(es).length) {
        const cleaned: Record<string, string[]> = {};
        for (const k of cleanedKeys) cleaned[k] = es[k];
        writes.push(this.state.update(STORE_EXPLORER_STATE, cleaned));
      }

      await Promise.all(writes);
      this._onDidChange.fire();
    }
  };

  // ── Agents ─────────────────────────────────────────────────────

  addAgent = async (repoId: string, name: string, branch: string, cli: AgentCli): Promise<Agent> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error(ERR_AGENT_NAME_EMPTY);
    }

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
    };

    await this.state.update(STORE_AGENTS, [...this.agents(), agent]);
    this._onDidChange.fire();
    console.log('[StateStorage] addAgent: result:', agent);
    return agent;
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
    data: Partial<Pick<Agent, 'name' | 'status' | 'sessionId' | 'lastPrompt' | 'startedAt' | 'completedAt'>>,
  ): Promise<Agent> => {
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
      agent.name = trimmed;
    }

    if (data.status !== undefined) agent.status = data.status;
    if (data.sessionId !== undefined) agent.sessionId = data.sessionId;
    if (data.lastPrompt !== undefined) agent.lastPrompt = data.lastPrompt;
    if (data.startedAt !== undefined) agent.startedAt = data.startedAt;
    if (data.completedAt !== undefined) agent.completedAt = data.completedAt;

    if (
      agent.name === original.name &&
      agent.status === original.status &&
      agent.sessionId === original.sessionId &&
      agent.lastPrompt === original.lastPrompt &&
      agent.startedAt === original.startedAt &&
      agent.completedAt === original.completedAt
    ) {
      return original;
    }

    list[idx] = agent;
    await this.state.update(STORE_AGENTS, list);
    this._onDidChange.fire();
    console.log('[StateStorage] updateAgent: result:', agent);
    return agent;
  };

  removeAgent = async (id: string): Promise<void> => {
    console.log('[StateStorage] removeAgent:', { id });
    const list = this.agents();
    const filtered = list.filter((a) => a.agentId !== id);
    if (filtered.length < list.length) {
      await this.state.update(STORE_AGENTS, filtered);
      const es = this.explorerState();
      if (id in es) {
        const { [id]: _, ...rest } = es;
        await this.state.update(STORE_EXPLORER_STATE, rest);
      }
      this._onDidChange.fire();
    }
  };

  focusAgent = async (agentId: string): Promise<void> => {
    const list = this.agents();
    const idx = list.findIndex((a) => a.agentId === agentId);
    if (idx === -1) {
      throw new Error(errAgentIdNotFound(agentId));
    }
    const alreadySole = list[idx].isFocused && list.every((a) => a.agentId === agentId || !a.isFocused);
    if (alreadySole) {
      return;
    }

    const updated = list.map((a) => ({ ...a, isFocused: a.agentId === agentId }));
    await this.state.update(STORE_AGENTS, updated);
    this._onDidChange.fire();
    console.log('[StateStorage] focusAgent:', { agentId });
  };

  // ── Worktrees ─────────────────────────────────────────────────

  addWorktree = async (repoId: string, branch: string, path: string): Promise<Worktree> => {
    const worktree: Worktree = {
      worktreeId: randomUUID(),
      repoId,
      branch,
      path,
    };

    await this.state.update(STORE_WORKTREES, [...this.worktrees(), worktree]);
    this._onDidChange.fire();
    console.log('[StateStorage] addWorktree: result:', worktree);
    return worktree;
  };

  getWorktreeByBranch = async (repoId: string, branch: string): Promise<Worktree | undefined> => {
    return this.worktrees().find((w) => w.repoId === repoId && w.branch === branch);
  };

  removeWorktreeByBranch = async (repoId: string, branch: string): Promise<void> => {
    console.log('[StateStorage] removeWorktreeByBranch:', { repoId, branch });
    const list = this.worktrees();
    const filtered = list.filter((w) => !(w.repoId === repoId && w.branch === branch));
    if (filtered.length < list.length) {
      await this.state.update(STORE_WORKTREES, filtered);

      // Clean up zone expanded state for the removed branch
      const key = this.zoneKey(repoId, branch);
      const ze = this.zoneExpanded();
      if (key in ze) {
        const { [key]: _, ...rest } = ze;
        await this.state.update(STORE_ZONE_EXPANDED, rest);
      }

      this._onDidChange.fire();
    }
  };

  getAllWorktrees = async (): Promise<Worktree[]> => {
    return this.worktrees();
  };

  // ── Zones ─────────────────────────────────────────────────────

  toggleZoneExpanded = async (repoId: string, branch: string): Promise<void> => {
    const key = this.zoneKey(repoId, branch);
    const map = this.zoneExpanded();
    const current = map[key] ?? true;
    await this.state.update(STORE_ZONE_EXPANDED, { ...map, [key]: !current });
    this._onDidChange.fire();
    console.log('[StateStorage] toggleZoneExpanded:', { repoId, branch, isExpanded: !current });
  };

  getFocusedAgent = async (): Promise<Agent | undefined> => {
    return this.agents().find((a) => a.isFocused);
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
    await this.state.update(STORE_EXPLORER_STATE, { ...this.explorerState(), [scopeKey]: paths });
  };

  // ── Internal ───────────────────────────────────────────────────

  dispose = (): void => {
    this._onDidChange.dispose();
  };
}
