import { execFile as execFileCb, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { GIT_TIMEOUT, GIT_WORKTREE_TIMEOUT, GIT_MAX_BUFFER } from '../constants/git';
import { WORKTREES_DIR } from '../constants/paths';
import {
  GIT_STATUS_TIMEOUT_MS,
  GIT_COMMIT_TIMEOUT_MS,
  GIT_PUSH_TIMEOUT_MS,
  GIT_PULL_TIMEOUT_MS,
} from '../constants/sourceControl';
import type { FileChange } from '../types/sourceControl';

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
    let wtPath = '';
    let branch = '';
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wtPath = line.slice('worktree '.length);
      } else if (line.startsWith('branch refs/heads/')) {
        branch = line.slice('branch refs/heads/'.length);
      }
    }
    if (wtPath && branch) {
      entries.push({ path: wtPath, branch });
    }
  }

  return entries;
};

// ── Source Control helpers ──────────────────────────────────────────────────

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const run = (args: string[], cwd: string, timeoutMs: number): Promise<GitResult> =>
  new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd, timeout: timeoutMs });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });

export const gitStatus = async (cwd: string): Promise<FileChange[]> => {
  const { stdout } = await run(
    ['--no-optional-locks', 'status', '--porcelain', '-z'],
    cwd,
    GIT_STATUS_TIMEOUT_MS,
  );

  if (!stdout) return [];

  const changes: FileChange[] = [];
  const entries = stdout.split('\0').filter(Boolean);
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    const status = entry.substring(0, 2).trim();
    const filePath = entry.substring(3);

    // Renames and copies have a second NUL-delimited field (the original name) — skip it
    if (status.startsWith('R') || status.startsWith('C')) {
      i += 2;
    } else {
      i += 1;
    }

    changes.push({ status, path: filePath });
  }

  return changes;
};

export const gitCommit = async (cwd: string, message: string): Promise<GitResult> => {
  const addResult = await run(['add', '-A'], cwd, GIT_COMMIT_TIMEOUT_MS);
  if (addResult.exitCode !== 0) return addResult;
  return run(['commit', '-m', message], cwd, GIT_COMMIT_TIMEOUT_MS);
};

export const gitPush = async (cwd: string): Promise<GitResult> =>
  run(['push'], cwd, GIT_PUSH_TIMEOUT_MS);

export const gitPull = async (cwd: string): Promise<GitResult> =>
  run(['pull'], cwd, GIT_PULL_TIMEOUT_MS);

export const gitDiffStat = async (cwd: string): Promise<string> => {
  const staged = await run(
    ['--no-optional-locks', 'diff', '--cached', '--stat'],
    cwd,
    GIT_STATUS_TIMEOUT_MS,
  );
  if (staged.stdout.trim()) return staged.stdout;

  const unstaged = await run(
    ['--no-optional-locks', 'diff', '--stat'],
    cwd,
    GIT_STATUS_TIMEOUT_MS,
  );
  return unstaged.stdout;
};

/** Generate a short commit message from a list of file changes. */
export const suggestCommitMessage = (changes: FileChange[]): string => {
  if (changes.length === 0) return 'no changes';

  const added = changes.filter((c) => c.status === '??' || c.status === 'A');
  const modified = changes.filter((c) => c.status === 'M' || c.status === 'MM');
  const deleted = changes.filter((c) => c.status === 'D');

  const parts: string[] = [];

  const formatNames = (items: FileChange[], limit: number): string => {
    const names = items.map((i) => path.basename(i.path, path.extname(i.path)));
    if (names.length <= limit) return names.join(', ');

    // Find common directory
    const dirs = new Set(items.map((i) => {
      const dir = path.dirname(i.path);
      return dir === '.' ? 'root' : dir.split(path.sep).pop()!;
    }));
    if (dirs.size === 1) return `${items.length} files in ${[...dirs][0]}`;
    return `${items.length} files`;
  };

  if (added.length > 0) parts.push(`add ${formatNames(added, 3)}`);
  if (modified.length > 0) parts.push(`update ${formatNames(modified, 3)}`);
  if (deleted.length > 0) parts.push(`remove ${formatNames(deleted, 3)}`);

  return parts.join(', ') || 'update files';
};
