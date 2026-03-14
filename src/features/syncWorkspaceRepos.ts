import { existsSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { GIT_DIR } from '../constants/paths';
import { DEFAULT_DEVELOP_BRANCH } from '../constants/repo';

/**
 * Adds every workspace folder that contains a `.git` directory
 * to the extension's repository list (skipping duplicates).
 * Called once during activation so the extension stays in sync
 * with whatever the user already has open.
 */
export const syncWorkspaceRepos = async (storage: StateStorage): Promise<void> => {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return;
  }

  const existingRepos = await storage.getAllRepositories();
  const existingPaths = new Set(existingRepos.map((r) => r.localPath));

  for (const folder of folders) {
    const fsPath = folder.uri.fsPath;
    if (existingPaths.has(fsPath)) {
      continue;
    }
    if (!existsSync(path.join(fsPath, GIT_DIR))) {
      continue;
    }
    await storage.addRepository(folder.name, fsPath, DEFAULT_DEVELOP_BRANCH);
  }
};
