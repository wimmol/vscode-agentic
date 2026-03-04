import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiffService } from "../../src/services/diff.service.js";
import type { GitService } from "../../src/services/git.service.js";
import type { RepoConfigService } from "../../src/services/repo-config.service.js";
import type { RepoConfig } from "../../src/models/repo.js";

function createMockGitService(): {
	exec: ReturnType<typeof vi.fn>;
	branchExists: ReturnType<typeof vi.fn>;
} {
	return {
		exec: vi.fn(),
		branchExists: vi.fn(),
	};
}

function createMockRepoConfigService(): {
	getForRepo: ReturnType<typeof vi.fn>;
	getAll: ReturnType<typeof vi.fn>;
} {
	return {
		getForRepo: vi.fn(),
		getAll: vi.fn(),
	};
}

const REPO_PATH = "/repo";
const AGENT_BRANCH = "agent/test-agent";
const STAGING_BRANCH = "staging";

const mockConfig: RepoConfig = {
	path: REPO_PATH,
	stagingBranch: STAGING_BRANCH,
};

describe("DiffService", () => {
	let diffService: DiffService;
	let git: ReturnType<typeof createMockGitService>;
	let repoConfig: ReturnType<typeof createMockRepoConfigService>;

	beforeEach(() => {
		vi.clearAllMocks();
		git = createMockGitService();
		repoConfig = createMockRepoConfigService();
		diffService = new DiffService(
			git as unknown as GitService,
			repoConfig as unknown as RepoConfigService,
		);
	});

	describe("hasUnmergedChanges", () => {
		it("returns false when repoConfig.getForRepo returns undefined (no config)", async () => {
			repoConfig.getForRepo.mockReturnValue(undefined);

			const result = await diffService.hasUnmergedChanges(REPO_PATH, AGENT_BRANCH);

			expect(result).toBe(false);
			expect(git.exec).not.toHaveBeenCalled();
		});

		it("returns false when staging branch does not exist", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.branchExists.mockResolvedValue(false);

			const result = await diffService.hasUnmergedChanges(REPO_PATH, AGENT_BRANCH);

			expect(result).toBe(false);
			expect(git.branchExists).toHaveBeenCalledWith(REPO_PATH, STAGING_BRANCH);
			expect(git.exec).not.toHaveBeenCalled();
		});

		it("returns false when git diff --name-only returns empty output", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.branchExists.mockResolvedValue(true);
			git.exec.mockResolvedValue("");

			const result = await diffService.hasUnmergedChanges(REPO_PATH, AGENT_BRANCH);

			expect(result).toBe(false);
		});

		it("returns true when git diff --name-only returns file names", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.branchExists.mockResolvedValue(true);
			git.exec.mockResolvedValue("src/file1.ts\nsrc/file2.ts");

			const result = await diffService.hasUnmergedChanges(REPO_PATH, AGENT_BRANCH);

			expect(result).toBe(true);
		});

		it("returns false when git diff throws an error (graceful degradation)", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.branchExists.mockResolvedValue(true);
			git.exec.mockRejectedValue(new Error("git diff failed"));

			const result = await diffService.hasUnmergedChanges(REPO_PATH, AGENT_BRANCH);

			expect(result).toBe(false);
		});

		it("uses three-dot notation: staging...agentBranch", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.branchExists.mockResolvedValue(true);
			git.exec.mockResolvedValue("");

			await diffService.hasUnmergedChanges(REPO_PATH, AGENT_BRANCH);

			expect(git.exec).toHaveBeenCalledWith(REPO_PATH, [
				"diff",
				"--name-only",
				`${STAGING_BRANCH}...${AGENT_BRANCH}`,
			]);
		});
	});

	describe("getChangedFiles", () => {
		it("returns empty array when repoConfig returns undefined", async () => {
			repoConfig.getForRepo.mockReturnValue(undefined);

			const result = await diffService.getChangedFiles(REPO_PATH, AGENT_BRANCH);

			expect(result).toEqual([]);
			expect(git.exec).not.toHaveBeenCalled();
		});

		it("returns empty array when git diff throws", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.exec.mockRejectedValue(new Error("git diff failed"));

			const result = await diffService.getChangedFiles(REPO_PATH, AGENT_BRANCH);

			expect(result).toEqual([]);
		});

		it("returns array of file paths parsed from newline-separated git output", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.exec.mockResolvedValue("src/file1.ts\nsrc/file2.ts\nREADME.md");

			const result = await diffService.getChangedFiles(REPO_PATH, AGENT_BRANCH);

			expect(result).toEqual(["src/file1.ts", "src/file2.ts", "README.md"]);
		});

		it("filters out empty strings from split output", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.exec.mockResolvedValue("src/file1.ts\n\nsrc/file2.ts\n");

			const result = await diffService.getChangedFiles(REPO_PATH, AGENT_BRANCH);

			expect(result).toEqual(["src/file1.ts", "src/file2.ts"]);
		});

		it("uses three-dot notation: staging...agentBranch", async () => {
			repoConfig.getForRepo.mockReturnValue(mockConfig);
			git.exec.mockResolvedValue("file.ts");

			await diffService.getChangedFiles(REPO_PATH, AGENT_BRANCH);

			expect(git.exec).toHaveBeenCalledWith(REPO_PATH, [
				"diff",
				"--name-only",
				`${STAGING_BRANCH}...${AGENT_BRANCH}`,
			]);
		});
	});
});
