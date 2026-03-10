import * as vscode from "vscode";
import { WORKTREE_MANIFEST_KEY, type WorktreeEntry } from "../models/worktree";
import type { AgentsStore } from "../services/agents-store";
import type { GitService } from "../services/git.service";
import { disposeTerminal } from "../utils/terminal";

/**
 * Delete agent feature -- command registration, handler, and all business logic.
 *
 * Absorbs: agent.commands.ts deleteAgent handler + AgentService.deleteAgent + WorktreeService.removeWorktree
 */
export const registerDeleteAgent = (
	context: vscode.ExtensionContext,
	agentsStore: AgentsStore,
	gitService: GitService,
): void => {
	const disposable = vscode.commands.registerCommand(
		"vscode-agentic.deleteAgent",
		async (repoPath: string, agentName: string) => {
			console.log("[feature:deleteAgent]", { repoPath, agentName });

			const agents = agentsStore.getAll();
			const agent = agents.find(
				(e) => e.repoPath === repoPath && e.agentName === agentName,
			);

			if (!agent) {
				console.log("[feature:deleteAgent] agent not found, returning");
				return;
			}

			const isRunning = agent.status === "running";
			const message = isRunning
				? `Agent '${agentName}' is still running. Delete anyway? This removes the worktree and branch.`
				: `Delete agent '${agentName}'? This removes the worktree and branch.`;

			const confirmed = await vscode.window.showWarningMessage(
				message,
				{ modal: true },
				"Delete",
			);

			if (confirmed !== "Delete") {
				return;
			}

			// Dispose terminal (if running)
			disposeTerminal(repoPath, agentName);

			// Remove worktree from disk
			const globalState = context.globalState;
			const allManifest = globalState.get<WorktreeEntry[]>(WORKTREE_MANIFEST_KEY, []);
			const worktreeEntry = allManifest.find(
				(e) => e.agentName === agentName && e.repoPath === repoPath,
			);

			if (worktreeEntry) {
				try {
					await gitService.exec(repoPath, ["worktree", "remove", "--force", worktreeEntry.path]);
				} catch {
					// Worktree may already be gone -- that's fine
				}

				try {
					await gitService.exec(repoPath, ["branch", "-D", worktreeEntry.branch]);
				} catch {
					// Branch may already be gone -- that's fine
				}

				// Remove from manifest
				const updatedManifest = allManifest.filter(
					(e) => !(e.agentName === agentName && e.repoPath === repoPath),
				);
				await globalState.update(WORKTREE_MANIFEST_KEY, updatedManifest);
			}

			// Remove from agent registry
			const updatedAgents = agents.filter(
				(e) => !(e.repoPath === repoPath && e.agentName === agentName),
			);
			await agentsStore.save(updatedAgents);

			console.log("[feature:deleteAgent] agent deleted", { agentName });
			vscode.window.showInformationMessage(`Agent '${agentName}' deleted.`);
		},
	);

	context.subscriptions.push(disposable);
};
