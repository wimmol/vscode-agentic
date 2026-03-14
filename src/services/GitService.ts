import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { GIT_TIMEOUT, GIT_WORKTREE_TIMEOUT, GIT_MAX_BUFFER } from '../constants/git';
import { WORKTREES_DIR } from '../constants/paths';

const execFile = promisify(execFileCb);

const gitOpts = (cwd: string, timeout = GIT_TIMEOUT) => ({
  cwd,
  timeout,
  maxBuffer: GIT_MAX_BUFFER,
});

export const worktreePath = (repoPath: string, branch: string): string =>
  `${repoPath}/${WORKTREES_DIR}/${branch}`;

export const ensureBranch = async (repoPath: string, branch: string): Promise<void> => {
  try {
    await execFile('git', ['branch', branch], gitOpts(repoPath));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('already exists')) {
      throw err;
    }
  }
};

export const createWorktree = async (repoPath: string, worktreePath: string, branch: string): Promise<void> => {
  try {
    await execFile(
      'git',
      ['worktree', 'add', worktreePath, branch],
      gitOpts(repoPath, GIT_WORKTREE_TIMEOUT),
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('already exists')) {
      throw err;
    }
  }
};

export const removeWorktree = async (repoPath: string, worktreePath: string): Promise<void> => {
  try {
    await execFile('git', ['worktree', 'remove', '--force', worktreePath], gitOpts(repoPath, GIT_WORKTREE_TIMEOUT));
  } catch {
    // Best-effort — worktree may already be gone.
  }
  try {
    await execFile('git', ['worktree', 'prune'], gitOpts(repoPath));
  } catch {
    // Best-effort cleanup.
  }
};

export const hasUncommittedChanges = async (wtPath: string): Promise<boolean> => {
  try {
    const { stdout } = await execFile(
      'git',
      ['status', '--porcelain', '-z', '--no-optional-locks'],
      gitOpts(wtPath),
    );
    return stdout.length > 0;
  } catch {
    return false;
  }
};

export const deleteBranch = async (repoPath: string, branch: string): Promise<void> => {
  try {
    await execFile('git', ['branch', '-D', branch], gitOpts(repoPath));
  } catch {
    // Best-effort — branch may not exist or may be checked out elsewhere.
  }
};

export interface GitWorktreeEntry {
  path: string;
  branch: string;
}

/**
 * List all git worktrees except the main one.
 * Parses `git worktree list --porcelain` output.
 */
export const listWorktrees = async (repoPath: string): Promise<GitWorktreeEntry[]> => {
  let stdout: string;
  try {
    const result = await execFile(
      'git',
      ['--no-optional-locks', 'worktree', 'list', '--porcelain'],
      gitOpts(repoPath),
    );
    stdout = result.stdout;
  } catch {
    return [];
  }

  const entries: GitWorktreeEntry[] = [];
  const blocks = stdout.split('\n\n').filter((b) => b.trim());

  // Skip the first block — it's the main worktree
  for (let i = 1; i < blocks.length; i++) {
    const lines = blocks[i].split('\n');
    let path = '';
    let branch = '';
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.slice('worktree '.length);
      } else if (line.startsWith('branch refs/heads/')) {
        branch = line.slice('branch refs/heads/'.length);
      }
    }
    if (path && branch) {
      entries.push({ path, branch });
    }
  }

  return entries;
};
