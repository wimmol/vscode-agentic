import * as vscode from 'vscode';
import type { StateStorage } from '../db';

export const repoRootClick = async (storage: StateStorage, repoId: string): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage('Repository not found.');
    return;
  }

  const current = vscode.workspace.workspaceFolders ?? [];
  const repoIndex = current.findIndex((f) => f.uri.fsPath === repo.localPath);

  if (repoIndex !== -1 && current.length === 1) {
    return;
  }

  await storage.persistAll();

  if (repoIndex === 0) {
    vscode.workspace.updateWorkspaceFolders(1, current.length - 1);
  } else {
    vscode.workspace.updateWorkspaceFolders(0, current.length, { uri: vscode.Uri.file(repo.localPath) });
  }
};
