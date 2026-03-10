import * as vscode from "vscode";
import type { ReposStore } from "../services/repos-store";
import type { WorkspaceService } from "../services/workspace.service";

/**
 * Remove repo feature -- command registration, handler, and all business logic.
 *
 * Absorbs: repo.commands.ts removeRepo handler + RepoConfigService.removeRepo
 */
export const registerRemoveRepo = (
	context: vscode.ExtensionContext,
	reposStore: ReposStore,
	workspaceService: WorkspaceService,
): void => {
	const disposable = vscode.commands.registerCommand(
		"vscode-agentic.removeRepo",
		async (repoPath: string) => {
			console.log("[feature:removeRepo]", { repoPath });

			// Compute display name using basename helper (no node:path)
			const displayName = repoPath.split("/").pop() ?? repoPath;

			const confirmed = await vscode.window.showWarningMessage(
				`Remove repository '${displayName}'? Agents in this repo will not be deleted.`,
				{ modal: true },
				"Remove",
			);

			if (confirmed !== "Remove") {
				return;
			}

			// Remove from store
			const configs = reposStore.getAll().filter((c) => c.path !== repoPath);
			await reposStore.save(configs);

			// Sync workspace file
			await workspaceService.syncWorkspaceFile();

			console.log("[feature:removeRepo] repo removed", { repoPath });
			vscode.window.showInformationMessage(`Repository '${displayName}' removed.`);
		},
	);

	context.subscriptions.push(disposable);
};
