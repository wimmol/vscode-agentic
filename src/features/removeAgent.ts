import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { TerminalService } from '../services/TerminalService';
import { removeWorktree, deleteBranch, hasUncommittedChanges } from '../services/GitService';

export const removeAgent = async (
  storage: StateStorage,
  terminalService: TerminalService,
  agentId: string,
): Promise<void> => {
  const ctx = await storage.getAgentContext(agentId);
  if (!ctx) {
    vscode.window.showErrorMessage('Agent, repository, or worktree not found.');
    return;
  }
  const { agent, repo, worktree } = ctx;

  let detail = `Remove agent "${agent.name}"?`;
  const dirty = await hasUncommittedChanges(worktree.path);
  if (dirty) {
    detail += ' The worktree has uncommitted changes that will be lost if deleted.';
  }

  const choice = await vscode.window.showWarningMessage(
    detail,
    { modal: true },
    'Delete Worktree',
    'Keep Worktree',
  );

  if (!choice) {
    return;
  }

  terminalService.closeTerminal(agentId);

  if (choice === 'Delete Worktree') {
    await removeWorktree(repo.localPath, worktree.path);
    await deleteBranch(repo.localPath, agent.name);
  }

  await storage.removeAgent(agentId);
};
