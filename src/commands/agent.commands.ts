import * as vscode from "vscode";
import { isValidBranchName } from "../utils/branch-validation";
import type { AgentService } from "../services/agent.service";
import type { TerminalService } from "../services/terminal.service";
import type { RepoConfigService } from "../services/repo-config.service";
import type { WorkspaceService } from "../services/workspace.service";
import type { WorktreeService } from "../services/worktree.service";

/**
 * Registers agent lifecycle commands: createAgent, deleteAgent, focusAgent, stopAgent.
 *
 * All commands receive their arguments from sidebar UI (inline buttons, context menus, tree item clicks).
 * Commands are hidden from the Command Palette via package.json menus.commandPalette.
 */
export function registerAgentCommands(
	context: vscode.ExtensionContext,
	agentService: AgentService,
	terminalService: TerminalService,
	repoConfigService: RepoConfigService,
	worktreeService: WorktreeService,
	workspaceService: WorkspaceService,
): void {
	const createAgent = vscode.commands.registerCommand(
		"vscode-agentic.createAgent",
		async (repoPath?: string) => {
			console.log("[cmd:createAgent]", { repoPath });
			// Fall back to first configured repo if not passed from sidebar
			if (!repoPath) {
				const repos = repoConfigService.getAll();
				if (repos.length === 0) {
					vscode.window.showErrorMessage("No repositories configured. Add a repository first.");
					return;
				}
				repoPath = repos[0].path;
			}

			// Loop for name input (handles collision retry)
			let agentName: string | undefined;
			while (true) {
				agentName = await vscode.window.showInputBox({
					title: "Agent Name",
					prompt: "Enter a name for the agent (used as git branch name)",
					validateInput(value: string): string | undefined {
						if (!value) {
							return "Agent name is required";
						}
						if (!isValidBranchName(value)) {
							return "Invalid branch name. Avoid spaces, ~, ^, :, ?, *, [, \\, .., and other git-reserved patterns.";
						}
						return undefined;
					},
				});

				if (agentName === undefined) {
					return; // User cancelled
				}

				// Check for name collision
				const existing = agentService.getAgent(repoPath, agentName);
				if (existing) {
					const choice = await vscode.window.showQuickPick(
						[
							{ label: `Reuse existing agent '${agentName}'` },
							{ label: "Pick a different name" },
						],
						{
							placeHolder: `Agent '${agentName}' already exists`,
							title: "Agent name collision",
						},
					);

					if (!choice) {
						return; // User cancelled
					}

					if (choice.label.startsWith("Reuse")) {
						await agentService.focusAgent(repoPath, agentName);
						return;
					}
					// "Pick a different name" -- loop back to InputBox
					continue;
				}

				// Name is unique, break out of loop
				break;
			}

			// Prompt for optional initial task description
			const initialPrompt = await vscode.window.showInputBox({
				title: "Initial Prompt (optional)",
				prompt: "Enter an initial prompt for Claude Code, or leave empty for interactive mode",
				placeHolder: "e.g., Refactor the auth module to use JWT tokens",
			});

			if (initialPrompt === undefined) {
				return; // User cancelled
			}

			await agentService.createAgent(repoPath, agentName, initialPrompt || undefined);
			vscode.window.showInformationMessage(
				`Agent '${agentName}' created. Focus it to start Claude Code.`,
			);
		},
	);

	const deleteAgent = vscode.commands.registerCommand(
		"vscode-agentic.deleteAgent",
		async (repoPath: string, agentName: string) => {
			console.log("[cmd:deleteAgent]", { repoPath, agentName });
			const agent = agentService.getAgent(repoPath, agentName);
			const isRunning = agent?.status === "running";

			const message = isRunning
				? `Agent '${agentName}' is still running. Delete anyway? This removes the worktree and branch.`
				: `Delete agent '${agentName}'? This removes the worktree and branch.`;

			const confirmed = await vscode.window.showWarningMessage(
				message,
				{ modal: true },
				"Delete",
			);

			if (confirmed !== "Delete") {
				return;
			}

			await agentService.deleteAgent(repoPath, agentName);
			vscode.window.showInformationMessage(`Agent '${agentName}' deleted.`);
		},
	);

	const focusAgent = vscode.commands.registerCommand(
		"vscode-agentic.focusAgent",
		async (repoPath: string, agentName: string) => {
			console.log("[cmd:focusAgent]", { repoPath, agentName });
			await agentService.focusAgent(repoPath, agentName);

			const manifest = worktreeService.getManifest(repoPath);
			const worktreeEntry = manifest.find((w) => w.agentName === agentName);
			if (worktreeEntry) {
				workspaceService.setExplorerScope(worktreeEntry.path, agentName);
			}
		},
	);

	const stopAgent = vscode.commands.registerCommand(
		"vscode-agentic.stopAgent",
		async (repoPath: string, agentName: string) => {
			console.log("[cmd:stopAgent]", { repoPath, agentName });
			const agent = agentService.getAgent(repoPath, agentName);
			if (!agent || agent.status !== "running") {
				return;
			}

			terminalService.disposeTerminal(repoPath, agentName);
			await agentService.updateStatus(repoPath, agentName, "finished");
		},
	);

	context.subscriptions.push(createAgent, deleteAgent, focusAgent, stopAgent);
}
