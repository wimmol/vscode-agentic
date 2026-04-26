import * as path from 'path';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { GIT_DIR } from '../constants/paths';
import { DEFAULT_CURRENT_BRANCH } from '../constants/repo';
import { getCurrentBranch } from '../services/GitService';
import { logger } from '../services/Logger';

/** Async variant of fs.existsSync so we don't block during activation. */
const pathExists = async (p: string): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(p));
    return true;
  } catch {
    return false;
  }
};

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
    if (existingPaths.has(fsPath)) continue;
    if (!(await pathExists(path.join(fsPath, GIT_DIR)))) continue;
    const branch = (await getCurrentBranch(fsPath)) ?? DEFAULT_CURRENT_BRANCH;
    await storage.addRepository(folder.name, fsPath, branch);
  }
};

/**
 * For every tracked repo, re-detect the real current branch via git and
 * update storage if it differs from the stored value. Lets repos that were
 * saved with the 'current' placeholder pick up their real branch name.
 */
export const refreshCurrentBranches = async (storage: StateStorage): Promise<void> => {
  const repos = await storage.getAllRepositories();
  // Git detection per repo is independent — run concurrently so N repos don't
  // add N× spawn latency to activation's deferred path.
  const detected = await Promise.all(repos.map((r) => getCurrentBranch(r.localPath)));
  await Promise.all(
    repos.map(async (repo, i) => {
      const next = detected[i];
      if (!next || next === repo.currentBranch) return;
      try {
        await storage.updateRepository(repo.repositoryId, { currentBranch: next });
      } catch (err) {
        logger.warn('refreshCurrentBranches update failed', { repo: repo.name, err: String(err) });
      }
    }),
  );
};
