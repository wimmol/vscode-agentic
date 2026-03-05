import * as vscode from "vscode";
import type { RepoConfigService } from "../services/repo-config.service";

/**
 * Registers repository-related commands.
 */
export function registerRepoCommands(
	context: vscode.ExtensionContext,
	repoConfigService: RepoConfigService,
): void {
	const addRepo = vscode.commands.registerCommand("vscode-agentic.addRepo", () =>
		repoConfigService.addRepo(),
	);

	context.subscriptions.push(addRepo);
}
