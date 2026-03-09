import * as vscode from "vscode";
import type { AgentStatus } from "../models/agent";
import type { AgentsStore } from "../services/agents-store";
import { disposeTerminal } from "../utils/terminal";

/**
 * Stop agent feature -- command registration, handler, and all business logic.
 *
 * Absorbs: agent.commands.ts stopAgent handler + AgentService.updateStatus
 */
export function registerStopAgent(
	context: vscode.ExtensionContext,
	agentsStore: AgentsStore,
): void {
	const disposable = vscode.commands.registerCommand(
		"vscode-agentic.stopAgent",
		async (repoPath: string, agentName: string) => {
			console.log("[feature:stopAgent]", { repoPath, agentName });

			const agents = agentsStore.getAll();
			const agent = agents.find(
				(e) => e.repoPath === repoPath && e.agentName === agentName,
			);

			if (!agent || agent.status !== "running") {
				console.log("[feature:stopAgent] agent not running, no-op");
				return;
			}

			// Dispose the terminal
			disposeTerminal(repoPath, agentName);

			// Update status to "finished"
			agent.status = "finished" as AgentStatus;
			agent.finishedAt = new Date().toISOString();
			await agentsStore.save(agents);

			console.log("[feature:stopAgent] agent stopped", { agentName });
		},
	);

	context.subscriptions.push(disposable);
}
