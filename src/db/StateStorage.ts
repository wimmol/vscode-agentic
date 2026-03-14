import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { Repository, Worktree, Agent } from './models';
import type { RepoWithAgents } from '../types';
import type { AgentCli } from '../types/agent';
import { worktreePath } from '../services/GitService';
import { AGENT_STATUS_CREATED } from '../constants/agent';
import { DEFAULT_DEVELOP_BRANCH } from '../constants/repo';
import {
  STORE_REPOSITORIES,
  STORE_AGENTS,
  STORE_WORKTREES,
  STORE_EXPLORER_STATE,
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

  getAllReposWithAgents = async (): Promise<RepoWithAgents[]> => {
    const repos = this.repos();
    const allAgents = this.agents();

    const agentsByRepo = new Map<string, Agent[]>();
    for (const agent of allAgents) {
      const list = agentsByRepo.get(agent.repoId);
      if (list) {
        list.push(agent);
      } else {
        agentsByRepo.set(agent.repoId, [agent]);
      }
    }

    return repos.map((repo) => ({
      ...repo,
      agents: agentsByRepo.get(repo.repositoryId) ?? [],
    }));
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
      // Cascade: remove agents, worktrees, and explorer state for this repo
      const agentList = this.agents();
      const removedAgentIds = new Set(agentList.filter((a) => a.repoId === id).map((a) => a.agentId));
      await this.state.update(STORE_AGENTS, agentList.filter((a) => a.repoId !== id));
      await this.state.update(STORE_WORKTREES, this.worktrees().filter((w) => !removedAgentIds.has(w.agentId)));
      await this.state.update(STORE_REPOSITORIES, filtered);
      const es = this.explorerState();
      const cleanedKeys = Object.keys(es).filter((k) => k !== id && !removedAgentIds.has(k));
      if (cleanedKeys.length < Object.keys(es).length) {
        const cleaned: Record<string, string[]> = {};
        for (const k of cleanedKeys) cleaned[k] = es[k];
        await this.state.update(STORE_EXPLORER_STATE, cleaned);
      }
      this._onDidChange.fire();
    }
  };

  // ── Agents ─────────────────────────────────────────────────────

  addAgent = async (repoId: string, name: string, cli: AgentCli): Promise<Agent> => {
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
      cli,
      status: AGENT_STATUS_CREATED,
      isFocused: false,
      sessionId: null,
      lastPrompt: null,
      startedAt: null,
      completedAt: null,
      createdAt: Date.now(),
    };

    const worktree: Worktree = {
      worktreeId: randomUUID(),
      agentId: agent.agentId,
      path: worktreePath(repo.localPath, trimmedName),
    };

    await this.state.update(STORE_AGENTS, [...this.agents(), agent]);
    await this.state.update(STORE_WORKTREES, [...this.worktrees(), worktree]);
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
      await this.state.update(STORE_WORKTREES, this.worktrees().filter((w) => w.agentId !== id));
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

  // ── Worktrees (read-only) ─────────────────────────────────────

  getWorktree = async (agentId: string): Promise<Worktree | undefined> => {
    return this.worktrees().find((w) => w.agentId === agentId);
  };

  getAllWorktrees = async (): Promise<Worktree[]> => {
    return this.worktrees();
  };

  // ── Convenience ─────────────────────────────────────────────────

  getAgentContext = async (
    agentId: string,
  ): Promise<{ agent: Agent; repo: Repository; worktree: Worktree } | undefined> => {
    const [agent, worktree] = await Promise.all([
      this.getAgent(agentId),
      this.getWorktree(agentId),
    ]);
    if (!agent || !worktree) {
      return undefined;
    }
    const repo = await this.getRepository(agent.repoId);
    if (!repo) {
      return undefined;
    }
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
