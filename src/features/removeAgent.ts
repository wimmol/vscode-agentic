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

  let detail = dialogRemoveAgent(agent.name);
  const dirty = await hasUncommittedChanges(worktree.path);
  if (dirty) {
    detail += DIALOG_UNCOMMITTED_REMOVE;
  }

  const choice = await vscode.window.showWarningMessage(
    detail,
    { modal: true },
    BTN_DELETE_WORKTREE,
    BTN_KEEP_WORKTREE,
  );

  if (!choice) {
    return;
  }

  terminalService.closeTerminal(agentId);

  if (choice === BTN_DELETE_WORKTREE) {
    await removeWorktree(repo.localPath, worktree.path);
    await deleteBranch(repo.localPath, agent.name);
  }

  await storage.removeAgent(agentId);
};
