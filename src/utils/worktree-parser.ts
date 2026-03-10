import type { WorktreeOnDisk } from "../models/worktree";

/**
 * Parses the output of `git worktree list --porcelain` into structured objects.
 *
 * Porcelain format:
 *   worktree /path/to/worktree
 *   HEAD <sha>
 *   branch refs/heads/<name>   (or "detached" for detached HEAD)
 *   locked                     (optional)
 *   prunable                   (optional)
 *
 * Entries are separated by blank lines.
 */
export const parseWorktreeList = (output: string): WorktreeOnDisk[] => {
	const trimmed = output.trim();
	if (!trimmed) {
		return [];
	}

	// Split into blocks by blank lines
	const blocks = trimmed.split(/\n\n+/);
	const results: WorktreeOnDisk[] = [];

	for (const block of blocks) {
		const lines = block.trim().split("\n");
		if (lines.length === 0 || !lines[0].startsWith("worktree ")) {
			continue;
		}

		let path = "";
		let head = "";
		let branch: string | null = null;
		let locked = false;
		let prunable = false;

		for (const line of lines) {
			if (line.startsWith("worktree ")) {
				path = line.slice("worktree ".length);
			} else if (line.startsWith("HEAD ")) {
				head = line.slice("HEAD ".length);
			} else if (line.startsWith("branch ")) {
				const raw = line.slice("branch ".length);
				branch = raw.startsWith("refs/heads/") ? raw.slice("refs/heads/".length) : raw;
			} else if (line === "detached") {
				branch = null;
			} else if (line === "locked") {
				locked = true;
			} else if (line === "prunable") {
				prunable = true;
			}
		}

		results.push({ path, head, branch, locked, prunable });
	}

	return results;
};
