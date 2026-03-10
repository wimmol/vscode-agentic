import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { Sequelize } from 'sequelize';
import { RepositoryModel, AgentModel, WorktreeModel } from './models';
import type { Repository, Worktree, Agent } from './models';
import type { AgentCli } from '../types/agent';

const BACKUP_KEYS = {
  repositories: 'backup:repositories',
  agents: 'backup:agents',
  worktrees: 'backup:worktrees',
} as const;

type TableName = keyof typeof BACKUP_KEYS;

/**
 * Manages all read/write operations against the in-memory SQLite database.
 *
 * Fits between the extension layer (commands, webview provider) and the
 * raw database — every public method validates input, mutates via Sequelize,
 * emits a change event, and persists affected tables to workspaceState.
 *
 * Exists as a class (rather than loose functions) because it owns the
 * Sequelize instance and the EventEmitter, both of which share a lifetime.
 */
export class StateStorage implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  constructor(
    private readonly sequelize: Sequelize,
    private readonly state: vscode.Memento,
  ) {}

  /** Restores data from workspaceState into the database. Called once after creation. */
  restore = async (): Promise<void> => {
    const repos = this.state.get<Repository[]>(BACKUP_KEYS.repositories, []);
    const agents = this.state.get<Agent[]>(BACKUP_KEYS.agents, []);
    const worktrees = this.state.get<Worktree[]>(BACKUP_KEYS.worktrees, []);

    await this.sequelize.transaction(async (t) => {
      await RepositoryModel.bulkCreate(repos, { ignoreDuplicates: true, transaction: t });
      await AgentModel.bulkCreate(agents, { ignoreDuplicates: true, transaction: t });
      await WorktreeModel.bulkCreate(worktrees, { ignoreDuplicates: true, transaction: t });
    });
  };

  // ── Repositories ───────────────────────────────────────────────

  addRepository = async (name: string, localPath: string, stagingBranch: string): Promise<Repository> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Repository name cannot be empty');
    }

    const trimmedPath = localPath.trim();
    if (!trimmedPath) {
      throw new Error('Repository path cannot be empty');
    }

    const repo: Repository = {
      repositoryId: randomUUID(),
      name: trimmedName,
      localPath: trimmedPath,
      stagingBranch: stagingBranch.trim() || 'staging',
      createdAt: Date.now(),
    };

    await RepositoryModel.create(repo);
    await this._changed(['repositories']);
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

  updateRepository = async (
    id: string,
    data: Partial<Pick<Repository, 'name' | 'stagingBranch'>>,
  ): Promise<Repository> => {
    const repo = await RepositoryModel.findByPk(id);
    if (!repo) {
      throw new Error(`Repository ${id} not found`);
    }

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new Error('Repository name cannot be empty');
      }
      repo.name = trimmed;
    }

    if (data.stagingBranch !== undefined) {
      const trimmed = data.stagingBranch.trim();
      if (!trimmed) {
        throw new Error('Staging branch cannot be empty');
      }
      repo.stagingBranch = trimmed;
    }

    if (repo.changed()) {
      await repo.save();
      await this._changed(['repositories']);
    }

    return repo.get({ plain: true });
  };

  removeRepository = async (id: string): Promise<void> => {
    const count = await RepositoryModel.destroy({ where: { repositoryId: id } });
    if (count > 0) {
      await this._changed(['repositories', 'agents', 'worktrees']);
    }
  };

  // ── Agents ─────────────────────────────────────────────────────

  addAgent = async (repoId: string, name: string, cli: AgentCli): Promise<Agent> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Agent name cannot be empty');
    }

    const agent: Agent = {
      agentId: randomUUID(),
      repoId,
      name: trimmedName,
      cli,
      status: 'created',
      sessionId: null,
      lastPrompt: null,
      startedAt: null,
      createdAt: Date.now(),
    };

    await this.sequelize.transaction(async (t) => {
      const repo = await RepositoryModel.findByPk(repoId, { transaction: t });
      if (!repo) {
        throw new Error(`Repository ${repoId} not found`);
      }

      await AgentModel.create(agent, { transaction: t });
      await WorktreeModel.create(
        {
          worktreeId: randomUUID(),
          agentId: agent.agentId,
          path: `${repo.localPath}/.worktrees/${trimmedName}`,
        },
        { transaction: t },
      );
    });

    await this._changed(['agents', 'worktrees']);
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
    data: Partial<Pick<Agent, 'name' | 'status' | 'sessionId' | 'lastPrompt' | 'startedAt'>>,
  ): Promise<Agent> => {
    const agent = await AgentModel.findByPk(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found`);
    }

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new Error('Agent name cannot be empty');
      }
      agent.name = trimmed;
    }

    if (data.status !== undefined) agent.status = data.status;
    if (data.sessionId !== undefined) agent.sessionId = data.sessionId;
    if (data.lastPrompt !== undefined) agent.lastPrompt = data.lastPrompt;
    if (data.startedAt !== undefined) agent.startedAt = data.startedAt;

    if (agent.changed()) {
      await agent.save();
      await this._changed(['agents']);
    }

    return agent.get({ plain: true });
  };

  removeAgent = async (id: string): Promise<void> => {
    const count = await AgentModel.destroy({ where: { agentId: id } });
    if (count > 0) {
      await this._changed(['agents', 'worktrees']);
    }
  };

  // ── Worktrees (read-only) ─────────────────────────────────────

  getWorktree = async (agentId: string): Promise<Worktree | undefined> => {
    const worktree = await WorktreeModel.findOne({ where: { agentId } });
    return worktree?.get({ plain: true });
  };

  // ── Internal ───────────────────────────────────────────────────

  private _changed = async (tables: TableName[]): Promise<void> => {
    await this._persist(tables);
    this._onDidChange.fire();
  };

  private _persist = async (tables: TableName[]): Promise<void> => {
    const readTable = async (table: TableName): Promise<unknown[]> => {
      switch (table) {
        case 'repositories': return (await RepositoryModel.findAll()).map((r) => r.get({ plain: true }));
        case 'agents': return (await AgentModel.findAll()).map((r) => r.get({ plain: true }));
        case 'worktrees': return (await WorktreeModel.findAll()).map((r) => r.get({ plain: true }));
      }
    };

    await Promise.all(
      tables.map(async (table) => {
        const rows = await readTable(table);
        await this.state.update(BACKUP_KEYS[table], rows);
      }),
    );
  };

  dispose = (): void => {
    this._onDidChange.dispose();
    void this.sequelize.close();
  };
}
