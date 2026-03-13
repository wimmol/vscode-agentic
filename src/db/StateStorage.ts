import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { Sequelize } from 'sequelize';
import { RepositoryModel, AgentModel, WorktreeModel, ExplorerStateModel } from './models';
import type { Repository, Worktree, Agent } from './models';
import type { RepoWithAgents } from '../types';
import type { AgentCli } from '../types/agent';
import { worktreePath } from '../services/GitService';
import { AGENT_STATUS_CREATED } from '../constants/agent';
import { DEFAULT_STAGING_BRANCH } from '../constants/repo';
import {
  ERR_REPO_NAME_EMPTY,
  ERR_REPO_PATH_EMPTY,
  ERR_STAGING_BRANCH_EMPTY,
  ERR_AGENT_NAME_EMPTY,
  errRepoIdNotFound,
  errAgentIdNotFound,
} from '../constants/messages';

/**
 * Manages all read/write operations against the file-based SQLite database.
 *
 * Fits between the extension layer (commands, webview provider) and the
 * raw database — every public method validates input, mutates via Sequelize,
 * and emits a change event.
 *
 * Exists as a class (rather than loose functions) because it owns the
 * Sequelize instance and the EventEmitter, both of which share a lifetime.
 */
export class StateStorage implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  constructor(private readonly sequelize: Sequelize) {}

  // ── Repositories ───────────────────────────────────────────────

  addRepository = async (name: string, localPath: string, stagingBranch: string): Promise<Repository> => {
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
      stagingBranch: stagingBranch.trim() || DEFAULT_STAGING_BRANCH,
      isExpanded: true,
      createdAt: Date.now(),
    };

    await RepositoryModel.create(repo);
    this._onDidChange.fire();
    console.log('[StateStorage] addRepository: result:', repo);
    return repo;
  };

  getRepository = async (id: string): Promise<Repository | undefined> => {
    const repo = await RepositoryModel.findByPk(id);
    return repo?.get({ plain: true });
  };

  getAllRepositories = async (): Promise<Repository[]> => {
    const rows = await RepositoryModel.findAll({ order: [['createdAt', 'ASC']] });
    return rows.map((r) => r.get({ plain: true }));
  };

  getAllReposWithAgents = async (): Promise<RepoWithAgents[]> => {
    const [repos, agents] = await Promise.all([
      RepositoryModel.findAll({ order: [['createdAt', 'ASC']] }),
      AgentModel.findAll({ order: [['createdAt', 'ASC']] }),
    ]);

    const agentsByRepo = new Map<string, Agent[]>();
    for (const agent of agents) {
      const plain = agent.get({ plain: true });
      const list = agentsByRepo.get(plain.repoId);
      if (list) {
        list.push(plain);
      } else {
        agentsByRepo.set(plain.repoId, [plain]);
      }
    }

    return repos.map((r) => {
      const repo = r.get({ plain: true });
      return { ...repo, agents: agentsByRepo.get(repo.repositoryId) ?? [] };
    });
  };

  updateRepository = async (
    id: string,
    data: Partial<Pick<Repository, 'name' | 'stagingBranch'>>,
  ): Promise<Repository> => {
    const repo = await RepositoryModel.findByPk(id);
    if (!repo) {
      throw new Error(errRepoIdNotFound(id));
    }

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new Error(ERR_REPO_NAME_EMPTY);
      }
      repo.name = trimmed;
    }

    if (data.stagingBranch !== undefined) {
      const trimmed = data.stagingBranch.trim();
      if (!trimmed) {
        throw new Error(ERR_STAGING_BRANCH_EMPTY);
      }
      repo.stagingBranch = trimmed;
    }

    if (repo.changed()) {
      await repo.save();
      this._onDidChange.fire();
    }

    const result = repo.get({ plain: true });
    console.log('[StateStorage] updateRepository: result:', result);
    return result;
  };

  toggleRepoExpanded = async (id: string): Promise<void> => {
    const repo = await RepositoryModel.findByPk(id);
    if (!repo) {
      throw new Error(errRepoIdNotFound(id));
    }

    repo.isExpanded = !repo.isExpanded;
    await repo.save();
    this._onDidChange.fire();
    console.log('[StateStorage] toggleRepoExpanded:', { id, isExpanded: repo.isExpanded });
  };

  removeRepository = async (id: string): Promise<void> => {
    console.log('[StateStorage] removeRepository:', { id });
    const count = await RepositoryModel.destroy({ where: { repositoryId: id } });
    if (count > 0) {
      this._onDidChange.fire();
    }
  };

  // ── Agents ─────────────────────────────────────────────────────

  addAgent = async (repoId: string, name: string, cli: AgentCli): Promise<Agent> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error(ERR_AGENT_NAME_EMPTY);
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

    await this.sequelize.transaction(async (t) => {
      const repo = await RepositoryModel.findByPk(repoId, { transaction: t });
      if (!repo) {
        throw new Error(errRepoIdNotFound(repoId));
      }

      await AgentModel.create(agent, { transaction: t });
      await WorktreeModel.create(
        {
          worktreeId: randomUUID(),
          agentId: agent.agentId,
          path: worktreePath(repo.localPath, trimmedName),
        },
        { transaction: t },
      );
    });

    this._onDidChange.fire();
    console.log('[StateStorage] addAgent: result:', agent);
    return agent;
  };

  getAgent = async (id: string): Promise<Agent | undefined> => {
    const agent = await AgentModel.findByPk(id);
    return agent?.get({ plain: true });
  };

  getAgentsByRepo = async (repoId: string): Promise<Agent[]> => {
    const rows = await AgentModel.findAll({
      where: { repoId },
      order: [['createdAt', 'ASC']],
    });
    return rows.map((r) => r.get({ plain: true }));
  };

  updateAgent = async (
    id: string,
    data: Partial<Pick<Agent, 'name' | 'status' | 'sessionId' | 'lastPrompt' | 'startedAt' | 'completedAt'>>,
  ): Promise<Agent> => {
    const agent = await AgentModel.findByPk(id);
    if (!agent) {
      throw new Error(errAgentIdNotFound(id));
    }

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

    if (agent.changed()) {
      await agent.save();
      this._onDidChange.fire();
    }

    const result = agent.get({ plain: true });
    console.log('[StateStorage] updateAgent: result:', result);
    return result;
  };

  removeAgent = async (id: string): Promise<void> => {
    console.log('[StateStorage] removeAgent:', { id });
    const count = await AgentModel.destroy({ where: { agentId: id } });
    if (count > 0) {
      this._onDidChange.fire();
    }
  };

  focusAgent = async (agentId: string): Promise<void> => {
    const agent = await AgentModel.findByPk(agentId);
    if (!agent) {
      throw new Error(errAgentIdNotFound(agentId));
    }
    if (agent.isFocused) {
      return;
    }

    await this.sequelize.transaction(async (t) => {
      await AgentModel.update({ isFocused: false }, { where: { isFocused: true }, transaction: t });
      await AgentModel.update({ isFocused: true }, { where: { agentId }, transaction: t });
    });
    this._onDidChange.fire();
    console.log('[StateStorage] focusAgent:', { agentId });
  };


  // ── Worktrees (read-only) ─────────────────────────────────────

  getWorktree = async (agentId: string): Promise<Worktree | undefined> => {
    const worktree = await WorktreeModel.findOne({ where: { agentId } });
    return worktree?.get({ plain: true });
  };

  getAllWorktrees = async (): Promise<Worktree[]> => {
    const rows = await WorktreeModel.findAll();
    return rows.map((r) => r.get({ plain: true }));
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
    const row = await ExplorerStateModel.findByPk(scopeKey);
    if (!row) return [];
    try {
      return JSON.parse(row.expandedPaths);
    } catch {
      return [];
    }
  };

  setExpandedPaths = async (scopeKey: string, paths: string[]): Promise<void> => {
    await ExplorerStateModel.upsert({
      scopeKey,
      expandedPaths: JSON.stringify(paths),
    });
  };

  // ── Internal ───────────────────────────────────────────────────

  dispose = (): void => {
    this._onDidChange.dispose();
    void this.sequelize.close();
  };
}
