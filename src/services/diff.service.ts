import type { GitService } from "./git.service.js";
import type { RepoConfigService } from "./repo-config.service.js";

export class DiffService {
	constructor(
		private readonly git: GitService,
		private readonly repoConfig: RepoConfigService,
	) {}

	/**
	 * Returns true if the agent branch has commits not in the staging branch.
	 * Uses three-dot notation to diff since merge-base.
	 * Returns false gracefully on any error (missing config, missing branch, git failure).
	 */
	async hasUnmergedChanges(repoPath: string, agentBranch: string): Promise<boolean> {
		const config = this.repoConfig.getForRepo(repoPath);
		if (!config) {
			return false;
		}

		const staging = config.stagingBranch;

		const stagingExists = await this.git.branchExists(repoPath, staging);
		if (!stagingExists) {
			return false;
		}

		try {
			const output = await this.git.exec(repoPath, [
				"diff",
				"--name-only",
				`${staging}...${agentBranch}`,
			]);
			return output.trim().length > 0;
		} catch {
			return false;
		}
	}

	/**
	 * Returns list of changed file paths between staging and agent branch.
	 * Uses three-dot notation to diff since merge-base.
	 * Returns empty array on any error.
	 */
	async getChangedFiles(repoPath: string, agentBranch: string): Promise<string[]> {
		const config = this.repoConfig.getForRepo(repoPath);
		if (!config) {
			return [];
		}

		const staging = config.stagingBranch;

		try {
			const output = await this.git.exec(repoPath, [
				"diff",
				"--name-only",
				`${staging}...${agentBranch}`,
			]);
			return output.trim().split("\n").filter(Boolean);
		} catch {
			return [];
		}
	}
}
