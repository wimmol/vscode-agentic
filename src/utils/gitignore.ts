import * as fs from "node:fs/promises";
import * as path from "node:path";

const WORKTREE_ENTRY = ".worktrees/";
const COMMENT_LINE = "# VS Code Agentic worktrees";

/**
 * Ensures ".worktrees/" is present in the repo's .gitignore.
 * Creates the file if it does not exist; appends if entry is missing.
 * Recognizes both ".worktrees/" and ".worktrees" as already present.
 */
export async function ensureGitignoreEntry(repoPath: string): Promise<void> {
	const gitignorePath = path.join(repoPath, ".gitignore");

	let content: string;
	try {
		content = await fs.readFile(gitignorePath, "utf-8");
	} catch {
		// File does not exist -- create with entry
		content = "";
	}

	// Check if .worktrees/ or .worktrees is already present
	const lines = content.split("\n");
	const alreadyPresent = lines.some((line) => {
		const trimmed = line.trim();
		return trimmed === ".worktrees/" || trimmed === ".worktrees";
	});

	if (alreadyPresent) {
		return;
	}

	// Build the entry to append
	let appendText = "";

	// Ensure we start on a new line if file doesn't end with one
	if (content.length > 0 && !content.endsWith("\n")) {
		appendText += "\n";
	}

	appendText += `${COMMENT_LINE}\n${WORKTREE_ENTRY}\n`;

	await fs.writeFile(gitignorePath, content + appendText, "utf-8");
}
