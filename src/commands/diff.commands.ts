import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { GitContentProvider } from "../providers/git-content.provider.js";
import type { AgentService } from "../services/agent.service.js";
import type { DiffService } from "../services/diff.service.js";
import type { RepoConfigService } from "../services/repo-config.service.js";

const execFileAsync = promisify(execFile);

interface FilePickItem extends vscode.QuickPickItem {
	_filePath: string;
}

/**
 * Registers diff-related commands: reviewChanges and createPR.
 */
export function registerDiffCommands(
	context: vscode.ExtensionContext,
	diffService: DiffService,
	repoConfigService: RepoConfigService,
	_agentService: AgentService,
): void {
	// --- Review Changes ---
	const reviewDisposable = vscode.commands.registerCommand(
		"vscode-agentic.reviewChanges",
		async (repoPath: string, agentName: string) => {
			const config = repoConfigService.getForRepo(repoPath);
			const staging = config?.stagingBranch ?? "staging";

			const changedFiles = await diffService.getChangedFiles(repoPath, agentName);

			if (changedFiles.length === 0) {
				vscode.window.showInformationMessage(`No changes between ${agentName} and ${staging}.`);
				return;
			}

			const items: FilePickItem[] = changedFiles.map((filePath) => {
				const filename = filePath.split("/").pop() || filePath;
				return {
					label: filename,
					description: filePath,
					_filePath: filePath,
				};
			});

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: `${changedFiles.length} file(s) changed vs ${staging}`,
				title: `Changes: ${agentName} vs ${staging}`,
			});

			if (!selected) {
				return;
			}

			const filename = selected._filePath.split("/").pop() || selected._filePath;
			const leftUri = GitContentProvider.buildUri(repoPath, staging, selected._filePath);
			const rightUri = GitContentProvider.buildUri(repoPath, agentName, selected._filePath);

			await vscode.commands.executeCommand(
				"vscode.diff",
				leftUri,
				rightUri,
				`${filename} (${staging} <-> ${agentName})`,
			);
		},
	);

	// --- Create PR ---
	const createPRDisposable = vscode.commands.registerCommand(
		"vscode-agentic.createPR",
		async (repoPath: string, agentName: string) => {
			const config = repoConfigService.getForRepo(repoPath);
			const staging = config?.stagingBranch ?? "staging";

			const changedFiles = await diffService.getChangedFiles(repoPath, agentName);

			const confirmed = await vscode.window.showInformationMessage(
				`Create PR: ${agentName} -> ${staging} (${changedFiles.length} changed files)?`,
				"Create PR",
				"Cancel",
			);

			if (confirmed !== "Create PR") {
				return;
			}

			try {
				const { stdout } = await execFileAsync(
					"gh",
					[
						"pr",
						"create",
						"--base",
						staging,
						"--head",
						agentName,
						"--title",
						`Agent: ${agentName}`,
						"--body",
						`Changes from agent ${agentName}`,
					],
					{ cwd: repoPath, timeout: 30_000 },
				);

				vscode.window.showInformationMessage(`PR created: ${stdout.trim()}`);
			} catch (err: unknown) {
				const error = err as { code?: string; stderr?: string; message?: string };

				if (error.code === "ENOENT") {
					vscode.window.showErrorMessage(
						"GitHub CLI (gh) is not installed. Install from https://cli.github.com/",
					);
				} else {
					vscode.window.showErrorMessage(`Failed to create PR: ${error.stderr || error.message}`);
				}
			}
		},
	);

	context.subscriptions.push(reviewDisposable, createPRDisposable);
}
