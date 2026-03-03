import type { WorktreeOnDisk } from "../models/worktree.js";

/**
 * Parses the output of `git worktree list --porcelain` into structured objects.
 *
 * The porcelain format uses blank lines to separate worktree entries.
 * Each entry has lines like:
 *   worktree /path/to/worktree
 *   HEAD <sha>
 *   branch refs/heads/<name>   (or "detached" for detached HEAD)
 *   locked                     (optional)
 *   prunable                   (optional)
 */
export function parseWorktreeList(output: string): WorktreeOnDisk[] {
	if (!output.trim()) {
		return [];
	}

	// Split into blocks separated by blank lines
	const blocks = output.split(/\n\n+/).filter((block) => block.trim());

	return blocks.map((block) => {
		const lines = block.split("\n").filter((line) => line.trim());

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
				const rawBranch = line.slice("branch ".length);
				branch = rawBranch.startsWith("refs/heads/")
					? rawBranch.slice("refs/heads/".length)
					: rawBranch;
			} else if (line === "detached") {
				branch = null;
			} else if (line === "locked") {
				locked = true;
			} else if (line === "prunable") {
				prunable = true;
			}
		}

		return { path, head, branch, locked, prunable };
	});
}
