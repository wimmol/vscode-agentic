import * as vscode from "vscode";

/**
 * Ensures that the worktree directory is listed in the repo's `.gitignore`.
 * Creates `.gitignore` if it does not exist.
 * Does not duplicate the entry if already present.
 *
 * Uses vscode.workspace.fs instead of node:fs per CLAUDE.md.
 */
export const ensureGitignoreEntry = async (repoPath: string): Promise<void> => {
	console.log("[gitignore.ensureGitignoreEntry]", { repoPath });

	const worktreeDirName = vscode.workspace
		.getConfiguration("vscode-agentic")
		.get<string>("worktreeDirectoryName", ".worktrees");

	const gitignoreUri = vscode.Uri.joinPath(vscode.Uri.file(repoPath), ".gitignore");

	let content: string;
	try {
		const rawBytes = await vscode.workspace.fs.readFile(gitignoreUri);
		content = new TextDecoder().decode(rawBytes);
	} catch {
		// File doesn't exist -- we'll create it
		content = "";
	}

	// Check if worktree dir is already listed (with or without trailing /)
	const lines = content.split("\n");
	const alreadyPresent = lines.some((line) => {
		const trimmed = line.trim();
		return trimmed === `${worktreeDirName}/` || trimmed === worktreeDirName;
	});

	if (alreadyPresent) {
		return;
	}

	// Build the entry to append
	const entry = `# VS Code Agentic worktrees\n${worktreeDirName}/\n`;

	let newContent: string;
	if (content.length === 0) {
		newContent = entry;
	} else {
		const separator = content.endsWith("\n") ? "\n" : "\n\n";
		newContent = content + separator + entry;
	}

	await vscode.workspace.fs.writeFile(gitignoreUri, new TextEncoder().encode(newContent));
};
