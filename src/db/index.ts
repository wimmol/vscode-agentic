import * as vscode from 'vscode';
import { Sequelize } from 'sequelize';
import { initModels } from './models';
import { StateStorage } from './StateStorage';
import { DB_FILENAME, DB_DIALECT, DB_PRAGMA } from '../constants/db';
import { ERR_NO_WORKSPACE, ERR_NO_WORKSPACE_STORAGE } from '../constants/messages';

export { StateStorage } from './StateStorage';

/** Creates a file-based SQLite database scoped to the current workspace and returns a StateStorage instance. */
export const createStateStorage = async (context: vscode.ExtensionContext): Promise<StateStorage> => {
  if (!context.storageUri) {
    vscode.window.showErrorMessage(ERR_NO_WORKSPACE);
    throw new Error(ERR_NO_WORKSPACE_STORAGE);
  }

  await vscode.workspace.fs.createDirectory(context.storageUri);
  const dbPath = vscode.Uri.joinPath(context.storageUri, DB_FILENAME).fsPath;

  console.log('[createStateStorage] initializing SQLite at', dbPath);
  const sequelize = new Sequelize({
    dialect: DB_DIALECT,
    storage: dbPath,
    logging: false,
  });

  await sequelize.query(DB_PRAGMA);
  initModels(sequelize);
  await sequelize.sync();
  console.log('[createStateStorage] SQLite ready');

  return new StateStorage(sequelize);
};
