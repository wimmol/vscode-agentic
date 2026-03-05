export interface RepoConfig {
	path: string; // absolute path to the repository root
	stagingBranch: string; // name of the staging branch (default: "staging")
	worktreeLimit: number; // max worktrees for this repo (default: 5)
}

export const REPO_CONFIGS_KEY = "vscode-agentic.repoConfigs";
export const DEFAULT_STAGING_BRANCH = "staging";
export const DEFAULT_WORKTREE_LIMIT = 5;
