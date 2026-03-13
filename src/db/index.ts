import * as vscode from 'vscode';
import { StateStorage } from './StateStorage';

export { StateStorage } from './StateStorage';

/** Creates a StateStorage backed by VS Code workspaceState. */
export const createStateStorage = (context: vscode.ExtensionContext): StateStorage => {
  return new StateStorage(context.workspaceState);
};
