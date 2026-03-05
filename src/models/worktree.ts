export interface WorktreeEntry {
	path: string; // absolute path to worktree directory
	branch: string; // branch name (without refs/heads/)
	agentName: string; // display name for the agent
	repoPath: string; // parent repo path
	createdAt: string; // ISO timestamp
}

export interface WorktreeOnDisk {
	path: string;
	head: string;
	branch: string | null; // null if detached HEAD
	locked: boolean;
	prunable: boolean;
}

export const WORKTREE_MANIFEST_KEY = "vscode-agentic.worktreeManifest";
export const WORKTREE_DIR_NAME = ".worktrees";
