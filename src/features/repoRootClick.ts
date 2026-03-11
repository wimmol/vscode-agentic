import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';

export const repoRootClick = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  repoId: string,
): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage('Repository not found.');
    return;
  }

  explorer.showRepo(repoId, repo.localPath);
};
