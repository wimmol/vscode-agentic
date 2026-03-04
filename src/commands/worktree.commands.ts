import * as vscode from "vscode";
import type { WorktreeLimitError, WorktreeService } from "../services/worktree.service.js";
import type { AgentService } from "../services/agent.service.js";

interface WorktreePickItem extends vscode.QuickPickItem {
	_agentName: string;
}

/**
 * Handles a WorktreeLimitError by showing an interactive QuickPick
 * of existing worktrees for the user to delete one.
 *
 * Returns true if a worktree was deleted (caller can retry addWorktree),
 * false if the user cancelled.
 *
 * NOTE: In Phase 1, agent status is not yet available, so all entries
 * are listed without status filtering. Phase 2 will enhance this to
 * show status indicators (running/idle/finished) on each QuickPick item.
 */
export async function handleWorktreeLimitError(
	error: WorktreeLimitError,
	worktreeService: WorktreeService,
	agentService?: AgentService,
): Promise<boolean> {
	// Offer suspend option when agentService is available and idle agents exist
	if (agentService) {
		const repoAgents = agentService.getForRepo(error.repoPath);
		const idleAgents = repoAgents
			.filter((a) => a.status !== "running" && a.status !== "suspended")
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

		if (idleAgents.length > 0) {
			const oldest = idleAgents[0];
			const choice = await vscode.window.showWarningMessage(
				`Worktree limit (${error.limit}) reached. Suspend idle agent '${oldest.agentName}' to free a slot?`,
				"Suspend & Continue",
				"Delete a Worktree",
				"Cancel",
			);

			if (choice === "Suspend & Continue") {
				await agentService.suspendAgent(oldest.repoPath, oldest.agentName);
				return true;
			}
			if (choice === "Cancel" || !choice) {
				return false;
			}
			// "Delete a Worktree" falls through to existing picker below
		}
	}

	const items: WorktreePickItem[] = error.existingEntries.map((entry) => ({
		label: entry.agentName,
		description: `created ${entry.createdAt}`,
		detail: entry.path,
		_agentName: entry.agentName,
	}));

	const selected = await vscode.window.showQuickPick(items, {
		title: `Worktree limit reached (${error.limit}). Select an agent to delete:`,
		placeHolder: "Choose an agent worktree to remove, or press Escape to cancel",
	});

	if (!selected) {
		return false;
	}

	await worktreeService.removeWorktree(error.repoPath, selected._agentName);

	vscode.window.showInformationMessage(
		`Deleted agent '${selected._agentName}'. You can now create a new agent.`,
	);

	return true;
}
