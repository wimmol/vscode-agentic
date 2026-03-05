import * as vscode from "vscode";
import type { WorktreeLimitError, WorktreeService } from "../services/worktree.service";

interface WorktreePickItem extends vscode.QuickPickItem {
	agentName: string;
}

/**
 * Handles a WorktreeLimitError by showing a QuickPick of existing worktrees
 * and offering to delete one to make room.
 *
 * Returns true if a worktree was deleted (caller can retry addWorktree),
 * false if user cancelled.
 *
 * NOTE: In Phase 1, agent status is not yet available, so all entries are
 * listed without status filtering. Phase 2 will enhance this to show
 * status indicators (running/idle/finished) on each QuickPick item.
 */
export async function handleWorktreeLimitError(
	error: WorktreeLimitError,
	worktreeService: WorktreeService,
): Promise<boolean> {
	const items: WorktreePickItem[] = error.existingEntries.map((entry) => ({
		label: entry.agentName,
		description: `created ${entry.createdAt}`,
		detail: entry.path,
		agentName: entry.agentName,
	}));

	const selected = await vscode.window.showQuickPick(items, {
		title: `Worktree limit reached (${error.limit}). Select an agent to delete:`,
		placeHolder: "Choose an agent worktree to remove, or press Escape to cancel",
	});

	if (!selected) {
		return false;
	}

	await worktreeService.removeWorktree(error.repoPath, selected.agentName);

	vscode.window.showInformationMessage(
		`Deleted agent '${selected.agentName}'. You can now create a new agent.`,
	);

	return true;
}
