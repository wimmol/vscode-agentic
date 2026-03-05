import * as vscode from "vscode";
import { registerAgentCommands } from "./commands/agent.commands";
import { registerRepoCommands } from "./commands/repo.commands";
import { AgentService } from "./services/agent.service";
import { GitService } from "./services/git.service";
import { RepoConfigService } from "./services/repo-config.service";
import { TerminalService } from "./services/terminal.service";
import { WorktreeService } from "./services/worktree.service";

export function activate(context: vscode.ExtensionContext): void {
	// 1. Create service singletons (not at module level -- research anti-pattern warning)
	const gitService = new GitService();
	const worktreeService = new WorktreeService(gitService, context.workspaceState);
	const repoConfigService = new RepoConfigService(context.workspaceState, gitService);

	// 2. Create AgentService and TerminalService with status callback
	const agentService = new AgentService(context.workspaceState, worktreeService);
	const terminalService = new TerminalService((agentName, repoPath, status, exitCode) => {
		agentService.updateStatus(repoPath, agentName, status, exitCode);
	});
	agentService.setTerminalService(terminalService);

	// 3. Register commands
	registerRepoCommands(context, repoConfigService);
	registerAgentCommands(context, agentService, terminalService, repoConfigService);

	// 4. Dispose terminal listeners on deactivation
	context.subscriptions.push({ dispose: () => terminalService.dispose() });

	// 5. Git health check (non-blocking -- extension still activates, just warns)
	gitService.exec(".", ["--version"]).catch(() => {
		vscode.window.showErrorMessage(
			"VS Code Agentic: git is not installed or not in PATH. Worktree features are disabled.",
		);
	});

	// 6. Reconcile all known repos on activation (GIT-06, non-blocking)
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

	// 7. Reconcile agent statuses on activation (terminals lost on restart)
	agentService.reconcileOnActivation().catch((err: Error) => {
		vscode.window.showErrorMessage(
			`Agentic: Agent reconciliation failed: ${err.message}`,
		);
	});
}

export function deactivate(): void {
	// Cleanup handled by context.subscriptions
}
