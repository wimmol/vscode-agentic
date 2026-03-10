import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { AgentCli, AgentStatus } from '../types/agent';

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
  sessionId: string | null;
  lastPrompt: string | null;
  startedAt: number | null;
  createdAt: number;
}

// ── Sequelize models ────────────────────────────────────────────────

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
  declare sessionId: string | null;
  declare lastPrompt: string | null;
  declare startedAt: number | null;
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
    { sequelize, tableName: 'repositories', timestamps: false },
  );

  AgentModel.init(
    {
      agentId: { type: DataTypes.TEXT, primaryKey: true },
      repoId: { type: DataTypes.TEXT, allowNull: false },
      name: { type: DataTypes.TEXT, allowNull: false },
      cli: { type: DataTypes.TEXT, allowNull: false },
      status: { type: DataTypes.TEXT, allowNull: false },
      sessionId: { type: DataTypes.TEXT },
      lastPrompt: { type: DataTypes.TEXT },
      startedAt: { type: DataTypes.INTEGER },
      createdAt: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, tableName: 'agents', timestamps: false },
  );

  WorktreeModel.init(
    {
      worktreeId: { type: DataTypes.TEXT, primaryKey: true },
      agentId: { type: DataTypes.TEXT, allowNull: false, unique: true },
      path: { type: DataTypes.TEXT, allowNull: false },
    },
    { sequelize, tableName: 'worktrees', timestamps: false },
  );

  RepositoryModel.hasMany(AgentModel, { foreignKey: 'repoId', onDelete: 'CASCADE' });
  AgentModel.belongsTo(RepositoryModel, { foreignKey: 'repoId' });
  AgentModel.hasOne(WorktreeModel, { foreignKey: 'agentId', onDelete: 'CASCADE' });
  WorktreeModel.belongsTo(AgentModel, { foreignKey: 'agentId' });
};
