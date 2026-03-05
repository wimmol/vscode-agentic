import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockMemento, window, workspace } from "../__mocks__/vscode";
import { RepoConfigService } from "../../src/services/repo-config.service";
import { REPO_CONFIGS_KEY, DEFAULT_STAGING_BRANCH, DEFAULT_WORKTREE_LIMIT } from "../../src/models/repo";
import type { GitService } from "../../src/services/git.service";

function createMockGitService(): GitService {
	return {
		exec: vi.fn<(repoPath: string, args: string[]) => Promise<string>>().mockResolvedValue(""),
		branchExists: vi.fn<(repoPath: string, branchName: string) => Promise<boolean>>().mockResolvedValue(false),
	} as unknown as GitService;
}

describe("RepoConfigService", () => {
	let memento: ReturnType<typeof createMockMemento>;
	let git: GitService;
	let service: RepoConfigService;

	beforeEach(() => {
		vi.clearAllMocks();
		memento = createMockMemento();
		git = createMockGitService();
		service = new RepoConfigService(memento, git);
	});

	describe("getAll", () => {
		it("returns empty array by default", () => {
			expect(service.getAll()).toEqual([]);
		});

		it("returns stored configs", () => {
			const configs = [{ path: "/repo1", stagingBranch: "staging", worktreeLimit: 5 }];
			memento.update(REPO_CONFIGS_KEY, configs);
			expect(service.getAll()).toEqual(configs);
		});
	});

	describe("getForRepo", () => {
		it("returns undefined for unknown path", () => {
			expect(service.getForRepo("/unknown")).toBeUndefined();
		});

		it("returns config for known path", () => {
			const config = { path: "/repo1", stagingBranch: "staging", worktreeLimit: 5 };
			memento.update(REPO_CONFIGS_KEY, [config]);
			expect(service.getForRepo("/repo1")).toEqual(config);
		});
	});

	describe("addRepo", () => {
		it("happy path: workspace folder selected, staging branch entered, config saved", async () => {
			// Setup workspace folders
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			// User picks the workspace folder
			window.showQuickPick.mockResolvedValueOnce({ label: "my-repo", description: "/my-repo", _path: "/my-repo" });

			// Git validates it's a repo
			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(".git");

			// User enters staging branch name
			window.showInputBox.mockResolvedValueOnce("staging");

			// Branch does not exist
			(git.branchExists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

			const result = await service.addRepo();

			expect(result).toBeDefined();
			expect(result?.path).toBe("/my-repo");
			expect(result?.stagingBranch).toBe("staging");
			expect(result?.worktreeLimit).toBe(DEFAULT_WORKTREE_LIMIT);

			// Check config was persisted
			const configs = service.getAll();
			expect(configs).toHaveLength(1);
			expect(configs[0].path).toBe("/my-repo");
		});

		it("with existing branch: prompts user to confirm or pick different name", async () => {
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick
				// First: pick workspace folder
				.mockResolvedValueOnce({ label: "my-repo", description: "/my-repo", _path: "/my-repo" })
				// Third: user picks "Use existing branch"
				.mockResolvedValueOnce({ label: "Use existing branch 'staging'" });

			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(".git");
			window.showInputBox.mockResolvedValueOnce("staging");
			(git.branchExists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

			const result = await service.addRepo();

			expect(result).toBeDefined();
			expect(result?.stagingBranch).toBe("staging");
		});

		it("with existing branch: user picks different name", async () => {
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick
				// First: pick workspace folder
				.mockResolvedValueOnce({ label: "my-repo", description: "/my-repo", _path: "/my-repo" })
				// Third: user picks "Pick a different name"
				.mockResolvedValueOnce({ label: "Pick a different name" });

			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(".git");

			// First staging branch name
			window.showInputBox.mockResolvedValueOnce("staging");
			(git.branchExists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

			// Second staging branch name
			window.showInputBox.mockResolvedValueOnce("dev-staging");
			(git.branchExists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

			const result = await service.addRepo();

			expect(result).toBeDefined();
			expect(result?.stagingBranch).toBe("dev-staging");
		});

		it("cancellation: user cancels at folder selection, returns undefined", async () => {
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick.mockResolvedValueOnce(undefined);

			const result = await service.addRepo();

			expect(result).toBeUndefined();
			expect(service.getAll()).toEqual([]);
		});

		it("cancellation: user cancels at branch name input, returns undefined", async () => {
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick.mockResolvedValueOnce({ label: "my-repo", description: "/my-repo", _path: "/my-repo" });
			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(".git");
			window.showInputBox.mockResolvedValueOnce(undefined);

			const result = await service.addRepo();

			expect(result).toBeUndefined();
		});

		it("duplicate repo: shows info message and returns existing config", async () => {
			const existingConfig = { path: "/my-repo", stagingBranch: "staging", worktreeLimit: 5 };
			memento.update(REPO_CONFIGS_KEY, [existingConfig]);

			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick.mockResolvedValueOnce({ label: "my-repo", description: "/my-repo", _path: "/my-repo" });
			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(".git");

			const result = await service.addRepo();

			expect(result).toEqual(existingConfig);
			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("already configured"),
			);
		});
	});

	describe("removeRepo", () => {
		it("removes config from state", async () => {
			const configs = [
				{ path: "/repo1", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repo2", stagingBranch: "dev", worktreeLimit: 3 },
			];
			memento.update(REPO_CONFIGS_KEY, configs);

			await service.removeRepo("/repo1");

			const remaining = service.getAll();
			expect(remaining).toHaveLength(1);
			expect(remaining[0].path).toBe("/repo2");
		});
	});
});
