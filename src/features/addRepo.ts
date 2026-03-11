import { existsSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';

interface RepoPickItem extends vscode.QuickPickItem {
  folderPath?: string;
}

const BROWSE_LABEL = '$(folder-opened) Browse…';

const getWorkspaceGitFolders = (): RepoPickItem[] => {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders
    .filter((wf) => existsSync(path.join(wf.uri.fsPath, '.git')))
    .map((wf) => ({
      label: wf.name,
      description: wf.uri.fsPath,
      folderPath: wf.uri.fsPath,
    }));
};

const pickViaOsDialog = async (): Promise<string | undefined> => {
  const result = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Add Repository',
  });

  if (!result || result.length === 0) {
    return undefined;
  }

  const folderPath = result[0].fsPath;

  if (!existsSync(path.join(folderPath, '.git'))) {
    vscode.window.showErrorMessage('Selected folder is not a git repository (no .git found).');
    return undefined;
  }

  return folderPath;
};

export const addRepo = async (storage: StateStorage): Promise<void> => {
  const existingRepos = await storage.getAllRepositories();
  const existingPaths = new Set(existingRepos.map((r) => r.localPath));

  const suggestions = getWorkspaceGitFolders().filter((f) => !existingPaths.has(f.folderPath!));

  const items: RepoPickItem[] = [
    ...suggestions,
    ...(suggestions.length > 0 ? [{ label: '', kind: vscode.QuickPickItemKind.Separator }] : []),
    { label: BROWSE_LABEL, alwaysShow: true },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: suggestions.length > 0
      ? 'Select a workspace repository or browse…'
      : 'No workspace repositories found — browse to add one',
    title: 'Add Repository',
  });

  if (!picked) {
    return;
  }

  const folderPath = picked.folderPath ?? await pickViaOsDialog();

  if (!folderPath) {
    return;
  }

  if (existingPaths.has(folderPath)) {
    vscode.window.showInformationMessage('Repository is already added.');
    return;
  }

  const name = path.basename(folderPath);
  await storage.addRepository(name, folderPath, 'staging');
};
