import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { removeWorktree, deleteBranch } from '../services/GitService';

export const removeAgent = async (storage: StateStorage, agentId: string): Promise<void> => {
  const agent = await storage.getAgent(agentId);
  if (!agent) {
    vscode.window.showErrorMessage('Agent not found.');
    return;
  }

  const [repo, worktree] = await Promise.all([
    storage.getRepository(agent.repoId),
    storage.getWorktree(agentId),
  ]);

  if (!repo) {
    vscode.window.showErrorMessage('Repository not found.');
    return;
  }

  if (!worktree) {
    vscode.window.showErrorMessage('Worktree not found.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Remove agent "${agent.name}"? This will delete its worktree and branch.`,
    { modal: true },
    'Remove',
  );

  if (confirm !== 'Remove') {
    return;
  }

  await removeWorktree(repo.localPath, worktree.path);
  await deleteBranch(repo.localPath, agent.name);
  await storage.removeAgent(agentId);
};
