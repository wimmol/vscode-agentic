import { homedir } from 'os';
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

  const config = vscode.workspace.getConfiguration('terminal.integrated');
  config.update('cwd', homedir(), vscode.ConfigurationTarget.Workspace).then(undefined, (err) => {
    console.error('[rootClick] Failed to update terminal cwd:', err);
  });
};
