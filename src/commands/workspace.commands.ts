import * as vscode from "vscode";
import type { WorkspaceService } from "../services/workspace.service";

/**
 * Registers workspace scope commands: rootGlobal, rootRepo.
 *
 * rootGlobal -- shows all configured repos in the Explorer.
 * rootRepo -- shows a single repo root in the Explorer.
 *
 * Both commands receive their arguments from sidebar UI.
 * Commands are hidden from the Command Palette via package.json menus.commandPalette.
 */
export function registerWorkspaceCommands(
	context: vscode.ExtensionContext,
	workspaceService: WorkspaceService,
): void {
	const rootGlobal = vscode.commands.registerCommand("vscode-agentic.rootGlobal", () => {
		workspaceService.setExplorerScope("global");
	});

	const rootRepo = vscode.commands.registerCommand(
		"vscode-agentic.rootRepo",
		(repoPath: string) => {
			workspaceService.setExplorerScope({ repo: repoPath });
		},
	);

	context.subscriptions.push(rootGlobal, rootRepo);
}
