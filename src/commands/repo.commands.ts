import * as vscode from "vscode";
import type { RepoConfigService } from "../services/repo-config.service";
import type { WorkspaceService } from "../services/workspace.service";
import * as path from "node:path";

/**
 * Registers repository-related commands: addRepo, removeRepo.
 */
export function registerRepoCommands(
	context: vscode.ExtensionContext,
	repoConfigService: RepoConfigService,
	workspaceService: WorkspaceService,
): void {
	const addRepo = vscode.commands.registerCommand("vscode-agentic.addRepo", async () => {
		console.log("[cmd:addRepo]");
		const result = await repoConfigService.addRepo();
		if (result) {
			await workspaceService.syncWorkspaceFile();
		}
	});

	const removeRepo = vscode.commands.registerCommand(
		"vscode-agentic.removeRepo",
		async (repoPath: string) => {
			console.log("[cmd:removeRepo]", { repoPath });
			const displayName = path.basename(repoPath);

			const confirmed = await vscode.window.showWarningMessage(
				`Remove repository '${displayName}'? Agents in this repo will not be deleted.`,
				{ modal: true },
				"Remove",
			);

			if (confirmed !== "Remove") {
				return;
			}

			await repoConfigService.removeRepo(repoPath);
			await workspaceService.syncWorkspaceFile();
			vscode.window.showInformationMessage(`Repository '${displayName}' removed.`);
		},
	);

	context.subscriptions.push(addRepo, removeRepo);
}
