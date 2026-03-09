import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, window } from "../__mocks__/vscode";
import { registerDeleteAgent } from "../../src/features/delete-agent";
import { WORKTREE_MANIFEST_KEY } from "../../src/models/worktree";

// Mock terminal utils
vi.mock("../../src/utils/terminal", () => ({
	disposeTerminal: vi.fn(),
}));

import { disposeTerminal } from "../../src/utils/terminal";

function createMockContext() {
	const store = new Map<string, unknown>();
	return {
		subscriptions: [] as { dispose(): void }[],
		globalState: {
			get: vi.fn((key: string, defaultValue?: unknown) => store.has(key) ? store.get(key) : defaultValue),
			update: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
			_store: store,
		},
	};
}

function createMockAgentsStore() {
	let entries = [
		{ agentName: "test-agent", repoPath: "/repo", status: "created", createdAt: "2026-01-01" },
	];
	return {
		getAll: vi.fn(() => [...entries]),
		getForRepo: vi.fn(),
		save: vi.fn(async (newEntries: typeof entries) => { entries = newEntries; }),
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

describe("registerDeleteAgent", () => {
	let context: ReturnType<typeof createMockContext>;
	let agentsStore: ReturnType<typeof createMockAgentsStore>;
	let gitService: ReturnType<typeof createMockGitService>;
	let commandHandler: (repoPath: string, agentName: string) => Promise<void>;

	beforeEach(() => {
		vi.clearAllMocks();
		context = createMockContext();
		agentsStore = createMockAgentsStore();
		gitService = createMockGitService();

		// Pre-populate worktree manifest
		context.globalState._store.set(WORKTREE_MANIFEST_KEY, [
			{ path: "/repo/.worktrees/test-agent", branch: "test-agent", agentName: "test-agent", repoPath: "/repo", createdAt: "2026-01-01" },
		]);

		(commands.registerCommand as ReturnType<typeof vi.fn>).mockImplementation(
			(_id: string, handler: (repoPath: string, agentName: string) => Promise<void>) => {
				commandHandler = handler;
				return { dispose: vi.fn() };
			},
		);

		registerDeleteAgent(context as never, agentsStore as never, gitService as never);
	});

	it("registers the deleteAgent command", () => {
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"vscode-agentic.deleteAgent",
			expect.any(Function),
		);
	});

	it("pushes disposable to context.subscriptions", () => {
		expect(context.subscriptions.length).toBe(1);
	});

	it("shows confirmation dialog before deletion", async () => {
		(window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce("Delete");

		await commandHandler("/repo", "test-agent");

		expect(window.showWarningMessage).toHaveBeenCalledWith(
			expect.stringContaining("test-agent"),
			{ modal: true },
			"Delete",
		);
	});

	it("removes agent from store and calls git worktree remove on confirmation", async () => {
		(window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce("Delete");

		await commandHandler("/repo", "test-agent");

		// Git worktree remove was called
		expect(gitService.exec).toHaveBeenCalledWith(
			"/repo",
			expect.arrayContaining(["worktree", "remove", "--force"]),
		);

		// Agent was removed from store
		expect(agentsStore.save).toHaveBeenCalledWith([]);

		// Terminal was disposed
		expect(disposeTerminal).toHaveBeenCalledWith("/repo", "test-agent");

		// Success message shown
		expect(window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("deleted"),
		);
	});

	it("does nothing when user cancels confirmation", async () => {
		(window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

		await commandHandler("/repo", "test-agent");

		expect(gitService.exec).not.toHaveBeenCalled();
		expect(agentsStore.save).not.toHaveBeenCalled();
	});

	it("does nothing when agent not found", async () => {
		agentsStore.getAll.mockReturnValue([]);

		await commandHandler("/repo", "nonexistent");

		expect(window.showWarningMessage).not.toHaveBeenCalled();
		expect(agentsStore.save).not.toHaveBeenCalled();
	});

	it("warns about running agents in confirmation message", async () => {
		agentsStore.getAll.mockReturnValue([
			{ agentName: "running-agent", repoPath: "/repo", status: "running", createdAt: "2026-01-01" },
		]);
		(window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

		await commandHandler("/repo", "running-agent");

		expect(window.showWarningMessage).toHaveBeenCalledWith(
			expect.stringContaining("still running"),
			{ modal: true },
			"Delete",
		);
	});
});
