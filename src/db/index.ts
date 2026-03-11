import { Sequelize } from 'sequelize';
import type * as vscode from 'vscode';
import { initModels } from './models';
import { StateStorage } from './StateStorage';

export { StateStorage } from './StateStorage';

/** Creates an in-memory SQLite database via Sequelize, restores data from workspaceState, and returns a StateStorage instance. */
export const createStateStorage = async (context: vscode.ExtensionContext): Promise<StateStorage> => {
  console.log('[createStateStorage] initializing in-memory SQLite...');
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  });

  await sequelize.query('PRAGMA foreign_keys = ON');
  initModels(sequelize);
  await sequelize.sync();
  console.log('[createStateStorage] SQLite ready, restoring from workspaceState...');

  const storage = new StateStorage(sequelize, context.workspaceState);
  await storage.restore();
  console.log('[createStateStorage] restore complete');
  return storage;
};
