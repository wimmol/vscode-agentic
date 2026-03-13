import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import { ERR_REPO_NOT_FOUND } from '../constants/messages';
import { CONFIG_TERMINAL_SECTION } from '../constants/views';

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

  explorer.showRepo(repoId, repo.localPath, repo.name);

  const config = vscode.workspace.getConfiguration(CONFIG_TERMINAL_SECTION);
  config.update('cwd', repo.localPath, vscode.ConfigurationTarget.Workspace).then(undefined, (err) => {
    console.error('[repoRootClick] Failed to update terminal cwd:', err);
  });
};
