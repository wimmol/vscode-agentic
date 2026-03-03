import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, env, window } from "../__mocks__/vscode.js";
import { registerSidebarCommands } from "../../src/commands/sidebar.commands.js";

function createMockAgentService() {
	return {
		focusAgent: vi.fn().mockResolvedValue(undefined),
		deleteAgent: vi.fn().mockResolvedValue(undefined),
		getAll: vi.fn().mockReturnValue([]),
		getForRepo: vi.fn().mockReturnValue([]),
		getAgent: vi.fn().mockReturnValue(undefined),
		createAgent: vi.fn().mockResolvedValue(undefined),
		updateStatus: vi.fn().mockResolvedValue(undefined),
		setTerminalService: vi.fn(),
		reconcileOnActivation: vi.fn().mockResolvedValue(undefined),
		onDidChangeAgents: vi.fn(),
		dispose: vi.fn(),
	};
}

function createMockWorkspaceSwitchService() {
	return {
		switchToAgent: vi.fn().mockResolvedValue(undefined),
		getActiveAgent: vi.fn().mockReturnValue(undefined),
	};
}

function createMockTreeView() {
	return {
		reveal: vi.fn(),
		dispose: vi.fn(),
		onDidChangeVisibility: vi.fn(),
	};
}

function createMockTreeProvider() {
	return {
		refresh: vi.fn(),
		dispose: vi.fn(),
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

describe("Sidebar Commands", () => {
	let agentService: ReturnType<typeof createMockAgentService>;
	let switchService: ReturnType<typeof createMockWorkspaceSwitchService>;
	let treeView: ReturnType<typeof createMockTreeView>;
	let treeProvider: ReturnType<typeof createMockTreeProvider>;
	let context: ReturnType<typeof createMockContext>;
	let registeredHandlers: Map<string, (...args: unknown[]) => unknown>;

	beforeEach(() => {
		vi.clearAllMocks();
		agentService = createMockAgentService();
		switchService = createMockWorkspaceSwitchService();
		treeView = createMockTreeView();
		treeProvider = createMockTreeProvider();
		context = createMockContext();
		registeredHandlers = new Map();

		commands.registerCommand.mockImplementation(
			(id: string, handler: (...args: unknown[]) => unknown) => {
				registeredHandlers.set(id, handler);
				return { dispose: vi.fn() };
			},
		);

		registerSidebarCommands(
			context as never,
			agentService as never,
			switchService as never,
			treeView as never,
			treeProvider as never,
		);
	});

	describe("registerSidebarCommands", () => {
		it("registers four sidebar commands", () => {
			expect(registeredHandlers.has("vscode-agentic.focusAgentFromTile")).toBe(true);
			expect(registeredHandlers.has("vscode-agentic.deleteAgentFromTile")).toBe(true);
			expect(registeredHandlers.has("vscode-agentic.copyBranchName")).toBe(true);
			expect(registeredHandlers.has("vscode-agentic.createAgentInRepo")).toBe(true);
		});
	});

	describe("focusAgentFromTile", () => {
		it("calls switchToAgent and reveals in tree", async () => {
			const handler = registeredHandlers.get("vscode-agentic.focusAgentFromTile")!;
			await handler("/repo", "my-agent");

			expect(switchService.switchToAgent).toHaveBeenCalledWith("/repo", "my-agent");
			expect(treeView.reveal).toHaveBeenCalled();
		});
	});

	describe("deleteAgentFromTile", () => {
		it("shows confirmation dialog and deletes on confirm", async () => {
			window.showWarningMessage.mockResolvedValueOnce("Delete");

			const handler = registeredHandlers.get("vscode-agentic.deleteAgentFromTile")!;
			await handler("/repo", "my-agent");

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("my-agent"),
				expect.objectContaining({ modal: true }),
				"Delete",
			);
			expect(agentService.deleteAgent).toHaveBeenCalledWith("/repo", "my-agent");
			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("my-agent"),
			);
		});

		it("does nothing when user cancels confirmation", async () => {
			window.showWarningMessage.mockResolvedValueOnce(undefined);

			const handler = registeredHandlers.get("vscode-agentic.deleteAgentFromTile")!;
			await handler("/repo", "my-agent");

			expect(agentService.deleteAgent).not.toHaveBeenCalled();
		});
	});

	describe("copyBranchName", () => {
		it("copies agent name to clipboard and shows info message", async () => {
			const handler = registeredHandlers.get("vscode-agentic.copyBranchName")!;
			await handler("/repo", "my-agent");

			expect(env.clipboard.writeText).toHaveBeenCalledWith("my-agent");
			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("my-agent"),
			);
		});
	});

	describe("createAgentInRepo", () => {
		it("calls createAgent command with pre-selected repoPath", async () => {
			const handler = registeredHandlers.get("vscode-agentic.createAgentInRepo")!;
			await handler("/repo");

			expect(commands.executeCommand).toHaveBeenCalledWith(
				"vscode-agentic.createAgent",
				"/repo",
			);
		});
	});
});
