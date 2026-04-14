import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { TerminalService } from '../services/TerminalService';
import { removeWorktree, deleteBranch, hasUncommittedChanges } from '../services/GitService';
import {
  ERR_AGENT_CONTEXT_NOT_FOUND,
  dialogRemoveAgent,
  DIALOG_UNCOMMITTED_REMOVE,
  BTN_DELETE_WORKTREE,
  BTN_KEEP_WORKTREE,
  BTN_REMOVE,
} from '../constants/messages';

export const removeAgent = async (
  storage: StateStorage,
  terminalService: TerminalService,
  agentId: string,
): Promise<void> => {
  const ctx = await storage.getAgentContext(agentId);
  if (!ctx) {
    vscode.window.showErrorMessage(ERR_AGENT_CONTEXT_NOT_FOUND);
    return;
  }
  const { agent, repo, worktree } = ctx;
  const isCurrent = agent.branch === repo.currentBranch;

  let detail = dialogRemoveAgent(agent.name);
  const dirty = worktree ? await hasUncommittedChanges(worktree.path) : false;
  if (dirty) {
    detail += DIALOG_UNCOMMITTED_REMOVE;
  }

  // Check if this is the last agent on a worktree branch
  const branchAgents = isCurrent ? [] : await storage.getAgentsByRepoBranch(agent.repoId, agent.branch);
  const isLastOnWorktreeBranch = !isCurrent && branchAgents.length <= 1;

  // Current branch or shared worktree — simple confirm
  if (!isLastOnWorktreeBranch) {
    const choice = await vscode.window.showWarningMessage(detail, { modal: true }, BTN_REMOVE);
    if (!choice) return;

    terminalService.closeTerminal(agentId);
    await storage.removeAgent(agentId);
    return;
  }

  // Last agent on worktree branch — offer worktree deletion
  const choice = await vscode.window.showWarningMessage(
    detail,
    { modal: true },
    BTN_DELETE_WORKTREE,
    BTN_KEEP_WORKTREE,
  );

  if (!choice) return;

  terminalService.closeTerminal(agentId);

  if (choice === BTN_DELETE_WORKTREE && worktree) {
    await removeWorktree(repo.localPath, worktree.path);
    await deleteBranch(repo.localPath, agent.branch);
    await storage.removeWorktreeByBranch(agent.repoId, agent.branch);
  }

  await storage.removeAgent(agentId);
};
