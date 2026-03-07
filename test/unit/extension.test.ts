import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento } from "../__mocks__/vscode";

// Track constructor arguments for each service
const worktreeServiceConstructorArgs: unknown[][] = [];
const repoConfigServiceConstructorArgs: unknown[][] = [];
const agentServiceConstructorArgs: unknown[][] = [];

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
});
