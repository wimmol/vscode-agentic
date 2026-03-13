import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { TerminalService } from '../services/TerminalService';
import { INVALID_BRANCH_RE } from '../constants/git';
import { worktreePath, ensureBranch, createWorktree, removeWorktree } from '../services/GitService';

const validateBranchName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Branch name cannot be empty';
  }
  if (INVALID_BRANCH_RE.test(trimmed)) {
    return 'Invalid branch name (contains forbidden characters)';
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
    vscode.window.showErrorMessage('Repository not found.');
    return;
  }

  const name = await vscode.window.showInputBox({
    title: 'Add Agent',
    placeHolder: 'Branch name for the agent',
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
    agent = await storage.addAgent(repoId, branch, 'claude-code');
  } catch (err) {
    await removeWorktree(repoPath, wtPath);
    throw err;
  }

  const terminal = terminalService.createTerminal(agent.agentId, branch, repo.name, wtPath);
  terminal.show(false);
};
