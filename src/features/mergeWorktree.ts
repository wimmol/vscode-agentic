import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { AGENT_STATUS_RUNNING } from '../constants/agent';
import { ERR_REPO_NOT_FOUND, ERR_WORKTREE_NOT_FOUND } from '../constants/messages';
import { mergeBranch, abortMerge } from '../services/GitService';
import { logger } from '../services/Logger';

/**
 * Merge a worktree's branch into the repo's current branch with
 * `git merge --no-ff`. Refuses when any agent in the worktree is still
 * running; surfaces conflicts via a short error + detailed log.
 *
 * Does **not** remove the worktree on success — the user may still want to
 * inspect it. Deletion is a separate action (the trash button on the tab).
 */
export const mergeWorktree = async (
  storage: StateStorage,
  repoId: string,
  branch: string,
): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  const worktree = await storage.getWorktreeByBranch(repoId, branch);
  if (!worktree) {
    vscode.window.showErrorMessage(ERR_WORKTREE_NOT_FOUND);
    return;
  }

  if (branch === repo.currentBranch) {
    vscode.window.showWarningMessage(
      `"${branch}" is already the current branch; nothing to merge.`,
    );
    return;
  }

  const agents = await storage.getAgentsByRepoBranch(repoId, branch);
  const runningAgents = agents.filter((a) => a.status === AGENT_STATUS_RUNNING);
  if (runningAgents.length > 0) {
    const names = runningAgents.map((a) => a.name).join(', ');
    vscode.window.showErrorMessage(
      `Stop running agents before merging: ${names}.`,
    );
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Merge "${branch}" into "${repo.currentBranch}"?`,
    { modal: true, detail: 'Runs `git merge --no-ff` in the repo.' },
    'Merge',
  );
  if (choice !== 'Merge') return;

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Agentic: merging "${branch}"…`,
      cancellable: false,
    },
    async () => mergeBranch(repo.localPath, branch),
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `Merged "${branch}" into "${repo.currentBranch}".`,
    );
    return;
  }

  logger.error('mergeWorktree failed', undefined, {
    repoId,
    branch,
    outcome: result.outcome,
    stderr: result.stderr,
  });

  if (result.outcome === 'conflict') {
    const choice = await vscode.window.showErrorMessage(
      `Merge of "${branch}" has conflicts. Resolve them manually, or abort?`,
      'Abort merge',
      'Leave as is',
    );
    if (choice === 'Abort merge') {
      await abortMerge(repo.localPath);
      vscode.window.showInformationMessage('Merge aborted.');
    }
    return;
  }

  const firstLine = result.stderr.split('\n').find((l) => l.trim()) ?? 'unknown error';
  vscode.window.showErrorMessage(`Merge failed: ${firstLine}`);
};
