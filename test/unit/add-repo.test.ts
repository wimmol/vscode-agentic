import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, window, workspace } from "../__mocks__/vscode";
import { registerAddRepo } from "../../src/features/add-repo";

// Mock gitignore util
vi.mock("../../src/utils/gitignore", () => ({
	ensureGitignoreEntry: vi.fn().mockResolvedValue(undefined),
}));

import { ensureGitignoreEntry } from "../../src/utils/gitignore";

function createMockContext() {
	return {
		subscriptions: [] as { dispose(): void }[],
		globalState: {
			get: vi.fn(),
			update: vi.fn(),
		},
	};
}

function createMockReposStore() {
	let configs: Array<{ path: string; stagingBranch: string; worktreeLimit: number }> = [];
	return {
		getAll: vi.fn(() => [...configs]),
		getForRepo: vi.fn((_path: string) => undefined as typeof configs[0] | undefined),
		save: vi.fn(async (newConfigs: typeof configs) => { configs = newConfigs; }),
		onDidChange: vi.fn(),
		dispose: vi.fn(),
	};
}

function createMockGitService() {
	return {
		exec: vi.fn().mockResolvedValue(""),
		branchExists: vi.fn().mockResolvedValue(false),
	};
}

function createMockWorkspaceService() {
	return {
		syncWorkspaceFile: vi.fn().mockResolvedValue(undefined),
		ensureWorkspaceFile: vi.fn(),
		setExplorerScope: vi.fn(),
		resetExplorerScope: vi.fn(),
	};
}

describe("registerAddRepo", () => {
	let context: ReturnType<typeof createMockContext>;
	let reposStore: ReturnType<typeof createMockReposStore>;
	let gitService: ReturnType<typeof createMockGitService>;
	let workspaceService: ReturnType<typeof createMockWorkspaceService>;
	let commandHandler: () => Promise<void>;

	beforeEach(() => {
		vi.clearAllMocks();
		context = createMockContext();
		reposStore = createMockReposStore();
		gitService = createMockGitService();
		workspaceService = createMockWorkspaceService();

		// Mock getConfiguration to return defaults
		(workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
			get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
		});

		// Provide workspace folders for the picker
		(workspace as any).workspaceFolders = [
			{ name: "my-repo", uri: { fsPath: "/repos/my-repo" } },
		];

		(commands.registerCommand as ReturnType<typeof vi.fn>).mockImplementation(
			(_id: string, handler: () => Promise<void>) => {
				commandHandler = handler;
				return { dispose: vi.fn() };
			},
		);

		registerAddRepo(
			context as never,
			reposStore as never,
			gitService as never,
			workspaceService as never,
		);
	});

	it("registers the addRepo command", () => {
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"vscode-agentic.addRepo",
			expect.any(Function),
		);
	});

	it("pushes disposable to context.subscriptions", () => {
		expect(context.subscriptions.length).toBe(1);
	});

	it("rejects already-configured repos", async () => {
		// User picks the workspace folder
		(window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			label: "my-repo",
			_path: "/repos/my-repo",
		});

		// Already configured
		reposStore.getForRepo.mockReturnValue({
			path: "/repos/my-repo",
			stagingBranch: "staging",
			worktreeLimit: 5,
		});

		await commandHandler();

		expect(window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("already configured"),
		);
		expect(reposStore.save).not.toHaveBeenCalled();
	});

	it("reads default staging branch from settings", async () => {
		// Pick repo
		(window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			label: "my-repo",
			_path: "/repos/my-repo",
		});
		// Git validation succeeds (default mock)
		// Staging branch input
		(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce("main");

		await commandHandler();

		// Should have called getConfiguration for settings
		expect(workspace.getConfiguration).toHaveBeenCalledWith("vscode-agentic");
	});

	it("saves new config to reposStore on valid input", async () => {
		// Pick repo
		(window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			label: "my-repo",
			_path: "/repos/my-repo",
		});
		// Staging branch input
		(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce("staging");

		await commandHandler();

		expect(reposStore.save).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					path: "/repos/my-repo",
					stagingBranch: "staging",
				}),
			]),
		);
	});

	it("ensures gitignore entry after saving config", async () => {
		// Pick repo
		(window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			label: "my-repo",
			_path: "/repos/my-repo",
		});
		// Staging branch input
		(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce("staging");

		await commandHandler();

		expect(ensureGitignoreEntry).toHaveBeenCalledWith("/repos/my-repo");
	});

	it("syncs workspace file after saving config", async () => {
		// Pick repo
		(window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			label: "my-repo",
			_path: "/repos/my-repo",
		});
		// Staging branch input
		(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce("staging");

		await commandHandler();

		expect(workspaceService.syncWorkspaceFile).toHaveBeenCalled();
	});

	it("handles browse option for folder selection", async () => {
		(window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			label: "Browse...",
			_path: "",
		});
		(window.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
			{ fsPath: "/other/repo" },
		]);
		(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce("staging");

		await commandHandler();

		expect(reposStore.save).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ path: "/other/repo" }),
			]),
		);
	});

	it("shows error when selected folder is not a git repo", async () => {
		(window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			label: "my-repo",
			_path: "/repos/my-repo",
		});
		gitService.exec.mockRejectedValueOnce(new Error("not a git repo"));

		await commandHandler();

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("not a git repository"),
		);
		expect(reposStore.save).not.toHaveBeenCalled();
	});

	it("returns when user cancels picker", async () => {
		(window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

		await commandHandler();

		expect(reposStore.save).not.toHaveBeenCalled();
	});
});
