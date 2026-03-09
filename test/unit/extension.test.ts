import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento } from "../__mocks__/vscode";

// Track constructor arguments for each service
const worktreeServiceConstructorArgs: unknown[][] = [];
const repoConfigServiceConstructorArgs: unknown[][] = [];
const agentServiceConstructorArgs: unknown[][] = [];
const workspaceServiceConstructorArgs: unknown[][] = [];

// Mock WorkspaceService
const mockWorkspaceServiceInstance = {
	ensureWorkspaceFile: vi.fn().mockResolvedValue(false),
	syncWorkspaceFile: vi.fn().mockResolvedValue(undefined),
	promptReopenInWorkspace: vi.fn().mockResolvedValue(undefined),
	setExplorerScope: vi.fn(),
	resetExplorerScope: vi.fn(),
	isInWorkspaceMode: vi.fn().mockReturnValue(false),
	getWorkspaceFilePath: vi.fn().mockReturnValue("/home/test/.agentic/agentic.code-workspace"),
};

// Mock all service modules before importing extension
// Use class-based mocks so `new` works correctly
vi.mock("../../src/services/git.service", () => {
	return {
		GitService: class MockGitService {
			exec = vi.fn().mockResolvedValue("");
		},
	};
});

vi.mock("../../src/services/worktree.service", () => {
	return {
		WorktreeService: class MockWorktreeService {
			constructor(...args: unknown[]) {
				worktreeServiceConstructorArgs.push(args);
			}
			reconcile = vi.fn().mockResolvedValue({
				orphanedInManifest: [],
				orphanedOnDisk: [],
				healthy: [],
			});
		},
	};
});

vi.mock("../../src/services/repo-config.service", () => {
	return {
		RepoConfigService: class MockRepoConfigService {
			constructor(...args: unknown[]) {
				repoConfigServiceConstructorArgs.push(args);
			}
			getAll = vi.fn().mockReturnValue([]);
		},
	};
});

vi.mock("../../src/services/workspace.service", () => {
	return {
		WorkspaceService: class MockWorkspaceService {
			constructor(...args: unknown[]) {
				workspaceServiceConstructorArgs.push(args);
				Object.assign(this, mockWorkspaceServiceInstance);
			}
		},
	};
});

vi.mock("../../src/services/agent.service", () => {
	return {
		AgentService: class MockAgentService {
			constructor(...args: unknown[]) {
				agentServiceConstructorArgs.push(args);
			}
			setTerminalService = vi.fn();
			onDidChange = vi.fn();
			reconcileOnActivation = vi.fn().mockResolvedValue(undefined);
			dispose = vi.fn();
		},
	};
});

vi.mock("../../src/services/terminal.service", () => {
	return {
		TerminalService: class MockTerminalService {
			dispose = vi.fn();
		},
	};
});

vi.mock("../../src/commands/agent.commands", () => ({
	registerAgentCommands: vi.fn(),
}));

vi.mock("../../src/commands/repo.commands", () => ({
	registerRepoCommands: vi.fn(),
}));

vi.mock("../../src/commands/workspace.commands", () => ({
	registerWorkspaceCommands: vi.fn(),
}));

vi.mock("../../src/views/sidebar-provider", () => {
	return {
		SidebarViewProvider: class MockSidebarViewProvider {
			static viewType = "vscode-agentic.dashboard";
		},
	};
});

describe("extension activate() - globalState usage", () => {
	let globalStateMock: ReturnType<typeof createMockMemento>;
	let workspaceStateMock: ReturnType<typeof createMockMemento>;
	let context: {
		globalState: ReturnType<typeof createMockMemento>;
		workspaceState: ReturnType<typeof createMockMemento>;
		extensionUri: { fsPath: string };
		subscriptions: { dispose: () => void }[];
	};

	beforeEach(() => {
		vi.clearAllMocks();
		worktreeServiceConstructorArgs.length = 0;
		repoConfigServiceConstructorArgs.length = 0;
		agentServiceConstructorArgs.length = 0;
		workspaceServiceConstructorArgs.length = 0;

		globalStateMock = createMockMemento();
		workspaceStateMock = createMockMemento();

		context = {
			globalState: globalStateMock,
			workspaceState: workspaceStateMock,
			extensionUri: { fsPath: "/mock/extension" },
			subscriptions: [],
		};
	});

	it("passes context.globalState (not workspaceState) to WorktreeService constructor", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		expect(worktreeServiceConstructorArgs.length).toBe(1);
		const [_gitService, mementoArg] = worktreeServiceConstructorArgs[0];
		expect(mementoArg).toBe(globalStateMock);
		expect(mementoArg).not.toBe(workspaceStateMock);
	});

	it("passes context.globalState (not workspaceState) to RepoConfigService constructor", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		expect(repoConfigServiceConstructorArgs.length).toBe(1);
		const [mementoArg] = repoConfigServiceConstructorArgs[0];
		expect(mementoArg).toBe(globalStateMock);
		expect(mementoArg).not.toBe(workspaceStateMock);
	});

	it("passes context.globalState (not workspaceState) to AgentService constructor", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		expect(agentServiceConstructorArgs.length).toBe(1);
		const [mementoArg] = agentServiceConstructorArgs[0];
		expect(mementoArg).toBe(globalStateMock);
		expect(mementoArg).not.toBe(workspaceStateMock);
	});

	it("creates WorkspaceService with repoConfigService", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		expect(workspaceServiceConstructorArgs.length).toBe(1);
		// WorkspaceService constructor receives the repoConfigService instance
		expect(workspaceServiceConstructorArgs[0].length).toBe(1);
	});

	it("calls ensureWorkspaceFile on activation", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		// Allow microtasks/promises to settle
		await new Promise((r) => setTimeout(r, 10));

		expect(mockWorkspaceServiceInstance.ensureWorkspaceFile).toHaveBeenCalled();
	});

	it("calls promptReopenInWorkspace when ensureWorkspaceFile returns true", async () => {
		mockWorkspaceServiceInstance.ensureWorkspaceFile.mockResolvedValueOnce(true);

		const { activate } = await import("../../src/extension");
		activate(context as never);

		// Allow microtasks/promises to settle
		await new Promise((r) => setTimeout(r, 10));

		expect(mockWorkspaceServiceInstance.promptReopenInWorkspace).toHaveBeenCalled();
	});

	it("does NOT call promptReopenInWorkspace when ensureWorkspaceFile returns false", async () => {
		mockWorkspaceServiceInstance.ensureWorkspaceFile.mockResolvedValueOnce(false);

		const { activate } = await import("../../src/extension");
		activate(context as never);

		// Allow microtasks/promises to settle
		await new Promise((r) => setTimeout(r, 10));

		expect(mockWorkspaceServiceInstance.promptReopenInWorkspace).not.toHaveBeenCalled();
	});

	it("calls registerWorkspaceCommands with context and workspaceService", async () => {
		const { activate } = await import("../../src/extension");
		const { registerWorkspaceCommands } = await import("../../src/commands/workspace.commands");
		activate(context as never);

		expect(registerWorkspaceCommands).toHaveBeenCalledWith(
			context,
			expect.objectContaining({
				ensureWorkspaceFile: expect.any(Function),
				setExplorerScope: expect.any(Function),
			}),
		);
	});

	it("passes workspaceService to registerAgentCommands", async () => {
		const { activate } = await import("../../src/extension");
		const { registerAgentCommands } = await import("../../src/commands/agent.commands");
		activate(context as never);

		expect(registerAgentCommands).toHaveBeenCalledWith(
			context,
			expect.anything(), // agentService
			expect.anything(), // terminalService
			expect.anything(), // repoConfigService
			expect.anything(), // worktreeService
			expect.objectContaining({
				setExplorerScope: expect.any(Function),
			}),
		);
	});

	it("passes workspaceService to registerRepoCommands", async () => {
		const { activate } = await import("../../src/extension");
		const { registerRepoCommands } = await import("../../src/commands/repo.commands");
		activate(context as never);

		expect(registerRepoCommands).toHaveBeenCalledWith(
			context,
			expect.anything(), // repoConfigService
			expect.objectContaining({
				syncWorkspaceFile: expect.any(Function),
			}),
		);
	});
});
