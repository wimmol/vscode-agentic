import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, window, workspace } from "../__mocks__/vscode";
import { registerCreateAgent } from "../../src/features/create-agent";
import { AGENT_REGISTRY_KEY } from "../../src/models/agent";
import { WORKTREE_MANIFEST_KEY } from "../../src/models/worktree";

function createMockContext() {
	const store = new Map<string, unknown>();
	return {
		subscriptions: [] as { dispose(): void }[],
		globalState: {
			get: vi.fn((key: string, defaultValue?: unknown) => store.has(key) ? store.get(key) : defaultValue),
			update: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
			_store: store,
		},
		extensionUri: { fsPath: "/ext" },
	};
}

function createMockAgentsStore() {
	let entries: Array<{ agentName: string; repoPath: string; status: string; createdAt: string }> = [];
	return {
		getAll: vi.fn(() => [...entries]),
		getForRepo: vi.fn((repoPath: string) => entries.filter((e) => e.repoPath === repoPath)),
		save: vi.fn(async (newEntries: typeof entries) => { entries = newEntries; }),
		onDidChange: vi.fn(),
		dispose: vi.fn(),
	};
}

function createMockReposStore() {
	return {
		getAll: vi.fn(() => [{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 }]),
		getForRepo: vi.fn((_path: string) => ({ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 })),
		save: vi.fn(),
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

describe("registerCreateAgent", () => {
	let context: ReturnType<typeof createMockContext>;
	let agentsStore: ReturnType<typeof createMockAgentsStore>;
	let reposStore: ReturnType<typeof createMockReposStore>;
	let gitService: ReturnType<typeof createMockGitService>;
	let commandHandler: (...args: unknown[]) => Promise<void>;

	beforeEach(() => {
		vi.clearAllMocks();
		context = createMockContext();
		agentsStore = createMockAgentsStore();
		reposStore = createMockReposStore();
		gitService = createMockGitService();

		// Mock getConfiguration to return defaults
		(workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
			get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
		});

		// Capture the command handler
		(commands.registerCommand as ReturnType<typeof vi.fn>).mockImplementation(
			(_id: string, handler: (...args: unknown[]) => Promise<void>) => {
				commandHandler = handler;
				return { dispose: vi.fn() };
			},
		);

		registerCreateAgent(context as never, agentsStore as never, reposStore as never, gitService as never);
	});

	it("registers the createAgent command", () => {
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"vscode-agentic.createAgent",
			expect.any(Function),
		);
	});

	it("pushes disposable to context.subscriptions", () => {
		expect(context.subscriptions.length).toBe(1);
	});

	it("falls back to first configured repo when repoPath not provided", async () => {
		// User provides a name then cancels initial prompt
		(window.showInputBox as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce("my-agent")
			.mockResolvedValueOnce(""); // empty initial prompt

		await commandHandler();

		// gitService.exec should have been called with the repo path from reposStore
		expect(gitService.exec).toHaveBeenCalledWith(
			"/repo",
			expect.arrayContaining(["worktree", "add"]),
		);
	});

	it("shows error when no repos configured and repoPath not provided", async () => {
		reposStore.getAll.mockReturnValue([]);

		await commandHandler();

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("No repositories configured"),
		);
	});

	it("rejects duplicate agent names", async () => {
		// Pre-populate an existing agent
		agentsStore.getAll.mockReturnValue([
			{ agentName: "existing-agent", repoPath: "/repo", status: "created", createdAt: "2026-01-01" },
		]);

		(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce("existing-agent");

		// User picks "Pick a different name" then cancels
		(window.showQuickPick as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ label: "Pick a different name" });
		(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined); // user cancels

		await commandHandler("/repo");

		// showQuickPick was called for collision
		expect(window.showQuickPick).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ label: expect.stringContaining("Reuse") }),
				expect.objectContaining({ label: "Pick a different name" }),
			]),
			expect.any(Object),
		);
	});

	it("reads worktree limit from settings", async () => {
		(window.showInputBox as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce("test-agent")
			.mockResolvedValueOnce(""); // empty initial prompt

		await commandHandler("/repo");

		expect(workspace.getConfiguration).toHaveBeenCalledWith("vscode-agentic");
	});

	it("calls gitService.exec to create worktree on valid input", async () => {
		(window.showInputBox as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce("test-agent")
			.mockResolvedValueOnce("Fix the bug");

		await commandHandler("/repo");

		expect(gitService.exec).toHaveBeenCalledWith(
			"/repo",
			expect.arrayContaining(["worktree", "add", "-b", "test-agent"]),
		);
	});

	it("saves new entry to agentsStore", async () => {
		(window.showInputBox as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce("new-agent")
			.mockResolvedValueOnce("");

		await commandHandler("/repo");

		expect(agentsStore.save).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					agentName: "new-agent",
					repoPath: "/repo",
					status: "created",
				}),
			]),
		);
	});

	it("saves worktree entry to globalState manifest", async () => {
		(window.showInputBox as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce("new-agent")
			.mockResolvedValueOnce("");

		await commandHandler("/repo");

		expect(context.globalState.update).toHaveBeenCalledWith(
			WORKTREE_MANIFEST_KEY,
			expect.arrayContaining([
				expect.objectContaining({
					agentName: "new-agent",
					repoPath: "/repo",
				}),
			]),
		);
	});

	it("shows success message after agent creation", async () => {
		(window.showInputBox as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce("new-agent")
			.mockResolvedValueOnce("");

		await commandHandler("/repo");

		expect(window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("new-agent"),
		);
	});
});
