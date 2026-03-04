import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSwitchService } from "../../src/services/workspace-switch.service.js";
import { commands, Uri, window, workspace } from "../__mocks__/vscode.js";

function createMockAgentService() {
	return {
		focusAgent: vi.fn().mockResolvedValue(undefined),
		getAll: vi.fn().mockReturnValue([]),
		getForRepo: vi.fn().mockReturnValue([]),
		getAgent: vi.fn().mockReturnValue(undefined),
		createAgent: vi.fn().mockResolvedValue(undefined),
		deleteAgent: vi.fn().mockResolvedValue(undefined),
		updateStatus: vi.fn().mockResolvedValue(undefined),
		setTerminalService: vi.fn(),
		reconcileOnActivation: vi.fn().mockResolvedValue(undefined),
		onDidChangeAgents: vi.fn(),
		dispose: vi.fn(),
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

function createMockWorktreeService() {
	return {
		getManifest: vi.fn().mockReturnValue([]),
		addWorktree: vi.fn().mockResolvedValue(undefined),
		removeWorktree: vi.fn().mockResolvedValue(undefined),
		reconcile: vi
			.fn()
			.mockResolvedValue({ orphanedInManifest: [], orphanedOnDisk: [], healthy: [] }),
	};
}

describe("WorkspaceSwitchService", () => {
	let agentService: ReturnType<typeof createMockAgentService>;
	let terminalService: ReturnType<typeof createMockTerminalService>;
	let worktreeService: ReturnType<typeof createMockWorktreeService>;
	let switchService: WorkspaceSwitchService;

	beforeEach(() => {
		vi.clearAllMocks();
		agentService = createMockAgentService();
		terminalService = createMockTerminalService();
		worktreeService = createMockWorktreeService();
		switchService = new WorkspaceSwitchService(
			agentService as never,
			terminalService as never,
			worktreeService as never,
		);
		workspace.workspaceFolders = undefined;
	});

	describe("getActiveAgent", () => {
		it("returns undefined before any switch", () => {
			expect(switchService.getActiveAgent()).toBeUndefined();
		});

		it("returns active agent after switching", async () => {
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/worktree/agent-1",
					branch: "agent-1",
					agentName: "agent-1",
					repoPath: "/repo",
					createdAt: "2026-01-01",
				},
			]);

			await switchService.switchToAgent("/repo", "agent-1");

			expect(switchService.getActiveAgent()).toEqual({
				repoPath: "/repo",
				agentName: "agent-1",
			});
		});
	});

	describe("switchToAgent - same repo", () => {
		it("calls agentService.focusAgent only for same-repo switch", async () => {
			// Set up initial active agent
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/worktree/agent-1",
					branch: "agent-1",
					agentName: "agent-1",
					repoPath: "/repo",
					createdAt: "2026-01-01",
				},
			]);
			await switchService.switchToAgent("/repo", "agent-1");
			vi.clearAllMocks();

			// Now switch to another agent in the same repo
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/worktree/agent-2",
					branch: "agent-2",
					agentName: "agent-2",
					repoPath: "/repo",
					createdAt: "2026-01-01",
				},
			]);
			await switchService.switchToAgent("/repo", "agent-2");

			expect(agentService.focusAgent).toHaveBeenCalledWith("/repo", "agent-2");
			expect(workspace.updateWorkspaceFolders).not.toHaveBeenCalled();
			expect(commands.executeCommand).not.toHaveBeenCalled();
			expect(window.showTextDocument).not.toHaveBeenCalled();
		});
	});

	describe("switchToAgent - cross repo", () => {
		it("adds worktree folder, reveals in explorer, and opens README in editor", async () => {
			workspace.workspaceFolders = [{ uri: { fsPath: "/other-repo" } }];
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/agent-1",
					branch: "agent-1",
					agentName: "agent-1",
					repoPath: "/repo",
					createdAt: "2026-01-01",
				},
			]);

			await switchService.switchToAgent("/repo", "agent-1");

			expect(agentService.focusAgent).toHaveBeenCalledWith("/repo", "agent-1");
			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(1, 0, {
				uri: Uri.file("/repo/.worktrees/agent-1"),
			});
			expect(commands.executeCommand).toHaveBeenCalledWith("workbench.view.explorer");
			expect(commands.executeCommand).toHaveBeenCalledWith(
				"revealInExplorer",
				Uri.file("/repo/.worktrees/agent-1"),
			);
			expect(workspace.openTextDocument).toHaveBeenCalled();
			expect(window.showTextDocument).toHaveBeenCalled();
		});

		it("does NOT call updateWorkspaceFolders when worktree already in workspace", async () => {
			const worktreeUri = { fsPath: "/repo/.worktrees/agent-1", scheme: "file" };
			workspace.workspaceFolders = [{ uri: worktreeUri }];
			Uri.file.mockReturnValue(worktreeUri);
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/agent-1",
					branch: "agent-1",
					agentName: "agent-1",
					repoPath: "/repo",
					createdAt: "2026-01-01",
				},
			]);

			await switchService.switchToAgent("/repo", "agent-1");

			expect(workspace.updateWorkspaceFolders).not.toHaveBeenCalled();
			// Still opens editor and reveals
			expect(workspace.openTextDocument).toHaveBeenCalled();
			expect(window.showTextDocument).toHaveBeenCalled();
		});

		it("opens README.md from worktree root", async () => {
			workspace.workspaceFolders = [];
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/agent-1",
					branch: "agent-1",
					agentName: "agent-1",
					repoPath: "/repo",
					createdAt: "2026-01-01",
				},
			]);

			await switchService.switchToAgent("/repo", "agent-1");

			expect(Uri.joinPath).toHaveBeenCalledWith(Uri.file("/repo/.worktrees/agent-1"), "README.md");
		});

		it("does not throw when README.md does not exist", async () => {
			workspace.workspaceFolders = [];
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/agent-1",
					branch: "agent-1",
					agentName: "agent-1",
					repoPath: "/repo",
					createdAt: "2026-01-01",
				},
			]);
			workspace.openTextDocument.mockRejectedValueOnce(new Error("File not found"));

			// Should not throw
			await expect(switchService.switchToAgent("/repo", "agent-1")).resolves.not.toThrow();

			expect(agentService.focusAgent).toHaveBeenCalledWith("/repo", "agent-1");
		});
	});

	describe("active agent tracking", () => {
		it("updates activeAgent after each switch", async () => {
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/worktree/a",
					branch: "a",
					agentName: "a",
					repoPath: "/repo1",
					createdAt: "2026-01-01",
				},
			]);
			await switchService.switchToAgent("/repo1", "a");
			expect(switchService.getActiveAgent()).toEqual({ repoPath: "/repo1", agentName: "a" });

			worktreeService.getManifest.mockReturnValue([
				{
					path: "/worktree/b",
					branch: "b",
					agentName: "b",
					repoPath: "/repo2",
					createdAt: "2026-01-01",
				},
			]);
			await switchService.switchToAgent("/repo2", "b");
			expect(switchService.getActiveAgent()).toEqual({ repoPath: "/repo2", agentName: "b" });
		});
	});
});
