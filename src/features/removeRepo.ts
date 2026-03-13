import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import {
  ERR_REPO_NOT_FOUND,
  dialogRemoveRepo,
  BTN_REMOVE,
  BTN_REMOVE_WITH_WORKSPACE,
} from '../constants/messages';

export const removeRepo = async (storage: StateStorage, repoId: string): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  const isInWorkspace = (vscode.workspace.workspaceFolders ?? []).some(
    (wf) => wf.uri.fsPath === repo.localPath,
  );

  const buttons = isInWorkspace ? [BTN_REMOVE, BTN_REMOVE_WITH_WORKSPACE] : [BTN_REMOVE];

  const confirm = await vscode.window.showWarningMessage(
    dialogRemoveRepo(repo.name),
    { modal: true },
    ...buttons,
  );

  if (!confirm) {
    return;
  }

  await storage.removeRepository(repoId);

  if (confirm === BTN_REMOVE_WITH_WORKSPACE) {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const idx = folders.findIndex((wf) => wf.uri.fsPath === repo.localPath);
    if (idx !== -1) {
      vscode.workspace.updateWorkspaceFolders(idx, 1);
    }
  }
};
