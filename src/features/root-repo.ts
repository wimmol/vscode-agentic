import * as vscode from "vscode";
import type { WorkspaceService } from "../services/workspace.service";

/**
 * Root repo feature -- sets Explorer scope to a single repo root.
 *
 * Absorbs: workspace.commands.ts rootRepo handler
 */
export function registerRootRepo(
	context: vscode.ExtensionContext,
	workspaceService: WorkspaceService,
): void {
	const disposable = vscode.commands.registerCommand(
		"vscode-agentic.rootRepo",
		(repoPath: string) => {
			console.log("[feature:rootRepo]", { repoPath });
			workspaceService.setExplorerScope(repoPath);
		},
	);

	context.subscriptions.push(disposable);
}
