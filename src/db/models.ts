import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { AgentCli, AgentStatus } from '../types/agent';
import {
  TABLE_REPOSITORIES,
  TABLE_AGENTS,
  TABLE_WORKTREES,
  TABLE_EXPLORER_STATE,
} from '../constants/db';

// ── Attribute interfaces (plain objects for UI / transport) ─────────

export interface Repository {
  repositoryId: string;
  name: string;
  localPath: string;
  stagingBranch: string;
  isExpanded: boolean;
  createdAt: number;
}

export interface Worktree {
  worktreeId: string;
  agentId: string;
  path: string;
}

export interface Agent {
  agentId: string;
  repoId: string;
  name: string;
  cli: AgentCli;
  status: AgentStatus;
  isFocused: boolean;
  sessionId: string | null;
  lastPrompt: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

export interface ExplorerState {
  scopeKey: string;
  expandedPaths: string;
}

// ── Sequelize models ────────────────────────────────────────────────

export class ExplorerStateModel extends Model<ExplorerState> implements ExplorerState {
  declare scopeKey: string;
  declare expandedPaths: string;
}

export class RepositoryModel extends Model<Repository> implements Repository {
  declare repositoryId: string;
  declare name: string;
  declare localPath: string;
  declare stagingBranch: string;
  declare isExpanded: boolean;
  declare createdAt: number;
}

export class AgentModel extends Model<Agent> implements Agent {
  declare agentId: string;
  declare repoId: string;
  declare name: string;
  declare cli: AgentCli;
  declare status: AgentStatus;
  declare isFocused: boolean;
  declare sessionId: string | null;
  declare lastPrompt: string | null;
  declare startedAt: number | null;
  declare completedAt: number | null;
  declare createdAt: number;
}

export class WorktreeModel extends Model<Worktree> implements Worktree {
  declare worktreeId: string;
  declare agentId: string;
  declare path: string;
}

// ── Init & associations ─────────────────────────────────────────────

export const initModels = (sequelize: Sequelize): void => {
  RepositoryModel.init(
    {
      repositoryId: { type: DataTypes.TEXT, primaryKey: true },
      name: { type: DataTypes.TEXT, allowNull: false },
      localPath: { type: DataTypes.TEXT, allowNull: false, unique: true },
      stagingBranch: { type: DataTypes.TEXT, allowNull: false },
      isExpanded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, tableName: TABLE_REPOSITORIES, timestamps: false },
  );

  AgentModel.init(
    {
      agentId: { type: DataTypes.TEXT, primaryKey: true },
      repoId: { type: DataTypes.TEXT, allowNull: false },
      name: { type: DataTypes.TEXT, allowNull: false },
      cli: { type: DataTypes.TEXT, allowNull: false },
      status: { type: DataTypes.TEXT, allowNull: false },
      isFocused: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sessionId: { type: DataTypes.TEXT },
      lastPrompt: { type: DataTypes.TEXT },
      startedAt: { type: DataTypes.INTEGER },
      completedAt: { type: DataTypes.INTEGER },
      createdAt: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, tableName: TABLE_AGENTS, timestamps: false },
  );

  WorktreeModel.init(
    {
      worktreeId: { type: DataTypes.TEXT, primaryKey: true },
      agentId: { type: DataTypes.TEXT, allowNull: false, unique: true },
      path: { type: DataTypes.TEXT, allowNull: false },
    },
    { sequelize, tableName: TABLE_WORKTREES, timestamps: false },
  );

  ExplorerStateModel.init(
    {
      scopeKey: { type: DataTypes.TEXT, primaryKey: true },
      expandedPaths: { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
    },
    { sequelize, tableName: TABLE_EXPLORER_STATE, timestamps: false },
  );

  RepositoryModel.hasMany(AgentModel, { foreignKey: 'repoId', onDelete: 'CASCADE' });
  AgentModel.belongsTo(RepositoryModel, { foreignKey: 'repoId' });
  AgentModel.hasOne(WorktreeModel, { foreignKey: 'agentId', onDelete: 'CASCADE' });
  WorktreeModel.belongsTo(AgentModel, { foreignKey: 'agentId' });
};
