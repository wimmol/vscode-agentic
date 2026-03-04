import * as vscode from "vscode";
import type { AgentService } from "./agent.service.js";
import type { TerminalService } from "./terminal.service.js";
import type { WorktreeService } from "./worktree.service.js";

/**
 * Handles workspace context switching when an agent tile is clicked.
 *
 * Same-repo switch: only focuses the agent terminal (via AgentService.focusAgent).
 * Cross-repo switch: adds worktree folder to workspace, reveals in explorer,
 * opens a file in editor (best-effort README.md), and shows the agent terminal.
 *
 * Tracks the currently active agent for highlighting in the sidebar TreeView.
 */
export class WorkspaceSwitchService {
	private activeAgent: { repoPath: string; agentName: string } | undefined;

	constructor(
		private readonly agentService: AgentService,
		private readonly _terminalService: TerminalService,
		private readonly worktreeService: WorktreeService,
	) {}

	/**
	 * Returns the currently active (focused) agent, or undefined if none.
	 */
	getActiveAgent(): { repoPath: string; agentName: string } | undefined {
		return this.activeAgent;
	}

	/**
	 * Switches workspace focus to the given agent.
	 *
	 * - Always calls agentService.focusAgent (handles terminal show/create).
	 * - If cross-repo (different repoPath from current active):
	 *   1. Adds the worktree folder to the VS Code workspace (if not already present)
	 *   2. Focuses the file explorer on the worktree
	 *   3. Opens README.md from the worktree in a preview editor tab (best-effort)
	 * - Updates the active agent tracker.
	 */
	async switchToAgent(repoPath: string, agentName: string): Promise<void> {
		const isSameRepo = this.activeAgent?.repoPath === repoPath;

		// Always focus the agent terminal
		await this.agentService.focusAgent(repoPath, agentName);

		// Cross-repo switch: add workspace folder, reveal in explorer, open editor file
		if (!isSameRepo) {
			const manifest = this.worktreeService.getManifest(repoPath);
			const worktreeEntry = manifest.find((w) => w.agentName === agentName);

			if (worktreeEntry) {
				const worktreePath = worktreeEntry.path;
				const worktreeUri = vscode.Uri.file(worktreePath);

				// Add worktree folder to workspace if not already present
				const folders = vscode.workspace.workspaceFolders ?? [];
				const alreadyInWorkspace = folders.some((f) => f.uri.fsPath === worktreePath);
				if (!alreadyInWorkspace) {
					vscode.workspace.updateWorkspaceFolders(folders.length, 0, {
						uri: worktreeUri,
					});
				}

				// Focus file explorer on the worktree
				await vscode.commands.executeCommand("workbench.view.explorer");
				await vscode.commands.executeCommand("revealInExplorer", worktreeUri);

				// Open a file from the worktree in the editor (best-effort README.md)
				const readmePath = vscode.Uri.joinPath(vscode.Uri.file(worktreePath), "README.md");
				try {
					const doc = await vscode.workspace.openTextDocument(readmePath);
					await vscode.window.showTextDocument(doc, {
						preview: true,
						preserveFocus: true,
					});
				} catch {
					// README.md doesn't exist -- acceptable fallback. The workspace folder addition
					// already provides editor context through the workspace root change.
					// We intentionally don't search for alternative files to avoid unpredictable behavior.
				}
			}
		}

		// Update active agent tracker
		this.activeAgent = { repoPath, agentName };
	}
}
