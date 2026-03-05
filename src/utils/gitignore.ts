import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Ensures that `.worktrees/` is listed in the repo's `.gitignore`.
 * Creates `.gitignore` if it does not exist.
 * Does not duplicate the entry if already present.
 */
export async function ensureGitignoreEntry(repoPath: string): Promise<void> {
	const gitignorePath = path.join(repoPath, ".gitignore");

	let content: string;
	try {
		content = await fs.readFile(gitignorePath, "utf-8");
	} catch {
		// File doesn't exist -- we'll create it
		content = "";
	}

	// Check if .worktrees/ or .worktrees is already listed
	const lines = content.split("\n");
	const alreadyPresent = lines.some((line) => {
		const trimmed = line.trim();
		return trimmed === ".worktrees/" || trimmed === ".worktrees";
	});

	if (alreadyPresent) {
		return;
	}

	// Build the entry to append
	const entry = "# VS Code Agentic worktrees\n.worktrees/\n";

	if (content.length === 0) {
		// New file
		await fs.writeFile(gitignorePath, entry);
	} else {
		// Append to existing file, ensuring proper newline separation
		const separator = content.endsWith("\n") ? "\n" : "\n\n";
		await fs.writeFile(gitignorePath, content + separator + entry);
	}
}
