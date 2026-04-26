import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { ERR_REPO_NOT_FOUND } from '../constants/messages';
import { worktreePath, ensureBranch, createWorktree, removeWorktree } from '../services/GitService';
import { nextBranchName, validateBranchName } from './branchNaming';

const INPUT_TITLE = 'New Worktree';
const INPUT_PLACEHOLDER = 'Branch name for the new worktree';

/**
 * Creates a worktree on a repo — just the worktree. No agent is spawned.
 * Asks for a branch name (pre-filling a unique `tree-N` suggestion),
 * creates the branch if it doesn't exist, adds the worktree.
 */
export const newWorktree = async (
  storage: StateStorage,
  repoId: string,
): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  const existing = (await storage.getAllWorktrees()).filter((w) => w.repoId === repoId);
  const existingBranches = new Set(existing.map((w) => w.branch));
  const suggested = nextBranchName('tree', existingBranches);

  const raw = await vscode.window.showInputBox({
    title: INPUT_TITLE,
    placeHolder: INPUT_PLACEHOLDER,
    value: suggested,
    valueSelection: [0, suggested.length],
    validateInput: (v) => {
      const trimmed = v.trim();
      // Empty → falls back to the suggested name; non-empty validates normally.
      if (!trimmed) return undefined;
      return validateBranchName(v);
    },
    ignoreFocusOut: true,
  });
  if (raw === undefined) return;
  const branch = raw.trim() || suggested;

  const repoPath = repo.localPath;
  const wtPath = worktreePath(repoPath, branch);

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Agentic: creating worktree "${branch}"…`,
        cancellable: false,
      },
      async () => {
        await ensureBranch(repoPath, branch);
        await createWorktree(repoPath, wtPath, branch);
        await storage.addWorktree(repoId, branch, wtPath);
      },
    );
  } catch (err) {
    // Best-effort cleanup on partial failure.
    await removeWorktree(repoPath, wtPath);
    throw err;
  }
};
