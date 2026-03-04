export interface RepoConfig {
	path: string; // absolute path to the repository root
	stagingBranch: string; // name of the staging branch (default: "staging")
}

export const REPO_CONFIGS_KEY = "vscode-agentic.repoConfigs";
export const DEFAULT_STAGING_BRANCH = "staging";
