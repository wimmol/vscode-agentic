import * as vscode from 'vscode';
import type { StateStorage } from '../db';

export const rootClick = async (storage: StateStorage): Promise<void> => {
  const repos = await storage.getAllRepositories();
  if (repos.length === 0) {
    vscode.window.showInformationMessage('No repositories added.');
    return;
  }

  const current = vscode.workspace.workspaceFolders ?? [];
  const currentPaths = new Set(current.map((f) => f.uri.fsPath));
  const missing = repos.filter((r) => !currentPaths.has(r.localPath));

  if (missing.length === 0) {
    return;
  }

  const newFolders = missing.map((r) => ({ uri: vscode.Uri.file(r.localPath) }));
  vscode.workspace.updateWorkspaceFolders(current.length, 0, ...newFolders);
};
