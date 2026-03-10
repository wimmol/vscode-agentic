import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento } from "../__mocks__/vscode";

// Track constructor arguments for each service/store
const agentsStoreConstructorArgs: unknown[][] = [];
const reposStoreConstructorArgs: unknown[][] = [];
const workspaceServiceConstructorArgs: unknown[][] = [];

// Mock AgentsStore
const mockAgentsStoreInstance = {
	getAll: vi.fn().mockReturnValue([]),
	getForRepo: vi.fn().mockReturnValue([]),
	save: vi.fn().mockResolvedValue(undefined),
	dispose: vi.fn(),
	onDidChange: vi.fn(),
};

// Mock ReposStore
const mockReposStoreInstance = {
	getAll: vi.fn().mockReturnValue([]),
	getForRepo: vi.fn().mockReturnValue(undefined),
	save: vi.fn().mockResolvedValue(undefined),
	dispose: vi.fn(),
	onDidChange: vi.fn(),
};

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

// Mock all modules before importing extension
vi.mock("../../src/services/git.service", () => {
	return {
		GitService: class MockGitService {
			exec = vi.fn().mockResolvedValue("");
		},
	};
});

vi.mock("../../src/services/agents-store", () => {
	return {
		AgentsStore: class MockAgentsStore {
			constructor(...args: unknown[]) {
				agentsStoreConstructorArgs.push(args);
				Object.assign(this, mockAgentsStoreInstance);
			}
		},
	};
});

vi.mock("../../src/services/repos-store", () => {
	return {
		ReposStore: class MockReposStore {
			constructor(...args: unknown[]) {
				reposStoreConstructorArgs.push(args);
				Object.assign(this, mockReposStoreInstance);
			}
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

vi.mock("../../src/utils/terminal", () => ({
	initTerminals: vi.fn().mockReturnValue([]),
	disposeAllTerminals: vi.fn(),
}));

vi.mock("../../src/features/create-agent", () => ({
	registerCreateAgent: vi.fn(),
}));

vi.mock("../../src/features/delete-agent", () => ({
	registerDeleteAgent: vi.fn(),
}));

vi.mock("../../src/features/focus-agent", () => ({
	registerFocusAgent: vi.fn(),
}));

vi.mock("../../src/features/stop-agent", () => ({
	registerStopAgent: vi.fn(),
}));

vi.mock("../../src/features/add-repo", () => ({
	registerAddRepo: vi.fn(),
}));

vi.mock("../../src/features/remove-repo", () => ({
	registerRemoveRepo: vi.fn(),
}));

vi.mock("../../src/features/root-global", () => ({
	registerRootGlobal: vi.fn(),
}));

vi.mock("../../src/features/root-repo", () => ({
	registerRootRepo: vi.fn(),
}));

vi.mock("../../src/ui/view", () => {
	return {
		SidebarViewProvider: class MockSidebarViewProvider {
			static viewType = "vscode-agentic.agents";
		},
	};
});

describe("extension activate() - new architecture", () => {
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
		agentsStoreConstructorArgs.length = 0;
		reposStoreConstructorArgs.length = 0;
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

	it("passes context.globalState to AgentsStore constructor", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		expect(agentsStoreConstructorArgs.length).toBe(1);
		const [mementoArg] = agentsStoreConstructorArgs[0];
		expect(mementoArg).toBe(globalStateMock);
		expect(mementoArg).not.toBe(workspaceStateMock);
	});

	it("passes context.globalState to ReposStore constructor", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		expect(reposStoreConstructorArgs.length).toBe(1);
		const [mementoArg] = reposStoreConstructorArgs[0];
		expect(mementoArg).toBe(globalStateMock);
		expect(mementoArg).not.toBe(workspaceStateMock);
	});

	it("creates WorkspaceService with reposStore", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		expect(workspaceServiceConstructorArgs.length).toBe(1);
		expect(workspaceServiceConstructorArgs[0].length).toBe(1);
	});

	it("registers all 8 feature commands", async () => {
		const { activate } = await import("../../src/extension");
		const { registerCreateAgent } = await import("../../src/features/create-agent");
		const { registerDeleteAgent } = await import("../../src/features/delete-agent");
		const { registerFocusAgent } = await import("../../src/features/focus-agent");
		const { registerStopAgent } = await import("../../src/features/stop-agent");
		const { registerAddRepo } = await import("../../src/features/add-repo");
		const { registerRemoveRepo } = await import("../../src/features/remove-repo");
		const { registerRootGlobal } = await import("../../src/features/root-global");
		const { registerRootRepo } = await import("../../src/features/root-repo");
		activate(context as never);

		expect(registerCreateAgent).toHaveBeenCalledOnce();
		expect(registerDeleteAgent).toHaveBeenCalledOnce();
		expect(registerFocusAgent).toHaveBeenCalledOnce();
		expect(registerStopAgent).toHaveBeenCalledOnce();
		expect(registerAddRepo).toHaveBeenCalledOnce();
		expect(registerRemoveRepo).toHaveBeenCalledOnce();
		expect(registerRootGlobal).toHaveBeenCalledOnce();
		expect(registerRootRepo).toHaveBeenCalledOnce();
	});

	it("calls initTerminals with a status callback", async () => {
		const { activate } = await import("../../src/extension");
		const { initTerminals } = await import("../../src/utils/terminal");
		activate(context as never);

		expect(initTerminals).toHaveBeenCalledWith(expect.any(Function));
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

	it("pushes dispose callbacks to context.subscriptions", async () => {
		const { activate } = await import("../../src/extension");
		activate(context as never);

		// Should have subscriptions for: webview provider, agentsStore dispose, reposStore dispose, terminals dispose
		expect(context.subscriptions.length).toBeGreaterThanOrEqual(4);
	});
});
