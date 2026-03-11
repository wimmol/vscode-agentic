import * as vscode from 'vscode';
import { Sequelize } from 'sequelize';
import { initModels } from './models';
import { StateStorage } from './StateStorage';

export { StateStorage } from './StateStorage';

/** Creates a file-based SQLite database scoped to the current workspace and returns a StateStorage instance. */
export const createStateStorage = async (context: vscode.ExtensionContext): Promise<StateStorage> => {
  if (!context.storageUri) {
    vscode.window.showErrorMessage('Agentic: Open a folder or workspace to use this extension.');
    throw new Error('No workspace storage available.');
  }

  await vscode.workspace.fs.createDirectory(context.storageUri);
  const dbPath = vscode.Uri.joinPath(context.storageUri, 'state.db').fsPath;

  console.log('[createStateStorage] initializing SQLite at', dbPath);
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false,
  });

  await sequelize.query('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  initModels(sequelize);
  await sequelize.sync();
  console.log('[createStateStorage] SQLite ready');

  return new StateStorage(sequelize);
};
