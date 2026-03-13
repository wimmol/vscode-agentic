import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { TerminalService } from '../services/TerminalService';
import { INVALID_BRANCH_RE } from '../constants/git';
import { AGENT_CLI_CLAUDE_CODE } from '../constants/agent';
import {
  ERR_REPO_NOT_FOUND,
  ERR_BRANCH_EMPTY,
  ERR_BRANCH_INVALID,
  INPUT_ADD_AGENT_TITLE,
  INPUT_ADD_AGENT_PLACEHOLDER,
} from '../constants/messages';
import { worktreePath, ensureBranch, createWorktree, removeWorktree } from '../services/GitService';

const validateBranchName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return ERR_BRANCH_EMPTY;
  }
  if (INVALID_BRANCH_RE.test(trimmed)) {
    return ERR_BRANCH_INVALID;
  }
  return undefined;
};

export const addAgent = async (
  storage: StateStorage,
  terminalService: TerminalService,
  repoId: string,
): Promise<void> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  const name = await vscode.window.showInputBox({
    title: INPUT_ADD_AGENT_TITLE,
    placeHolder: INPUT_ADD_AGENT_PLACEHOLDER,
    validateInput: validateBranchName,
    ignoreFocusOut: true,
  });

  if (!name) {
    return;
  }

  const branch = name.trim();
  const repoPath = repo.localPath;
  const wtPath = worktreePath(repoPath, branch);

  await ensureBranch(repoPath, branch);
  await createWorktree(repoPath, wtPath, branch);

  let agent;
  try {
    agent = await storage.addAgent(repoId, branch, AGENT_CLI_CLAUDE_CODE);
  } catch (err) {
    await removeWorktree(repoPath, wtPath);
    throw err;
  }

  const terminal = terminalService.createTerminal(agent.agentId, branch, repo.name, wtPath);
  terminal.show(false);
};
