import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento, window, workspace, Uri } from "vscode";
import { RepoConfigService } from "../../src/services/repo-config.service.js";
import {
	REPO_CONFIGS_KEY,
	DEFAULT_STAGING_BRANCH,
	DEFAULT_WORKTREE_LIMIT,
} from "../../src/models/repo.js";

// Mock ensureGitignoreEntry
vi.mock("../../src/utils/gitignore.js", () => ({
	ensureGitignoreEntry: vi.fn(),
}));

// Create a mock GitService
function createMockGitService() {
	return {
		exec: vi.fn(),
		branchExists: vi.fn(),
	};
}

describe("RepoConfigService", () => {
	let memento: ReturnType<typeof createMockMemento>;
	let gitService: ReturnType<typeof createMockGitService>;
	let service: RepoConfigService;

	beforeEach(() => {
		memento = createMockMemento();
		gitService = createMockGitService();
		service = new RepoConfigService(memento, gitService as any);
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getAll", () => {
		it("returns empty array by default", () => {
			const result = service.getAll();
			expect(result).toEqual([]);
		});

		it("returns stored configs", async () => {
			const configs = [
				{ path: "/repo1", stagingBranch: "staging", worktreeLimit: 5 },
			];
			await memento.update(REPO_CONFIGS_KEY, configs);

			const result = service.getAll();
			expect(result).toEqual(configs);
		});
	});

	describe("getForRepo", () => {
		it("returns undefined for unknown path", () => {
			const result = service.getForRepo("/unknown");
			expect(result).toBeUndefined();
		});

		it("returns config for known repo", async () => {
			const config = { path: "/repo1", stagingBranch: "staging", worktreeLimit: 5 };
			await memento.update(REPO_CONFIGS_KEY, [config]);

			const result = service.getForRepo("/repo1");
			expect(result).toEqual(config);
		});
	});

	describe("addRepo", () => {
		it("happy path: workspace folder selected, staging branch entered, branch does not exist", async () => {
			// Setup workspace folders
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			// User selects the workspace folder
			window.showQuickPick.mockResolvedValueOnce({
				label: "my-repo",
				description: "/my-repo",
				_path: "/my-repo",
			});

			// Git validates it's a repo
			gitService.exec.mockResolvedValueOnce(".git");

			// User enters staging branch name
			window.showInputBox.mockResolvedValueOnce("staging");

			// Branch does not exist
			gitService.branchExists.mockResolvedValueOnce(false);

			const result = await service.addRepo();

			expect(result).toBeDefined();
			expect(result!.path).toBe("/my-repo");
			expect(result!.stagingBranch).toBe("staging");
			expect(result!.worktreeLimit).toBe(DEFAULT_WORKTREE_LIMIT);

			// Should persist to memento
			const stored = memento.get(REPO_CONFIGS_KEY, []);
			expect(stored).toHaveLength(1);

			// Should show info message
			expect(window.showInformationMessage).toHaveBeenCalled();
		});

		it("prompts user to confirm or pick different name when branch exists", async () => {
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick
				// First: pick workspace folder
				.mockResolvedValueOnce({
					label: "my-repo",
					description: "/my-repo",
					_path: "/my-repo",
				})
				// Third: user picks "Use existing branch"
				.mockResolvedValueOnce({ label: "Use existing branch 'staging'" });

			gitService.exec.mockResolvedValueOnce(".git");
			window.showInputBox.mockResolvedValueOnce("staging");
			gitService.branchExists.mockResolvedValueOnce(true);

			const result = await service.addRepo();

			expect(result).toBeDefined();
			expect(result!.stagingBranch).toBe("staging");
		});

		it("loops back when user picks 'different name' and branch exists", async () => {
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick
				// First: pick workspace folder
				.mockResolvedValueOnce({
					label: "my-repo",
					description: "/my-repo",
					_path: "/my-repo",
				})
				// Second: user picks "Pick a different name"
				.mockResolvedValueOnce({ label: "Pick a different name" });

			gitService.exec.mockResolvedValueOnce(".git");

			// First input: "staging" (exists), second input: "develop" (does not exist)
			window.showInputBox
				.mockResolvedValueOnce("staging")
				.mockResolvedValueOnce("develop");
			gitService.branchExists
				.mockResolvedValueOnce(true)
				.mockResolvedValueOnce(false);

			const result = await service.addRepo();

			expect(result).toBeDefined();
			expect(result!.stagingBranch).toBe("develop");
		});

		it("returns undefined when user cancels folder selection", async () => {
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];
			window.showQuickPick.mockResolvedValueOnce(undefined);

			const result = await service.addRepo();
			expect(result).toBeUndefined();
		});

		it("returns undefined when user cancels staging branch input", async () => {
			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick.mockResolvedValueOnce({
				label: "my-repo",
				description: "/my-repo",
				_path: "/my-repo",
			});
			gitService.exec.mockResolvedValueOnce(".git");
			window.showInputBox.mockResolvedValueOnce(undefined);

			const result = await service.addRepo();
			expect(result).toBeUndefined();
		});

		it("shows info message and returns existing config for duplicate repo", async () => {
			// Pre-populate with existing config
			const existing = { path: "/my-repo", stagingBranch: "staging", worktreeLimit: 5 };
			await memento.update(REPO_CONFIGS_KEY, [existing]);

			workspace.workspaceFolders = [
				{ uri: { fsPath: "/my-repo" }, name: "my-repo", index: 0 },
			];

			window.showQuickPick.mockResolvedValueOnce({
				label: "my-repo",
				description: "/my-repo",
				_path: "/my-repo",
			});
			gitService.exec.mockResolvedValueOnce(".git");

			const result = await service.addRepo();

			expect(result).toEqual(existing);
			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("already configured"),
			);
		});
	});

	describe("removeRepo", () => {
		it("removes config from state", async () => {
			const configs = [
				{ path: "/repo1", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repo2", stagingBranch: "develop", worktreeLimit: 3 },
			];
			await memento.update(REPO_CONFIGS_KEY, configs);

			await service.removeRepo("/repo1");

			const stored = memento.get(REPO_CONFIGS_KEY, []) as any[];
			expect(stored).toHaveLength(1);
			expect(stored[0].path).toBe("/repo2");
		});
	});
});
