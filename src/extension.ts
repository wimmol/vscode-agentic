import * as vscode from "vscode";
import { registerAgentCommands } from "./commands/agent.commands.js";
import { registerRepoCommands } from "./commands/repo.commands.js";
import { AgentService } from "./services/agent.service.js";
import { GitService } from "./services/git.service.js";
import { RepoConfigService } from "./services/repo-config.service.js";
import { TerminalService } from "./services/terminal.service.js";
import { WorktreeService } from "./services/worktree.service.js";

export function activate(context: vscode.ExtensionContext): void {
	// 1. Create service singletons
	const gitService = new GitService();
	const worktreeService = new WorktreeService(gitService, context.workspaceState);
	const repoConfigService = new RepoConfigService(context.workspaceState, gitService);

	// AgentService and TerminalService have a circular dependency:
	// - TerminalService needs a status change callback that calls agentService.updateStatus
	// - AgentService needs TerminalService for focusAgent/deleteAgent
	// Resolved via setTerminalService() setter after both are constructed.
	const agentService = new AgentService(context.workspaceState, worktreeService);
	const terminalService = new TerminalService(
		(agentName, repoPath, status, exitCode) => {
			agentService.updateStatus(repoPath, agentName, status, exitCode);
		},
	);
	agentService.setTerminalService(terminalService);

	// 2. Register commands
	registerRepoCommands(context, repoConfigService);
	registerAgentCommands(context, agentService, terminalService, repoConfigService);

	// 3. Dispose terminal service on deactivation
	context.subscriptions.push({ dispose: () => terminalService.dispose() });

	// 4. Git health check (warn if git not available, non-blocking)
	gitService.exec(".", ["--version"]).catch(() => {
		vscode.window.showErrorMessage(
			"VS Code Agentic: git is not installed or not in PATH. Worktree features are disabled.",
		);
	});

	// 5. Reconcile all known repos on activation (GIT-06, non-blocking)
	const repos = repoConfigService.getAll();
	for (const repo of repos) {
		worktreeService
			.reconcile(repo.path)
			.then((result) => {
				const orphanCount = result.orphanedInManifest.length + result.orphanedOnDisk.length;
				if (orphanCount > 0) {
					vscode.window.showInformationMessage(
						`Agentic: Cleaned up ${orphanCount} orphaned worktree(s) in ${repo.path}`,
					);
				}
			})
			.catch((err: Error) => {
				vscode.window.showErrorMessage(
					`Agentic: Worktree reconciliation failed for ${repo.path}: ${err.message}`,
				);
			});
	}

	// 6. Reconcile agent state on activation (reset "running" to "created")
	agentService.reconcileOnActivation().catch((err: Error) => {
		vscode.window.showErrorMessage(
			`Agentic: Agent reconciliation failed: ${err.message}`,
		);
	});
}

export function deactivate(): void {
	// Cleanup handled via context.subscriptions
}
