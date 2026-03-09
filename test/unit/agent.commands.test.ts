import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, window, workspace } from "../__mocks__/vscode";
import { registerAgentCommands } from "../../src/commands/agent.commands";

// Mock services
function createMockAgentService() {
	return {
		createAgent: vi.fn().mockResolvedValue({
			agentName: "my-agent",
			repoPath: "/repo",
			status: "created",
			createdAt: "2026-01-01T00:00:00.000Z",
		}),
		deleteAgent: vi.fn().mockResolvedValue(undefined),
		focusAgent: vi.fn().mockResolvedValue(undefined),
		getAgent: vi.fn().mockReturnValue(undefined),
		getAll: vi.fn().mockReturnValue([]),
		getForRepo: vi.fn().mockReturnValue([]),
		updateStatus: vi.fn().mockResolvedValue(undefined),
		reconcileOnActivation: vi.fn().mockResolvedValue(undefined),
		setTerminalService: vi.fn(),
	};
}

function createMockTerminalService() {
	return {
		createTerminal: vi.fn(),
		disposeTerminal: vi.fn(),
		showTerminal: vi.fn(),
		hasTerminal: vi.fn(),
		dispose: vi.fn(),
	};
}

function createMockWorktreeService() {
	return {
		addWorktree: vi.fn().mockResolvedValue({
			path: "/repo/.worktrees/my-agent",
			branch: "my-agent",
			agentName: "my-agent",
			repoPath: "/repo",
			createdAt: "2026-01-01T00:00:00.000Z",
		}),
		removeWorktree: vi.fn().mockResolvedValue(undefined),
		getManifest: vi.fn().mockReturnValue([
			{
				path: "/repo/.worktrees/my-agent",
				branch: "my-agent",
				agentName: "my-agent",
				repoPath: "/repo",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		]),
	};
}

function createMockRepoConfigService() {
	return {
		getAll: vi.fn().mockReturnValue([{ path: "/repo", stagingBranch: "main", worktreeLimit: 5 }]),
		getForRepo: vi.fn(),
	};
}

function createMockWorkspaceService() {
	return {
		ensureWorkspaceFile: vi.fn().mockResolvedValue(false),
		syncWorkspaceFile: vi.fn().mockResolvedValue(undefined),
		promptReopenInWorkspace: vi.fn().mockResolvedValue(undefined),
		setExplorerScope: vi.fn(),
		resetExplorerScope: vi.fn(),
		isInWorkspaceMode: vi.fn().mockReturnValue(false),
		getWorkspaceFilePath: vi.fn().mockReturnValue("/home/test/.agentic/agentic.code-workspace"),
	};
}

function createMockContext() {
	const subscriptions: { dispose: () => void }[] = [];
	return {
		subscriptions,
		workspaceState: {
			get: vi.fn(),
			update: vi.fn(),
			keys: vi.fn().mockReturnValue([]),
		},
	};
}

describe("registerAgentCommands", () => {
	let agentService: ReturnType<typeof createMockAgentService>;
	let terminalService: ReturnType<typeof createMockTerminalService>;
	let worktreeService: ReturnType<typeof createMockWorktreeService>;
	let repoConfigService: ReturnType<typeof createMockRepoConfigService>;
	let workspaceService: ReturnType<typeof createMockWorkspaceService>;
	let context: ReturnType<typeof createMockContext>;
	let commandHandlers: Map<string, (...args: unknown[]) => unknown>;

	beforeEach(() => {
		vi.clearAllMocks();
		agentService = createMockAgentService();
		terminalService = createMockTerminalService();
		worktreeService = createMockWorktreeService();
		repoConfigService = createMockRepoConfigService();
		workspaceService = createMockWorkspaceService();
		context = createMockContext();
		commandHandlers = new Map();

		// Capture registered command handlers
		commands.registerCommand.mockImplementation((id: string, handler: (...args: unknown[]) => unknown) => {
			commandHandlers.set(id, handler);
			return { dispose: vi.fn() };
		});

		registerAgentCommands(
			context as never,
			agentService as never,
			terminalService as never,
			repoConfigService as never,
			worktreeService as never,
			workspaceService as never,
		);
	});

	it("registers four commands", () => {
		expect(commands.registerCommand).toHaveBeenCalledTimes(4);
		expect(commandHandlers.has("vscode-agentic.createAgent")).toBe(true);
		expect(commandHandlers.has("vscode-agentic.deleteAgent")).toBe(true);
		expect(commandHandlers.has("vscode-agentic.focusAgent")).toBe(true);
		expect(commandHandlers.has("vscode-agentic.stopAgent")).toBe(true);
	});

	it("pushes all commands to context.subscriptions", () => {
		expect(context.subscriptions.length).toBe(4);
	});

	describe("createAgent command", () => {
		it("receives repoPath as argument", async () => {
			window.showInputBox
				.mockResolvedValueOnce("my-agent") // agent name
				.mockResolvedValueOnce(""); // initial prompt (empty = no prompt)

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler("/repo");

			expect(agentService.createAgent).toHaveBeenCalledWith("/repo", "my-agent", undefined);
		});

		it("falls back to first configured repo when repoPath not provided", async () => {
			window.showInputBox
				.mockResolvedValueOnce("my-agent")
				.mockResolvedValueOnce("");

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(agentService.createAgent).toHaveBeenCalledWith("/repo", "my-agent", undefined);
		});

		it("returns early when user cancels agent name input", async () => {
			window.showInputBox.mockResolvedValueOnce(undefined); // cancelled

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler("/repo");

			expect(agentService.createAgent).not.toHaveBeenCalled();
		});

		it("returns early when user cancels initial prompt input", async () => {
			window.showInputBox
				.mockResolvedValueOnce("my-agent")
				.mockResolvedValueOnce(undefined); // cancelled prompt

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler("/repo");

			expect(agentService.createAgent).not.toHaveBeenCalled();
		});

		it("passes initialPrompt when user provides one", async () => {
			window.showInputBox
				.mockResolvedValueOnce("my-agent")
				.mockResolvedValueOnce("Fix the auth bug");

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler("/repo");

			expect(agentService.createAgent).toHaveBeenCalledWith("/repo", "my-agent", "Fix the auth bug");
		});

		it("shows info message on successful creation", async () => {
			window.showInputBox
				.mockResolvedValueOnce("my-agent")
				.mockResolvedValueOnce("");

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler("/repo");

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("my-agent"),
			);
		});

		it("shows QuickPick when agent name already exists and focuses on reuse", async () => {
			agentService.getAgent.mockReturnValueOnce({
				agentName: "my-agent",
				repoPath: "/repo",
				status: "created",
				createdAt: "2026-01-01T00:00:00.000Z",
			});

			window.showInputBox.mockResolvedValueOnce("my-agent");
			window.showQuickPick.mockResolvedValueOnce({ label: "Reuse existing agent 'my-agent'" });

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler("/repo");

			expect(agentService.focusAgent).toHaveBeenCalledWith("/repo", "my-agent");
			expect(agentService.createAgent).not.toHaveBeenCalled();
		});

		it("shows new InputBox when user chooses to pick a different name on collision", async () => {
			// First name input collides
			agentService.getAgent
				.mockReturnValueOnce({ agentName: "my-agent", repoPath: "/repo", status: "created", createdAt: "" })
				.mockReturnValueOnce(undefined); // second name is unique

			window.showInputBox
				.mockResolvedValueOnce("my-agent") // first name (collides)
				.mockResolvedValueOnce("new-agent") // retry name
				.mockResolvedValueOnce(""); // prompt

			window.showQuickPick.mockResolvedValueOnce({ label: "Pick a different name" });

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler("/repo");

			expect(agentService.createAgent).toHaveBeenCalledWith("/repo", "new-agent", undefined);
		});

		it("has validateInput on name InputBox that rejects invalid branch names", async () => {
			let validateInput: ((value: string) => string | undefined) | undefined;

			window.showInputBox.mockImplementation(async (opts: { validateInput?: (v: string) => string | undefined }) => {
				if (opts.validateInput && !validateInput) {
					validateInput = opts.validateInput;
				}
				return undefined; // cancel
			});

			const handler = commandHandlers.get("vscode-agentic.createAgent")!;
			await handler("/repo");

			expect(validateInput).toBeDefined();
			// Invalid: contains spaces
			expect(validateInput!("my agent")).toBeTruthy();
			// Valid branch name
			expect(validateInput!("my-agent")).toBeUndefined();
		});
	});

	describe("deleteAgent command", () => {
		it("receives repoPath and agentName as arguments", async () => {
			window.showWarningMessage.mockResolvedValueOnce("Delete");

			const handler = commandHandlers.get("vscode-agentic.deleteAgent")!;
			await handler("/repo", "my-agent");

			expect(agentService.deleteAgent).toHaveBeenCalledWith("/repo", "my-agent");
		});

		it("shows modal confirmation dialog before deleting", async () => {
			window.showWarningMessage.mockResolvedValueOnce("Delete");

			const handler = commandHandlers.get("vscode-agentic.deleteAgent")!;
			await handler("/repo", "my-agent");

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("my-agent"),
				expect.objectContaining({ modal: true }),
				"Delete",
			);
		});

		it("shows extra 'still running' warning when deleting a running agent", async () => {
			agentService.getAgent.mockReturnValueOnce({
				agentName: "my-agent",
				repoPath: "/repo",
				status: "running",
				createdAt: "2026-01-01T00:00:00.000Z",
			});
			window.showWarningMessage.mockResolvedValueOnce("Delete");

			const handler = commandHandlers.get("vscode-agentic.deleteAgent")!;
			await handler("/repo", "my-agent");

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("still running"),
				expect.objectContaining({ modal: true }),
				"Delete",
			);
		});

		it("returns early when user cancels confirmation", async () => {
			window.showWarningMessage.mockResolvedValueOnce(undefined);

			const handler = commandHandlers.get("vscode-agentic.deleteAgent")!;
			await handler("/repo", "my-agent");

			expect(agentService.deleteAgent).not.toHaveBeenCalled();
		});

		it("shows info message after successful deletion", async () => {
			window.showWarningMessage.mockResolvedValueOnce("Delete");

			const handler = commandHandlers.get("vscode-agentic.deleteAgent")!;
			await handler("/repo", "my-agent");

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("my-agent"),
			);
		});
	});

	describe("focusAgent command", () => {
		it("receives repoPath and agentName as arguments and calls focusAgent directly", async () => {
			const handler = commandHandlers.get("vscode-agentic.focusAgent")!;
			await handler("/repo", "my-agent");

			expect(agentService.focusAgent).toHaveBeenCalledWith("/repo", "my-agent");
		});

		it("calls workspaceService.setExplorerScope with worktree path and agent name", async () => {
			const handler = commandHandlers.get("vscode-agentic.focusAgent")!;
			await handler("/repo", "my-agent");

			expect(workspaceService.setExplorerScope).toHaveBeenCalledWith(
				"/repo/.worktrees/my-agent",
				"my-agent",
			);
		});

		it("does not call workspace.updateWorkspaceFolders directly (uses WorkspaceService instead)", async () => {
			const handler = commandHandlers.get("vscode-agentic.focusAgent")!;
			await handler("/repo", "my-agent");

			expect(workspace.updateWorkspaceFolders).not.toHaveBeenCalled();
		});

		it("does not call setExplorerScope when worktree entry is not found", async () => {
			worktreeService.getManifest.mockReturnValue([]);

			const handler = commandHandlers.get("vscode-agentic.focusAgent")!;
			await handler("/repo", "my-agent");

			expect(workspaceService.setExplorerScope).not.toHaveBeenCalled();
		});
	});

	describe("stopAgent command", () => {
		it("calls terminalService.disposeTerminal and updates status to finished when agent is running", async () => {
			agentService.getAgent.mockReturnValue({
				agentName: "my-agent",
				repoPath: "/repo",
				status: "running",
				createdAt: "2026-01-01T00:00:00.000Z",
			});

			const handler = commandHandlers.get("vscode-agentic.stopAgent")!;
			await handler("/repo", "my-agent");

			expect(terminalService.disposeTerminal).toHaveBeenCalledWith("/repo", "my-agent");
			expect(agentService.updateStatus).toHaveBeenCalledWith("/repo", "my-agent", "finished");
		});

		it("is a no-op when agent status is not running", async () => {
			agentService.getAgent.mockReturnValue({
				agentName: "my-agent",
				repoPath: "/repo",
				status: "created",
				createdAt: "2026-01-01T00:00:00.000Z",
			});

			const handler = commandHandlers.get("vscode-agentic.stopAgent")!;
			await handler("/repo", "my-agent");

			expect(terminalService.disposeTerminal).not.toHaveBeenCalled();
			expect(agentService.updateStatus).not.toHaveBeenCalled();
		});

		it("is a no-op when agent does not exist", async () => {
			agentService.getAgent.mockReturnValue(undefined);

			const handler = commandHandlers.get("vscode-agentic.stopAgent")!;
			await handler("/repo", "my-agent");

			expect(terminalService.disposeTerminal).not.toHaveBeenCalled();
			expect(agentService.updateStatus).not.toHaveBeenCalled();
		});
	});
});
