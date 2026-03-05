import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleWorktreeLimitError } from "../../src/commands/worktree.commands";
import type { WorktreeEntry } from "../../src/models/worktree";
import type { WorktreeService } from "../../src/services/worktree.service";
import { WorktreeLimitError } from "../../src/services/worktree.service";
import { window } from "../__mocks__/vscode";

function createMockWorktreeService(): WorktreeService {
	return {
		addWorktree: vi.fn(),
		removeWorktree: vi
			.fn<(repoPath: string, agentName: string) => Promise<void>>()
			.mockResolvedValue(undefined),
		getManifest: vi.fn(),
		reconcile: vi.fn(),
	} as unknown as WorktreeService;
}

const sampleEntries: WorktreeEntry[] = [
	{
		path: "/repo/.worktrees/agent-alpha",
		branch: "agent-alpha",
		agentName: "agent-alpha",
		repoPath: "/repo",
		createdAt: "2026-03-01T10:00:00Z",
	},
	{
		path: "/repo/.worktrees/agent-beta",
		branch: "agent-beta",
		agentName: "agent-beta",
		repoPath: "/repo",
		createdAt: "2026-03-02T14:30:00Z",
	},
	{
		path: "/repo/.worktrees/agent-gamma",
		branch: "agent-gamma",
		agentName: "agent-gamma",
		repoPath: "/repo",
		createdAt: "2026-03-03T09:15:00Z",
	},
];

describe("handleWorktreeLimitError", () => {
	let worktreeService: WorktreeService;
	let error: WorktreeLimitError;

	beforeEach(() => {
		vi.clearAllMocks();
		worktreeService = createMockWorktreeService();
		error = new WorktreeLimitError("/repo", 3, sampleEntries);
	});

	it("shows QuickPick with items matching existingEntries", async () => {
		window.showQuickPick.mockResolvedValueOnce(undefined);

		await handleWorktreeLimitError(error, worktreeService);

		expect(window.showQuickPick).toHaveBeenCalledOnce();
		const items = window.showQuickPick.mock.calls[0][0];
		expect(items).toHaveLength(3);
		expect(items[0].label).toBe("agent-alpha");
		expect(items[0].description).toContain("2026-03-01");
		expect(items[0].detail).toBe("/repo/.worktrees/agent-alpha");
		expect(items[1].label).toBe("agent-beta");
		expect(items[2].label).toBe("agent-gamma");
	});

	it("calls removeWorktree and returns true when user selects an entry", async () => {
		window.showQuickPick.mockResolvedValueOnce({
			label: "agent-beta",
			description: "created 2026-03-02T14:30:00Z",
			detail: "/repo/.worktrees/agent-beta",
			agentName: "agent-beta",
		});

		const result = await handleWorktreeLimitError(error, worktreeService);

		expect(worktreeService.removeWorktree).toHaveBeenCalledWith("/repo", "agent-beta");
		expect(result).toBe(true);
	});

	it("returns false when user cancels (showQuickPick returns undefined)", async () => {
		window.showQuickPick.mockResolvedValueOnce(undefined);

		const result = await handleWorktreeLimitError(error, worktreeService);

		expect(worktreeService.removeWorktree).not.toHaveBeenCalled();
		expect(result).toBe(false);
	});

	it("shows info message after successful deletion containing agent name", async () => {
		window.showQuickPick.mockResolvedValueOnce({
			label: "agent-alpha",
			description: "created 2026-03-01T10:00:00Z",
			detail: "/repo/.worktrees/agent-alpha",
			agentName: "agent-alpha",
		});

		await handleWorktreeLimitError(error, worktreeService);

		expect(window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("agent-alpha"),
		);
	});
});
