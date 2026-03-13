import { existsSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { BROWSE_LABEL, DEFAULT_STAGING_BRANCH } from '../constants/repo';
import { GIT_DIR } from '../constants/paths';
import {
  ERR_NOT_GIT_REPO,
  ERR_REPO_ALREADY_ADDED,
  INPUT_ADD_REPO_LABEL,
  INPUT_REPO_PICKER_PLACEHOLDER,
  INPUT_REPO_PICKER_EMPTY,
} from '../constants/messages';

interface RepoPickItem extends vscode.QuickPickItem {
  folderPath?: string;
}

const getWorkspaceGitFolders = (): RepoPickItem[] => {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders
    .filter((wf) => existsSync(path.join(wf.uri.fsPath, GIT_DIR)))
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
    openLabel: INPUT_ADD_REPO_LABEL,
  });

  if (!result || result.length === 0) {
    return undefined;
  }

  const folderPath = result[0].fsPath;

  if (!existsSync(path.join(folderPath, GIT_DIR))) {
    vscode.window.showErrorMessage(ERR_NOT_GIT_REPO);
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
      ? INPUT_REPO_PICKER_PLACEHOLDER
      : INPUT_REPO_PICKER_EMPTY,
    title: INPUT_ADD_REPO_LABEL,
  });

  if (!picked) {
    return;
  }

  const folderPath = picked.folderPath ?? await pickViaOsDialog();

  if (!folderPath) {
    return;
  }

  if (existingPaths.has(folderPath)) {
    vscode.window.showInformationMessage(ERR_REPO_ALREADY_ADDED);
    return;
  }

  const name = path.basename(folderPath);
  await storage.addRepository(name, folderPath, DEFAULT_STAGING_BRANCH);

  // Also add to the VS Code workspace if not already there.
  const alreadyInWorkspace = (vscode.workspace.workspaceFolders ?? []).some(
    (wf) => wf.uri.fsPath === folderPath,
  );
  if (!alreadyInWorkspace) {
    const insertAt = vscode.workspace.workspaceFolders?.length ?? 0;
    vscode.workspace.updateWorkspaceFolders(insertAt, 0, { uri: vscode.Uri.file(folderPath) });
  }
};
