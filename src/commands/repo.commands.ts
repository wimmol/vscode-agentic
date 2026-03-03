import * as vscode from "vscode";
import type { RepoConfigService } from "../services/repo-config.service.js";

/**
 * Registers repository management commands.
 */
export function registerRepoCommands(
	context: vscode.ExtensionContext,
	repoConfigService: RepoConfigService,
): void {
	const addRepoDisposable = vscode.commands.registerCommand("vscode-agentic.addRepo", () =>
		repoConfigService.addRepo(),
	);

	context.subscriptions.push(addRepoDisposable);
}
