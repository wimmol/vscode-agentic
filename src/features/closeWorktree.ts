import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { TerminalService } from '../services/TerminalService';
import { removeWorktree, deleteBranch, hasUncommittedChanges } from '../services/GitService';
import {
  ERR_REPO_NOT_FOUND,
  dialogCloseWorktree,
  DIALOG_UNCOMMITTED_REMOVE,
  BTN_DELETE_WORKTREE,
} from '../constants/messages';

export const closeWorktree = async (
  storage: StateStorage,
  terminalService: TerminalService,
  repoId: string,
  branch: string,
): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  const worktree = await storage.getWorktreeByBranch(repoId, branch);
  const agents = await storage.getAgentsByRepoBranch(repoId, branch);

  let detail = dialogCloseWorktree(branch, agents.length);

  if (worktree) {
    const dirty = await hasUncommittedChanges(worktree.path);
    if (dirty) {
      detail += DIALOG_UNCOMMITTED_REMOVE;
    }
  }

  const choice = await vscode.window.showWarningMessage(detail, { modal: true }, BTN_DELETE_WORKTREE);
  if (choice !== BTN_DELETE_WORKTREE) {
    return;
  }

  // Kill all agent terminals and remove agents
  for (const agent of agents) {
    terminalService.closeTerminal(agent.agentId);
    await storage.removeAgent(agent.agentId);
  }

  // Remove worktree and branch
  if (worktree) {
    await removeWorktree(repo.localPath, worktree.path);
    await deleteBranch(repo.localPath, branch);
    await storage.removeWorktreeByBranch(repoId, branch);
  }
};
