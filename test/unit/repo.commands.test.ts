import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, window } from "../__mocks__/vscode";
import { registerRepoCommands } from "../../src/commands/repo.commands";

function createMockRepoConfigService() {
	return {
		getAll: vi.fn().mockReturnValue([{ path: "/repo", stagingBranch: "main", worktreeLimit: 5 }]),
		getForRepo: vi.fn(),
		addRepo: vi.fn().mockResolvedValue(undefined),
		removeRepo: vi.fn().mockResolvedValue(undefined),
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

describe("registerRepoCommands", () => {
	let repoConfigService: ReturnType<typeof createMockRepoConfigService>;
	let workspaceService: ReturnType<typeof createMockWorkspaceService>;
	let context: ReturnType<typeof createMockContext>;
	let commandHandlers: Map<string, (...args: unknown[]) => unknown>;

	beforeEach(() => {
		vi.clearAllMocks();
		repoConfigService = createMockRepoConfigService();
		workspaceService = createMockWorkspaceService();
		context = createMockContext();
		commandHandlers = new Map();

		commands.registerCommand.mockImplementation((id: string, handler: (...args: unknown[]) => unknown) => {
			commandHandlers.set(id, handler);
			return { dispose: vi.fn() };
		});

		registerRepoCommands(context as never, repoConfigService as never, workspaceService as never);
	});

	it("registers addRepo and removeRepo commands", () => {
		expect(commandHandlers.has("vscode-agentic.addRepo")).toBe(true);
		expect(commandHandlers.has("vscode-agentic.removeRepo")).toBe(true);
	});

	describe("addRepo command", () => {
		it("calls workspaceService.syncWorkspaceFile after successful add", async () => {
			repoConfigService.addRepo.mockResolvedValueOnce({ path: "/new-repo", stagingBranch: "main", worktreeLimit: 5 });

			const handler = commandHandlers.get("vscode-agentic.addRepo")!;
			await handler();

			expect(workspaceService.syncWorkspaceFile).toHaveBeenCalled();
		});

		it("does NOT call syncWorkspaceFile when addRepo returns nothing", async () => {
			repoConfigService.addRepo.mockResolvedValueOnce(undefined);

			const handler = commandHandlers.get("vscode-agentic.addRepo")!;
			await handler();

			expect(workspaceService.syncWorkspaceFile).not.toHaveBeenCalled();
		});
	});

	describe("removeRepo command", () => {
		it("shows confirmation dialog and calls removeRepo on confirm", async () => {
			window.showWarningMessage.mockResolvedValueOnce("Remove");

			const handler = commandHandlers.get("vscode-agentic.removeRepo")!;
			await handler("/repo");

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("repo"),
				expect.objectContaining({ modal: true }),
				"Remove",
			);
			expect(repoConfigService.removeRepo).toHaveBeenCalledWith("/repo");
		});

		it("calls workspaceService.syncWorkspaceFile after successful remove", async () => {
			window.showWarningMessage.mockResolvedValueOnce("Remove");

			const handler = commandHandlers.get("vscode-agentic.removeRepo")!;
			await handler("/repo");

			expect(workspaceService.syncWorkspaceFile).toHaveBeenCalled();
		});

		it("does nothing when user cancels confirmation", async () => {
			window.showWarningMessage.mockResolvedValueOnce(undefined);

			const handler = commandHandlers.get("vscode-agentic.removeRepo")!;
			await handler("/repo");

			expect(repoConfigService.removeRepo).not.toHaveBeenCalled();
			expect(workspaceService.syncWorkspaceFile).not.toHaveBeenCalled();
		});

		it("shows info message on successful removal", async () => {
			window.showWarningMessage.mockResolvedValueOnce("Remove");

			const handler = commandHandlers.get("vscode-agentic.removeRepo")!;
			await handler("/repo");

			expect(window.showInformationMessage).toHaveBeenCalled();
		});
	});
});
