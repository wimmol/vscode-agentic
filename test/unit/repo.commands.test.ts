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
	let context: ReturnType<typeof createMockContext>;
	let commandHandlers: Map<string, (...args: unknown[]) => unknown>;

	beforeEach(() => {
		vi.clearAllMocks();
		repoConfigService = createMockRepoConfigService();
		context = createMockContext();
		commandHandlers = new Map();

		commands.registerCommand.mockImplementation((id: string, handler: (...args: unknown[]) => unknown) => {
			commandHandlers.set(id, handler);
			return { dispose: vi.fn() };
		});

		registerRepoCommands(context as never, repoConfigService as never);
	});

	it("registers addRepo and removeRepo commands", () => {
		expect(commandHandlers.has("vscode-agentic.addRepo")).toBe(true);
		expect(commandHandlers.has("vscode-agentic.removeRepo")).toBe(true);
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

		it("does nothing when user cancels confirmation", async () => {
			window.showWarningMessage.mockResolvedValueOnce(undefined);

			const handler = commandHandlers.get("vscode-agentic.removeRepo")!;
			await handler("/repo");

			expect(repoConfigService.removeRepo).not.toHaveBeenCalled();
		});

		it("shows info message on successful removal", async () => {
			window.showWarningMessage.mockResolvedValueOnce("Remove");

			const handler = commandHandlers.get("vscode-agentic.removeRepo")!;
			await handler("/repo");

			expect(window.showInformationMessage).toHaveBeenCalled();
		});
	});
});
