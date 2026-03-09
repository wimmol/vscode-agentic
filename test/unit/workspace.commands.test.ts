import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands } from "../__mocks__/vscode";
import { registerWorkspaceCommands } from "../../src/commands/workspace.commands";

function createMockWorkspaceService() {
	return {
		setExplorerScope: vi.fn(),
		resetExplorerScope: vi.fn(),
		ensureWorkspaceFile: vi.fn().mockResolvedValue(false),
		syncWorkspaceFile: vi.fn().mockResolvedValue(undefined),
		isInWorkspaceMode: vi.fn().mockReturnValue(false),
		promptReopenInWorkspace: vi.fn().mockResolvedValue(undefined),
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

describe("registerWorkspaceCommands", () => {
	let workspaceService: ReturnType<typeof createMockWorkspaceService>;
	let context: ReturnType<typeof createMockContext>;
	let commandHandlers: Map<string, (...args: unknown[]) => unknown>;

	beforeEach(() => {
		vi.clearAllMocks();
		workspaceService = createMockWorkspaceService();
		context = createMockContext();
		commandHandlers = new Map();

		commands.registerCommand.mockImplementation((id: string, handler: (...args: unknown[]) => unknown) => {
			commandHandlers.set(id, handler);
			return { dispose: vi.fn() };
		});

		registerWorkspaceCommands(context as never, workspaceService as never);
	});

	it("registers rootGlobal and rootRepo commands", () => {
		expect(commandHandlers.has("vscode-agentic.rootGlobal")).toBe(true);
		expect(commandHandlers.has("vscode-agentic.rootRepo")).toBe(true);
	});

	it("pushes disposables to context.subscriptions", () => {
		expect(context.subscriptions).toHaveLength(2);
	});

	describe("rootGlobal command", () => {
		it("calls workspaceService.resetExplorerScope()", () => {
			const handler = commandHandlers.get("vscode-agentic.rootGlobal")!;
			handler();

			expect(workspaceService.resetExplorerScope).toHaveBeenCalled();
		});
	});

	describe("rootRepo command", () => {
		it("calls workspaceService.setExplorerScope(repoPath)", () => {
			const handler = commandHandlers.get("vscode-agentic.rootRepo")!;
			handler("/repos/my-app");

			expect(workspaceService.setExplorerScope).toHaveBeenCalledWith("/repos/my-app");
		});
	});
});
