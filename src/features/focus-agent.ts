import * as vscode from "vscode";
import type { AgentStatus } from "../models/agent";
import { WORKTREE_MANIFEST_KEY, type WorktreeEntry } from "../models/worktree";
import type { AgentsStore } from "../services/agents-store";
import type { WorkspaceService } from "../services/workspace.service";
import { createTerminal, showTerminal } from "../utils/terminal";

/**
 * Focus agent feature -- command registration, handler, and all business logic.
 *
 * Absorbs: agent.commands.ts focusAgent handler + AgentService.focusAgent logic
 */
export const registerFocusAgent = (
	context: vscode.ExtensionContext,
	agentsStore: AgentsStore,
	workspaceService: WorkspaceService,
): void => {
	const disposable = vscode.commands.registerCommand(
		"vscode-agentic.focusAgent",
		async (repoPath: string, agentName: string) => {
			console.log("[feature:focusAgent]", { repoPath, agentName });

			const agents = agentsStore.getAll();
			const agent = agents.find(
				(e) => e.repoPath === repoPath && e.agentName === agentName,
			);

			if (!agent) {
				console.log("[feature:focusAgent] agent not found, returning");
				return;
			}

			if (agent.status === "running") {
				console.log("[feature:focusAgent] already running, showing terminal");
				showTerminal(repoPath, agentName);
				// Set Explorer scope to worktree
				const globalState = context.globalState;
				const manifest = globalState
					.get<WorktreeEntry[]>(WORKTREE_MANIFEST_KEY, [])
					.filter((e) => e.repoPath === repoPath);
				const worktreeEntry = manifest.find((w) => w.agentName === agentName);
				if (worktreeEntry) {
					workspaceService.setExplorerScope(worktreeEntry.path, agentName);
				}
				return;
			}

			// Status is "created", "finished", or "error" -- create a new terminal
			console.log("[feature:focusAgent] status=%s, creating terminal", agent.status);
			const globalState = context.globalState;
			const manifest = globalState
				.get<WorktreeEntry[]>(WORKTREE_MANIFEST_KEY, [])
				.filter((e) => e.repoPath === repoPath);
			const worktreeEntry = manifest.find((w) => w.agentName === agentName);

			if (!worktreeEntry) {
				console.log("[feature:focusAgent] worktree entry not found");
				return;
			}

			const terminal = createTerminal(repoPath, agentName, worktreeEntry.path, agent.initialPrompt);
			terminal.show();

			// Update status to "running"
			agent.status = "running" as AgentStatus;
			agent.finishedAt = undefined;
			agent.exitCode = undefined;
			await agentsStore.save(agents);

			// Set Explorer scope to worktree
			workspaceService.setExplorerScope(worktreeEntry.path, agentName);

			console.log("[feature:focusAgent] agent focused", { agentName });
		},
	);

	context.subscriptions.push(disposable);
};
