import * as vscode from 'vscode';
import type { StateStorage } from '../db';

export const removeRepo = async (storage: StateStorage, repoId: string): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage('Repository not found.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Remove repository "${repo.name}"? This will also delete all its agents and worktrees.`,
    { modal: true },
    'Remove',
  );

  if (confirm !== 'Remove') {
    return;
  }

  await storage.removeRepository(repoId);
};
