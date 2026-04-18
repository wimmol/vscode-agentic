import { execFile as execFileCb, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as vscode from 'vscode';
import { GIT_TIMEOUT, GIT_WORKTREE_TIMEOUT, GIT_MAX_BUFFER } from '../constants/git';
import { WORKTREES_DIR } from '../constants/paths';
import {
  GIT_STATUS_TIMEOUT_MS,
  GIT_COMMIT_TIMEOUT_MS,
  GIT_PUSH_TIMEOUT_MS,
  GIT_PULL_TIMEOUT_MS,
} from '../constants/sourceControl';
import type { FileChange } from '../types/sourceControl';
import { logger } from './Logger';

const execFile = promisify(execFileCb);

const gitOpts = (cwd: string, timeout = GIT_TIMEOUT) => ({
  cwd,
  timeout,
  maxBuffer: GIT_MAX_BUFFER,
});

/**
 * Per-repo worktree mutex: concurrent `git worktree add/remove` on the
 * same repo corrupts git's worktree list. Queue writes so only one
 * mutating worktree op runs per repo path at a time.
 */
const worktreeLocks = new Map<string, Promise<unknown>>();

const withWorktreeLock = async <T>(repoPath: string, fn: () => Promise<T>): Promise<T> => {
  const prev = worktreeLocks.get(repoPath) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  worktreeLocks.set(repoPath, next.catch(() => undefined));
  try {
    return await next;
  } finally {
    if (worktreeLocks.get(repoPath) === next.catch(() => undefined)) {
      worktreeLocks.delete(repoPath);
    }
  }
};

export const worktreePath = (repoPath: string, branch: string): string =>
  path.join(repoPath, WORKTREES_DIR, branch);

/**
 * Returns the name of the currently checked-out branch, or undefined if
 * detached HEAD / not a git repo / any other failure.
 */
export const getCurrentBranch = async (repoPath: string): Promise<string | undefined> => {
  try {
    const { stdout } = await execFile(
      'git',
      ['--no-optional-locks', 'symbolic-ref', '--short', 'HEAD'],
      gitOpts(repoPath),
    );
    const branch = stdout.trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Returns true when `cwd` is a linked worktree rather than the main repo.
 * Detects by comparing --git-dir (per-worktree) vs --git-common-dir (shared).
 */
export const isWorktree = async (cwd: string): Promise<boolean> => {
  try {
    const [gitDir, commonDir] = await Promise.all([
      execFile('git', ['--no-optional-locks', 'rev-parse', '--git-dir'], gitOpts(cwd)),
      execFile('git', ['--no-optional-locks', 'rev-parse', '--git-common-dir'], gitOpts(cwd)),
    ]);
    return path.resolve(cwd, gitDir.stdout.trim()) !== path.resolve(cwd, commonDir.stdout.trim());
  } catch {
    return false;
  }
};

/** Returns true if the named ref exists locally (branch, tag, etc.). */
const refExists = async (repoPath: string, ref: string): Promise<boolean> => {
  try {
    await execFile(
      'git',
      ['--no-optional-locks', 'rev-parse', '--verify', '--quiet', ref],
      gitOpts(repoPath),
    );
    return true;
  } catch {
    return false;
  }
};

export const ensureBranch = async (repoPath: string, branch: string): Promise<void> => {
  if (await refExists(repoPath, `refs/heads/${branch}`)) return;
  await execFile('git', ['branch', branch], gitOpts(repoPath));
};

export const createWorktree = async (repoPath: string, worktreePath: string, branch: string): Promise<void> => {
  await withWorktreeLock(repoPath, async () => {
    // If a worktree at that path already exists, `git worktree add` fails;
    // check the path up front instead of parsing the English error message.
    try {
      const entries = await listWorktrees(repoPath);
      if (entries.some((e) => e.path === worktreePath)) return;
    } catch {
      // listWorktrees is best-effort; fall through and let `add` error surface.
    }
    await execFile(
      'git',
      ['worktree', 'add', worktreePath, branch],
      gitOpts(repoPath, GIT_WORKTREE_TIMEOUT),
    );
  });
};

export const removeWorktree = async (repoPath: string, worktreePath: string): Promise<void> => {
  await withWorktreeLock(repoPath, async () => {
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
  });
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

  // Parse every block; skip entries whose path matches the requested repoPath
  // (the main worktree). Ordering of blocks is not guaranteed, so matching by
  // path is more robust than "skip index 0".
  for (const block of blocks) {
    const lines = block.split('\n');
    let wtPath = '';
    let branch = '';
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wtPath = line.slice('worktree '.length);
      } else if (line.startsWith('branch refs/heads/')) {
        branch = line.slice('branch refs/heads/'.length);
      }
    }
    if (!wtPath || !branch) continue;
    if (wtPath === repoPath) continue;
    entries.push({ path: wtPath, branch });
  }

  return entries;
};

// ── Source Control helpers ──────────────────────────────────────────────────

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
}

const run = (
  args: string[],
  cwd: string,
  timeoutMs: number,
  token?: vscode.CancellationToken,
): Promise<GitResult> =>
  new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd, timeout: timeoutMs });
    let stdout = '';
    let stderr = '';
    let truncated = false;

    const cancelSub = token?.onCancellationRequested(() => {
      // SIGTERM lets git flush its writes; spawn's `timeout` would SIGKILL.
      proc.kill('SIGTERM');
    });

    proc.stdout?.on('data', (chunk: Buffer) => {
      if (!truncated && stdout.length < GIT_MAX_BUFFER) {
        stdout += chunk.toString();
      } else {
        truncated = true;
      }
    });
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('error', (err) => {
      cancelSub?.dispose();
      reject(err);
    });
    proc.on('close', (code) => {
      cancelSub?.dispose();
      if (truncated) {
        logger.warn('git output truncated at GIT_MAX_BUFFER', { args, cwd });
      }
      resolve({ stdout, stderr, exitCode: code ?? 1, truncated });
    });
  });

export const gitStatus = async (cwd: string): Promise<FileChange[]> => {
  const { stdout } = await run(
    ['--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=all'],
    cwd,
    GIT_STATUS_TIMEOUT_MS,
  );

  if (!stdout) return [];

  const changes: FileChange[] = [];
  const entries = stdout.split('\0').filter(Boolean);
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    // Preserve the two-char porcelain XY so UI can distinguish staged vs unstaged.
    const rawStatus = entry.substring(0, 2);
    const status = rawStatus.trim() || rawStatus;
    const filePath = entry.substring(3);

    // Renames and copies have a second NUL-delimited field (the original name).
    if (rawStatus.startsWith('R') || rawStatus.startsWith('C')) {
      const fromPath = entries[i + 1];
      changes.push({ status, path: filePath, fromPath });
      i += 2;
    } else {
      changes.push({ status, path: filePath });
      i += 1;
    }
  }

  return changes;
};

export const gitCommit = async (cwd: string, message: string, paths?: string[]): Promise<GitResult> => {
  // If no paths supplied, refuse rather than silently staging everything.
  if (!paths || paths.length === 0) {
    return { stdout: '', stderr: 'Nothing to commit (no paths supplied).', exitCode: 1, truncated: false };
  }
  const addResult = await run(['add', '--', ...paths], cwd, GIT_COMMIT_TIMEOUT_MS);
  if (addResult.exitCode !== 0) return addResult;
  return run(['commit', '-m', message], cwd, GIT_COMMIT_TIMEOUT_MS);
};

export const gitPush = async (cwd: string, token?: vscode.CancellationToken): Promise<GitResult> =>
  run(['push'], cwd, GIT_PUSH_TIMEOUT_MS, token);

export const gitPull = async (cwd: string, token?: vscode.CancellationToken): Promise<GitResult> =>
  run(['pull'], cwd, GIT_PULL_TIMEOUT_MS, token);

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
