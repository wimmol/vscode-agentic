import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';

export const rootClick = async (storage: StateStorage, explorer: FileExplorerProvider): Promise<void> => {
  const repos = await storage.getAllRepositories();
  if (repos.length === 0) {
    vscode.window.showInformationMessage('No repositories added.');
    return;
  }

  explorer.showAllRepos(repos.map((r) => r.localPath));
};
