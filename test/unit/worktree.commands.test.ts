import { beforeEach, describe, expect, it, vi } from "vitest";
import { window } from "vscode";
import { handleWorktreeLimitError } from "../../src/commands/worktree.commands.js";
import type { WorktreeEntry } from "../../src/models/worktree.js";

// Create mock WorktreeLimitError
function createMockWorktreeLimitError(
	repoPath: string,
	limit: number,
	existingEntries: WorktreeEntry[],
) {
	return {
		name: "WorktreeLimitError",
		message: `Worktree limit (${limit}) reached for ${repoPath}`,
		repoPath,
		limit,
		existingEntries,
	};
}

// Create mock WorktreeService
function createMockWorktreeService() {
	return {
		removeWorktree: vi.fn(),
		addWorktree: vi.fn(),
		getManifest: vi.fn(),
		reconcile: vi.fn(),
	};
}

describe("handleWorktreeLimitError", () => {
	const sampleEntries: WorktreeEntry[] = [
		{
			path: "/repo/.worktrees/agent-alpha",
			branch: "agent-alpha",
			agentName: "agent-alpha",
			repoPath: "/repo",
			createdAt: "2026-03-01T10:00:00.000Z",
		},
		{
			path: "/repo/.worktrees/agent-beta",
			branch: "agent-beta",
			agentName: "agent-beta",
			repoPath: "/repo",
			createdAt: "2026-03-02T14:30:00.000Z",
		},
		{
			path: "/repo/.worktrees/agent-gamma",
			branch: "agent-gamma",
			agentName: "agent-gamma",
			repoPath: "/repo",
			createdAt: "2026-03-03T09:15:00.000Z",
		},
	];

	let worktreeService: ReturnType<typeof createMockWorktreeService>;

	beforeEach(() => {
		worktreeService = createMockWorktreeService();
		vi.clearAllMocks();
	});

	it("shows QuickPick with items matching existingEntries", async () => {
		const error = createMockWorktreeLimitError("/repo", 3, sampleEntries);
		window.showQuickPick.mockResolvedValueOnce(undefined);

		await handleWorktreeLimitError(error as any, worktreeService as any);

		expect(window.showQuickPick).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					label: "agent-alpha",
					description: expect.stringContaining("2026-03-01"),
				}),
				expect.objectContaining({
					label: "agent-beta",
					description: expect.stringContaining("2026-03-02"),
				}),
				expect.objectContaining({
					label: "agent-gamma",
					description: expect.stringContaining("2026-03-03"),
				}),
			]),
			expect.objectContaining({
				title: expect.stringContaining("3"),
			}),
		);
	});

	it("calls removeWorktree and returns true when user picks an entry", async () => {
		const error = createMockWorktreeLimitError("/repo", 3, sampleEntries);
		window.showQuickPick.mockResolvedValueOnce({
			label: "agent-beta",
			description: "created 2026-03-02T14:30:00.000Z",
			detail: "/repo/.worktrees/agent-beta",
			_agentName: "agent-beta",
		});
		worktreeService.removeWorktree.mockResolvedValueOnce(undefined);

		const result = await handleWorktreeLimitError(error as any, worktreeService as any);

		expect(result).toBe(true);
		expect(worktreeService.removeWorktree).toHaveBeenCalledWith("/repo", "agent-beta");
	});

	it("returns false when user cancels (Escape)", async () => {
		const error = createMockWorktreeLimitError("/repo", 3, sampleEntries);
		window.showQuickPick.mockResolvedValueOnce(undefined);

		const result = await handleWorktreeLimitError(error as any, worktreeService as any);

		expect(result).toBe(false);
		expect(worktreeService.removeWorktree).not.toHaveBeenCalled();
	});

	it("shows info message after successful deletion", async () => {
		const error = createMockWorktreeLimitError("/repo", 3, sampleEntries);
		window.showQuickPick.mockResolvedValueOnce({
			label: "agent-alpha",
			description: "created 2026-03-01T10:00:00.000Z",
			detail: "/repo/.worktrees/agent-alpha",
			_agentName: "agent-alpha",
		});
		worktreeService.removeWorktree.mockResolvedValueOnce(undefined);

		await handleWorktreeLimitError(error as any, worktreeService as any);

		expect(window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("agent-alpha"),
		);
	});

	describe("with agentService (suspend option)", () => {
		function createMockAgentService() {
			return {
				getForRepo: vi.fn().mockReturnValue([]),
				suspendAgent: vi.fn().mockResolvedValue(undefined),
			};
		}

		it("offers suspend option when agentService provided and idle agents exist", async () => {
			const error = createMockWorktreeLimitError("/repo", 3, sampleEntries);
			const agentService = createMockAgentService();
			agentService.getForRepo.mockReturnValue([
				{ agentName: "oldest-idle", repoPath: "/repo", status: "finished", createdAt: "2026-01-01T00:00:00Z" },
				{ agentName: "running-one", repoPath: "/repo", status: "running", createdAt: "2026-02-01T00:00:00Z" },
			]);

			window.showWarningMessage.mockResolvedValueOnce("Suspend & Continue");

			const result = await handleWorktreeLimitError(error as any, worktreeService as any, agentService as any);

			expect(result).toBe(true);
			expect(agentService.suspendAgent).toHaveBeenCalledWith("/repo", "oldest-idle");
		});

		it("falls through to delete picker when user selects Delete a Worktree", async () => {
			const error = createMockWorktreeLimitError("/repo", 3, sampleEntries);
			const agentService = createMockAgentService();
			agentService.getForRepo.mockReturnValue([
				{ agentName: "idle-agent", repoPath: "/repo", status: "finished", createdAt: "2026-01-01T00:00:00Z" },
			]);

			window.showWarningMessage.mockResolvedValueOnce("Delete a Worktree");
			window.showQuickPick.mockResolvedValueOnce({
				label: "agent-alpha",
				description: "created 2026-03-01T10:00:00.000Z",
				detail: "/repo/.worktrees/agent-alpha",
				_agentName: "agent-alpha",
			});
			worktreeService.removeWorktree.mockResolvedValueOnce(undefined);

			const result = await handleWorktreeLimitError(error as any, worktreeService as any, agentService as any);

			expect(result).toBe(true);
			expect(window.showQuickPick).toHaveBeenCalled();
			expect(worktreeService.removeWorktree).toHaveBeenCalledWith("/repo", "agent-alpha");
		});

		it("works without agentService (backward compatible)", async () => {
			const error = createMockWorktreeLimitError("/repo", 3, sampleEntries);
			window.showQuickPick.mockResolvedValueOnce({
				label: "agent-beta",
				description: "created 2026-03-02T14:30:00.000Z",
				detail: "/repo/.worktrees/agent-beta",
				_agentName: "agent-beta",
			});
			worktreeService.removeWorktree.mockResolvedValueOnce(undefined);

			const result = await handleWorktreeLimitError(error as any, worktreeService as any);

			expect(result).toBe(true);
			expect(window.showQuickPick).toHaveBeenCalled();
		});
	});
});
