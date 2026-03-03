import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, window } from "../__mocks__/vscode.js";
import { registerAgentCommands } from "../../src/commands/agent.commands.js";

// Mock services
function createMockAgentService() {
	return {
		createAgent: vi.fn().mockResolvedValue({
			agentName: "test-agent",
			repoPath: "/repo",
			status: "created",
			createdAt: new Date().toISOString(),
		}),
		deleteAgent: vi.fn().mockResolvedValue(undefined),
		focusAgent: vi.fn().mockResolvedValue(undefined),
		getAgent: vi.fn().mockReturnValue(undefined),
		getAll: vi.fn().mockReturnValue([]),
		getForRepo: vi.fn().mockReturnValue([]),
		updateStatus: vi.fn().mockResolvedValue(undefined),
		setTerminalService: vi.fn(),
		reconcileOnActivation: vi.fn().mockResolvedValue(undefined),
	};
}

function createMockTerminalService() {
	return {
		createTerminal: vi.fn(),
		disposeTerminal: vi.fn(),
		showTerminal: vi.fn(),
		hasTerminal: vi.fn().mockReturnValue(false),
		dispose: vi.fn(),
	};
}

function createMockRepoConfigService() {
	return {
		getAll: vi.fn().mockReturnValue([]),
		getForRepo: vi.fn(),
		addRepo: vi.fn(),
		removeRepo: vi.fn(),
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

describe("Agent Commands", () => {
	let agentService: ReturnType<typeof createMockAgentService>;
	let terminalService: ReturnType<typeof createMockTerminalService>;
	let repoConfigService: ReturnType<typeof createMockRepoConfigService>;
	let context: ReturnType<typeof createMockContext>;
	let registeredHandlers: Map<string, (...args: unknown[]) => unknown>;

	beforeEach(() => {
		vi.clearAllMocks();
		agentService = createMockAgentService();
		terminalService = createMockTerminalService();
		repoConfigService = createMockRepoConfigService();
		context = createMockContext();
		registeredHandlers = new Map();

		// Capture registered command handlers
		commands.registerCommand.mockImplementation(
			(id: string, handler: (...args: unknown[]) => unknown) => {
				registeredHandlers.set(id, handler);
				return { dispose: vi.fn() };
			},
		);

		registerAgentCommands(
			context as never,
			agentService as never,
			terminalService as never,
			repoConfigService as never,
		);
	});

	describe("registerAgentCommands", () => {
		it("registers three commands", () => {
			expect(commands.registerCommand).toHaveBeenCalledTimes(3);
			expect(registeredHandlers.has("vscode-agentic.createAgent")).toBe(true);
			expect(registeredHandlers.has("vscode-agentic.deleteAgent")).toBe(true);
			expect(registeredHandlers.has("vscode-agentic.focusAgent")).toBe(true);
		});

		it("pushes disposables to context.subscriptions", () => {
			expect(context.subscriptions.length).toBe(3);
		});
	});

	describe("createAgent command", () => {
		it("shows error message when no repos configured", async () => {
			repoConfigService.getAll.mockReturnValue([]);
			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;

			await handler();

			expect(window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining("No repositories configured"),
			);
		});

		it("auto-skips repo picker when only one repo configured", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			window.showInputBox.mockResolvedValueOnce("my-agent"); // agent name
			window.showInputBox.mockResolvedValueOnce(""); // initial prompt (empty)

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			// showQuickPick should NOT have been called for repo selection
			expect(window.showQuickPick).not.toHaveBeenCalled();
			expect(agentService.createAgent).toHaveBeenCalledWith("/repo", "my-agent", undefined);
		});

		it("shows repo QuickPick when multiple repos configured", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo1", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repo2", stagingBranch: "main", worktreeLimit: 5 },
			]);
			window.showQuickPick.mockResolvedValueOnce({
				label: "/repo1",
				description: "staging: staging",
				_repoPath: "/repo1",
			});
			window.showInputBox.mockResolvedValueOnce("my-agent"); // agent name
			window.showInputBox.mockResolvedValueOnce(""); // initial prompt

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(window.showQuickPick).toHaveBeenCalledTimes(1);
		});

		it("returns early when user cancels repo picker", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo1", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repo2", stagingBranch: "main", worktreeLimit: 5 },
			]);
			window.showQuickPick.mockResolvedValueOnce(undefined); // user cancels

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(agentService.createAgent).not.toHaveBeenCalled();
		});

		it("shows InputBox for agent name with branch validation", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			window.showInputBox.mockResolvedValueOnce("valid-name");
			window.showInputBox.mockResolvedValueOnce(""); // prompt

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			// Verify InputBox was called with validateInput
			expect(window.showInputBox).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Agent Name",
					validateInput: expect.any(Function),
				}),
			);
		});

		it("returns early when user cancels name input", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			window.showInputBox.mockResolvedValueOnce(undefined); // user cancels

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(agentService.createAgent).not.toHaveBeenCalled();
		});

		it("shows InputBox for optional initial prompt", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			window.showInputBox.mockResolvedValueOnce("my-agent"); // name
			window.showInputBox.mockResolvedValueOnce("Fix the auth module"); // prompt

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(agentService.createAgent).toHaveBeenCalledWith(
				"/repo",
				"my-agent",
				"Fix the auth module",
			);
		});

		it("returns early when user cancels prompt input", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			window.showInputBox.mockResolvedValueOnce("my-agent"); // name
			window.showInputBox.mockResolvedValueOnce(undefined); // user cancels prompt

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(agentService.createAgent).not.toHaveBeenCalled();
		});

		it("passes undefined prompt when empty string provided", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			window.showInputBox.mockResolvedValueOnce("my-agent"); // name
			window.showInputBox.mockResolvedValueOnce(""); // empty prompt

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(agentService.createAgent).toHaveBeenCalledWith("/repo", "my-agent", undefined);
		});

		it("shows info message on successful creation", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			window.showInputBox.mockResolvedValueOnce("my-agent");
			window.showInputBox.mockResolvedValueOnce("");

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("my-agent"),
			);
		});

		it("shows QuickPick for name collision with reuse or rename options", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			agentService.getAgent.mockReturnValue({
				agentName: "existing-agent",
				repoPath: "/repo",
				status: "created",
				createdAt: new Date().toISOString(),
			});
			window.showInputBox.mockResolvedValueOnce("existing-agent"); // name that collides
			// User chooses to reuse
			window.showQuickPick.mockResolvedValueOnce({
				label: "Reuse existing agent 'existing-agent'",
			});

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(window.showQuickPick).toHaveBeenCalled();
			expect(agentService.focusAgent).toHaveBeenCalledWith("/repo", "existing-agent");
		});

		it("shows new name InputBox when user picks rename on collision", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repo", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			// First call: name collides
			agentService.getAgent
				.mockReturnValueOnce({
					agentName: "existing-agent",
					repoPath: "/repo",
					status: "created",
					createdAt: new Date().toISOString(),
				})
				// Second call: new name does not collide
				.mockReturnValueOnce(undefined);

			window.showInputBox
				.mockResolvedValueOnce("existing-agent") // first name attempt
				.mockResolvedValueOnce("new-name") // renamed
				.mockResolvedValueOnce(""); // prompt

			// User picks "Pick a different name"
			window.showQuickPick.mockResolvedValueOnce({
				label: "Pick a different name",
			});

			const handler = registeredHandlers.get("vscode-agentic.createAgent")!;
			await handler();

			expect(agentService.createAgent).toHaveBeenCalledWith("/repo", "new-name", undefined);
		});
	});

	describe("deleteAgent command", () => {
		it("shows info when no agents to delete", async () => {
			agentService.getAll.mockReturnValue([]);

			const handler = registeredHandlers.get("vscode-agentic.deleteAgent")!;
			await handler();

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("No agents"),
			);
		});

		it("shows QuickPick listing agents with status indicators", async () => {
			agentService.getAll.mockReturnValue([
				{
					agentName: "agent-1",
					repoPath: "/repo",
					status: "running",
					createdAt: new Date().toISOString(),
				},
				{
					agentName: "agent-2",
					repoPath: "/repo",
					status: "created",
					createdAt: new Date().toISOString(),
				},
			]);
			window.showQuickPick.mockResolvedValueOnce(undefined); // user cancels

			const handler = registeredHandlers.get("vscode-agentic.deleteAgent")!;
			await handler();

			expect(window.showQuickPick).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						label: "agent-1",
						description: expect.stringContaining("running"),
					}),
				]),
				expect.any(Object),
			);
		});

		it("shows modal confirmation dialog before deleting", async () => {
			agentService.getAll.mockReturnValue([
				{
					agentName: "agent-1",
					repoPath: "/repo",
					status: "created",
					createdAt: new Date().toISOString(),
				},
			]);
			window.showQuickPick.mockResolvedValueOnce({
				label: "agent-1",
				description: "created - /repo",
				_repoPath: "/repo",
				_agentName: "agent-1",
			});
			window.showWarningMessage.mockResolvedValueOnce("Delete");

			const handler = registeredHandlers.get("vscode-agentic.deleteAgent")!;
			await handler();

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("agent-1"),
				expect.objectContaining({ modal: true }),
				"Delete",
			);
			expect(agentService.deleteAgent).toHaveBeenCalledWith("/repo", "agent-1");
		});

		it("shows extra 'still running' warning for running agents", async () => {
			agentService.getAll.mockReturnValue([
				{
					agentName: "running-agent",
					repoPath: "/repo",
					status: "running",
					createdAt: new Date().toISOString(),
				},
			]);
			window.showQuickPick.mockResolvedValueOnce({
				label: "running-agent",
				description: "running - /repo",
				_repoPath: "/repo",
				_agentName: "running-agent",
				_status: "running",
			});
			window.showWarningMessage.mockResolvedValueOnce("Delete");

			const handler = registeredHandlers.get("vscode-agentic.deleteAgent")!;
			await handler();

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("still running"),
				expect.objectContaining({ modal: true }),
				"Delete",
			);
		});

		it("returns early when user cancels picker", async () => {
			agentService.getAll.mockReturnValue([
				{
					agentName: "agent-1",
					repoPath: "/repo",
					status: "created",
					createdAt: new Date().toISOString(),
				},
			]);
			window.showQuickPick.mockResolvedValueOnce(undefined);

			const handler = registeredHandlers.get("vscode-agentic.deleteAgent")!;
			await handler();

			expect(agentService.deleteAgent).not.toHaveBeenCalled();
		});

		it("returns early when user cancels confirmation", async () => {
			agentService.getAll.mockReturnValue([
				{
					agentName: "agent-1",
					repoPath: "/repo",
					status: "created",
					createdAt: new Date().toISOString(),
				},
			]);
			window.showQuickPick.mockResolvedValueOnce({
				label: "agent-1",
				description: "created - /repo",
				_repoPath: "/repo",
				_agentName: "agent-1",
			});
			window.showWarningMessage.mockResolvedValueOnce(undefined); // user cancels

			const handler = registeredHandlers.get("vscode-agentic.deleteAgent")!;
			await handler();

			expect(agentService.deleteAgent).not.toHaveBeenCalled();
		});

		it("shows info message after successful deletion", async () => {
			agentService.getAll.mockReturnValue([
				{
					agentName: "agent-1",
					repoPath: "/repo",
					status: "created",
					createdAt: new Date().toISOString(),
				},
			]);
			window.showQuickPick.mockResolvedValueOnce({
				label: "agent-1",
				description: "created - /repo",
				_repoPath: "/repo",
				_agentName: "agent-1",
			});
			window.showWarningMessage.mockResolvedValueOnce("Delete");

			const handler = registeredHandlers.get("vscode-agentic.deleteAgent")!;
			await handler();

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("agent-1"),
			);
		});
	});

	describe("focusAgent command", () => {
		it("shows info when no agents available", async () => {
			agentService.getAll.mockReturnValue([]);

			const handler = registeredHandlers.get("vscode-agentic.focusAgent")!;
			await handler();

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("No agents"),
			);
		});

		it("shows QuickPick listing agents with status", async () => {
			agentService.getAll.mockReturnValue([
				{
					agentName: "agent-1",
					repoPath: "/repo",
					status: "running",
					createdAt: new Date().toISOString(),
				},
			]);
			window.showQuickPick.mockResolvedValueOnce({
				label: "agent-1",
				_repoPath: "/repo",
				_agentName: "agent-1",
			});

			const handler = registeredHandlers.get("vscode-agentic.focusAgent")!;
			await handler();

			expect(window.showQuickPick).toHaveBeenCalled();
			expect(agentService.focusAgent).toHaveBeenCalledWith("/repo", "agent-1");
		});

		it("returns early when user cancels picker", async () => {
			agentService.getAll.mockReturnValue([
				{
					agentName: "agent-1",
					repoPath: "/repo",
					status: "created",
					createdAt: new Date().toISOString(),
				},
			]);
			window.showQuickPick.mockResolvedValueOnce(undefined);

			const handler = registeredHandlers.get("vscode-agentic.focusAgent")!;
			await handler();

			expect(agentService.focusAgent).not.toHaveBeenCalled();
		});
	});
});
