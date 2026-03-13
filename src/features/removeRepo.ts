import * as vscode from 'vscode';
import type { StateStorage } from '../db';

export const removeRepo = async (storage: StateStorage, repoId: string): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage('Repository not found.');
    return;
  }

  const isInWorkspace = (vscode.workspace.workspaceFolders ?? []).some(
    (wf) => wf.uri.fsPath === repo.localPath,
  );

  const REMOVE_WITH_WORKSPACE = 'Remove & Workspace';
  const buttons = isInWorkspace ? ['Remove', REMOVE_WITH_WORKSPACE] : ['Remove'];

  const confirm = await vscode.window.showWarningMessage(
    `Remove repository "${repo.name}"? This will also delete all its agents and worktrees.`,
    { modal: true },
    ...buttons,
  );

  if (!confirm) {
    return;
  }

  await storage.removeRepository(repoId);

  if (confirm === REMOVE_WITH_WORKSPACE) {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const idx = folders.findIndex((wf) => wf.uri.fsPath === repo.localPath);
    if (idx !== -1) {
      vscode.workspace.updateWorkspaceFolders(idx, 1);
    }
  }
};
