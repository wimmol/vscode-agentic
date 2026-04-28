import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import { ERR_REPO_NOT_FOUND } from '../constants/messages';

export const repoRootClick = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  repoId: string,
): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  explorer.showRepo(repo.localPath, repo.name);
};
