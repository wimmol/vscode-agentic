import { existsSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';

export const addRepo = async (storage: StateStorage): Promise<void> => {
  const result = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Add Repository',
  });

  if (!result || result.length === 0) {
    return;
  }

  const folderPath = result[0].fsPath;

  if (!existsSync(path.join(folderPath, '.git'))) {
    vscode.window.showErrorMessage('Selected folder is not a git repository (no .git found).');
    return;
  }

  const name = path.basename(folderPath);

  await storage.addRepository(name, folderPath, 'staging');

  const alreadyInWorkspace = (vscode.workspace.workspaceFolders ?? []).some(
    (wf) => wf.uri.fsPath === folderPath,
  );

  if (!alreadyInWorkspace) {
    const index = vscode.workspace.workspaceFolders?.length ?? 0;
    vscode.workspace.updateWorkspaceFolders(index, 0, { uri: vscode.Uri.file(folderPath) });
  }
};
