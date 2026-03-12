import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';

const execFile = promisify(execFileCb);

const INVALID_BRANCH_RE = /[~^:?*[\\\s]|\.\.|\.lock$/;

const GIT_TIMEOUT = 30_000;
const GIT_WORKTREE_TIMEOUT = 120_000;
const GIT_MAX_BUFFER = 10 * 1024 * 1024;

const gitOpts = (cwd: string, timeout = GIT_TIMEOUT) => ({
  cwd,
  timeout,
  maxBuffer: GIT_MAX_BUFFER,
});

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

const ensureBranch = async (repoPath: string, branch: string): Promise<void> => {
  try {
    await execFile('git', ['branch', branch], gitOpts(repoPath));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('already exists')) {
      throw err;
    }
  }
};

const createWorktree = async (repoPath: string, worktreePath: string, branch: string): Promise<void> => {
  await execFile(
    'git',
    ['worktree', 'add', worktreePath, branch],
    gitOpts(repoPath, GIT_WORKTREE_TIMEOUT),
  );
};

const removeWorktree = async (repoPath: string, worktreePath: string): Promise<void> => {
  try {
    await execFile('git', ['worktree', 'remove', '--force', worktreePath], gitOpts(repoPath));
  } catch {
    // Best-effort cleanup — log but don't throw.
  }
};

export const addAgent = async (storage: StateStorage, repoId: string): Promise<void> => {
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
  const worktreePath = `${repoPath}/.worktrees/${branch}`;

  await ensureBranch(repoPath, branch);
  await createWorktree(repoPath, worktreePath, branch);

  try {
    await storage.addAgent(repoId, branch, 'claude-code');
  } catch (err) {
    await removeWorktree(repoPath, worktreePath);
    throw err;
  }

  const agentCommand = vscode.workspace.getConfiguration('vscode-agentic').get<string>('agentCommand', 'claude');

  const terminal = vscode.window.createTerminal({
    name: `${branch} (${repo.name})`,
    cwd: worktreePath,
    location: { viewColumn: vscode.ViewColumn.Two },
  });

  terminal.sendText(agentCommand);
};
