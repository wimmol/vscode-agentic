import * as vscode from "vscode";
import { registerRepoCommands } from "./commands/repo.commands.js";
import { GitService } from "./services/git.service.js";
import { RepoConfigService } from "./services/repo-config.service.js";
import { WorktreeService } from "./services/worktree.service.js";

export function activate(context: vscode.ExtensionContext): void {
	// 1. Create service singletons
	const gitService = new GitService();
	const worktreeService = new WorktreeService(gitService, context.workspaceState);
	const repoConfigService = new RepoConfigService(context.workspaceState, gitService);

	// 2. Register commands
	registerRepoCommands(context, repoConfigService);

	// 3. Git health check (warn if git not available, non-blocking)
	gitService.exec(".", ["--version"]).catch(() => {
		vscode.window.showErrorMessage(
			"VS Code Agentic: git is not installed or not in PATH. Worktree features are disabled.",
		);
	});

	// 4. Reconcile all known repos on activation (GIT-06, non-blocking)
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
}

export function deactivate(): void {
	// Future: cleanup if needed
}
