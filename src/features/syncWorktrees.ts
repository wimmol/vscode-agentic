import type { StateStorage } from '../db';
import { listWorktrees } from '../services/GitService';

/**
 * Sync stored worktrees with actual git worktree state for all repos.
 * Adds worktrees discovered in git but missing from storage.
 * Removes stored worktrees that no longer exist in git.
 */
export const syncWorktrees = async (storage: StateStorage): Promise<void> => {
  const [repos, allStored] = await Promise.all([
    storage.getAllRepositories(),
    storage.getAllWorktrees(),
  ]);

  // Fetch git worktrees for all repos in parallel
  const repoWorktrees = await Promise.all(
    repos.map(async (repo) => ({
      repo,
      gitWorktrees: await listWorktrees(repo.localPath),
    })),
  );

  // Storage writes serialize internally via the write lock, so there's no
  // correctness benefit to awaiting each call — but running them concurrently
  // amortises the lock acquisition round-trips when many worktrees diverge.
  const writes: Promise<unknown>[] = [];
  for (const { repo, gitWorktrees } of repoWorktrees) {
    const stored = allStored.filter((w) => w.repoId === repo.repositoryId);
    const storedByBranch = new Map(stored.map((w) => [w.branch, w]));
    const gitByBranch = new Map(gitWorktrees.map((w) => [w.branch, w]));

    for (const gw of gitWorktrees) {
      if (!storedByBranch.has(gw.branch)) {
        writes.push(storage.addWorktree(repo.repositoryId, gw.branch, gw.path));
      }
    }

    for (const sw of stored) {
      if (!gitByBranch.has(sw.branch)) {
        writes.push(storage.removeWorktreeByBranch(repo.repositoryId, sw.branch));
      }
    }
  }
  await Promise.all(writes);
};
