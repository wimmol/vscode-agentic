import * as path from 'path';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { BROWSE_LABEL, DEFAULT_CURRENT_BRANCH } from '../constants/repo';
import { GIT_DIR } from '../constants/paths';
import { getCurrentBranch } from '../services/GitService';
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

const pathExists = async (p: string): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(p));
    return true;
  } catch {
    return false;
  }
};

const getWorkspaceGitFolders = async (): Promise<RepoPickItem[]> => {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const results: RepoPickItem[] = [];
  for (const wf of folders) {
    if (await pathExists(path.join(wf.uri.fsPath, GIT_DIR))) {
      results.push({
        label: wf.name,
        description: wf.uri.fsPath,
        folderPath: wf.uri.fsPath,
      });
    }
  }
  return results;
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

  if (!(await pathExists(path.join(folderPath, GIT_DIR)))) {
    vscode.window.showErrorMessage(ERR_NOT_GIT_REPO);
    return undefined;
  }

  return folderPath;
};

export const addRepo = async (storage: StateStorage): Promise<void> => {
  const existingRepos = await storage.getAllRepositories();
  const existingPaths = new Set(existingRepos.map((r) => r.localPath));

  const folderSuggestions = await getWorkspaceGitFolders();
  const suggestions = folderSuggestions.filter((f) => !existingPaths.has(f.folderPath!));

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
  const branch = (await getCurrentBranch(folderPath)) ?? DEFAULT_CURRENT_BRANCH;
  await storage.addRepository(name, folderPath, branch);

  // Also add to the VS Code workspace if not already there. Skip the add if
  // the workspace is empty — calling updateWorkspaceFolders(0, 0, …) on an
  // empty workspace restarts the extension host and kills every agent
  // terminal. Tell the user how to open the folder manually instead.
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const alreadyInWorkspace = workspaceFolders.some((wf) => wf.uri.fsPath === folderPath);
  if (!alreadyInWorkspace) {
    if (workspaceFolders.length === 0) {
      vscode.window
        .showInformationMessage(
          `Added "${name}". Open it as a folder to work with its files.`,
          'Open Folder',
        )
        .then((choice) => {
          if (choice === 'Open Folder') {
            void vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folderPath), true);
          }
        });
    } else {
      vscode.workspace.updateWorkspaceFolders(workspaceFolders.length, 0, {
        uri: vscode.Uri.file(folderPath),
      });
    }
  }
};
