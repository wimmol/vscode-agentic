import * as vscode from "vscode";
import type { WorkspaceService } from "../services/workspace.service";

/**
 * Root global feature -- resets Explorer to show all configured repos.
 *
 * Absorbs: workspace.commands.ts rootGlobal handler
 */
export const registerRootGlobal = (
	context: vscode.ExtensionContext,
	workspaceService: WorkspaceService,
): void => {
	const disposable = vscode.commands.registerCommand(
		"vscode-agentic.rootGlobal",
		() => {
			console.log("[feature:rootGlobal]");
			workspaceService.resetExplorerScope();
		},
	);

	context.subscriptions.push(disposable);
};
