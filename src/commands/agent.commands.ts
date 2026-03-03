import * as vscode from "vscode";
import { isValidBranchName } from "../utils/branch-validation.js";
import type { AgentService } from "../services/agent.service.js";
import type { TerminalService } from "../services/terminal.service.js";
import type { RepoConfigService } from "../services/repo-config.service.js";

interface AgentPickItem extends vscode.QuickPickItem {
	_repoPath: string;
	_agentName: string;
	_status?: string;
}

interface RepoPickItem extends vscode.QuickPickItem {
	_repoPath: string;
}

/**
 * Registers agent lifecycle commands: createAgent, deleteAgent, focusAgent.
 */
export function registerAgentCommands(
	context: vscode.ExtensionContext,
	agentService: AgentService,
	_terminalService: TerminalService,
	repoConfigService: RepoConfigService,
): void {
	// --- Create Agent ---
	const createDisposable = vscode.commands.registerCommand(
		"vscode-agentic.createAgent",
		async (preSelectedRepoPath?: string) => {
			// 1. Pick repo (skip if pre-selected from sidebar inline button)
			const repos = repoConfigService.getAll();
			if (repos.length === 0) {
				vscode.window.showErrorMessage(
					"No repositories configured. Run 'Add Repository' first.",
				);
				return;
			}

			let repoPath: string;
			const matchedPreSelected =
				preSelectedRepoPath &&
				repos.find((r) => r.path === preSelectedRepoPath);
			if (matchedPreSelected) {
				repoPath = matchedPreSelected.path;
			} else if (repos.length === 1) {
				repoPath = repos[0].path;
			} else {
				const repoItems: RepoPickItem[] = repos.map((r) => ({
					label: r.path,
					description: `staging: ${r.stagingBranch}`,
					_repoPath: r.path,
				}));
				const selected = await vscode.window.showQuickPick(repoItems, {
					placeHolder: "Select a repository",
					title: "Create Agent",
				});
				if (!selected) {
					return;
				}
				repoPath = selected._repoPath;
			}

			// 2. Get agent name (with collision handling loop)
			let agentName = await promptForAgentName(agentService, repoPath);
			if (agentName === undefined) {
				return;
			}
			// agentName === null means user chose reuse (already handled inside promptForAgentName)
			if (agentName === null) {
				return;
			}

			// 3. Get optional initial prompt
			const promptInput = await vscode.window.showInputBox({
				title: "Initial Prompt (optional)",
				placeHolder: "e.g., Refactor the auth module to use JWT tokens",
				prompt: "Enter an initial prompt for Claude Code, or leave empty",
			});
			if (promptInput === undefined) {
				return;
			}

			// 4. Create agent
			const initialPrompt = promptInput || undefined;
			await agentService.createAgent(repoPath, agentName, initialPrompt);

			vscode.window.showInformationMessage(
				`Agent '${agentName}' created. Focus it to start Claude Code.`,
			);
		},
	);

	// --- Delete Agent ---
	const deleteDisposable = vscode.commands.registerCommand(
		"vscode-agentic.deleteAgent",
		async () => {
			const agents = agentService.getAll();
			if (agents.length === 0) {
				vscode.window.showInformationMessage("No agents to delete.");
				return;
			}

			const items: AgentPickItem[] = agents.map((a) => ({
				label: a.agentName,
				description: `${a.status} - ${a.repoPath}`,
				_repoPath: a.repoPath,
				_agentName: a.agentName,
				_status: a.status,
			}));

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: "Select an agent to delete",
				title: "Delete Agent",
			});
			if (!selected) {
				return;
			}

			// Confirmation dialog
			const warningText =
				selected._status === "running"
					? `Agent '${selected._agentName}' is still running. Delete anyway? This removes the worktree and branch.`
					: `Delete agent '${selected._agentName}'? This removes the worktree and branch.`;

			const confirmed = await vscode.window.showWarningMessage(
				warningText,
				{ modal: true },
				"Delete",
			);
			if (confirmed !== "Delete") {
				return;
			}

			await agentService.deleteAgent(selected._repoPath, selected._agentName);
			vscode.window.showInformationMessage(`Agent '${selected._agentName}' deleted.`);
		},
	);

	// --- Focus Agent ---
	const focusDisposable = vscode.commands.registerCommand(
		"vscode-agentic.focusAgent",
		async (preSelectedRepoPath?: string, preSelectedAgentName?: string) => {
			// If both parameters provided (programmatic call), skip the picker
			if (preSelectedRepoPath && preSelectedAgentName) {
				await agentService.focusAgent(
					preSelectedRepoPath,
					preSelectedAgentName,
				);
				return;
			}

			const agents = agentService.getAll();
			if (agents.length === 0) {
				vscode.window.showInformationMessage("No agents available.");
				return;
			}

			const items: AgentPickItem[] = agents.map((a) => ({
				label: a.agentName,
				description: `${a.status} - ${a.repoPath}`,
				_repoPath: a.repoPath,
				_agentName: a.agentName,
			}));

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: "Select an agent to focus",
				title: "Focus Agent",
			});
			if (!selected) {
				return;
			}

			await agentService.focusAgent(selected._repoPath, selected._agentName);
		},
	);

	context.subscriptions.push(createDisposable, deleteDisposable, focusDisposable);
}

/**
 * Prompts user for agent name with branch validation and collision handling.
 * Returns the agent name string, null if user chose to reuse an existing agent,
 * or undefined if user cancelled.
 */
async function promptForAgentName(
	agentService: AgentService,
	repoPath: string,
): Promise<string | null | undefined> {
	const name = await vscode.window.showInputBox({
		title: "Agent Name",
		prompt: "Enter a name for the agent (used as git branch name)",
		placeHolder: "e.g., fix-auth-bug",
		validateInput: (value: string) => {
			if (!value) {
				return "Agent name is required";
			}
			if (!isValidBranchName(value)) {
				return "Invalid git branch name. Avoid spaces, ~, ^, :, ?, *, [, \\, and ..";
			}
			return undefined;
		},
	});

	if (name === undefined) {
		return undefined;
	}

	// Check for name collision
	const existing = agentService.getAgent(repoPath, name);
	if (existing) {
		const choice = await vscode.window.showQuickPick(
			[
				{ label: `Reuse existing agent '${name}'` },
				{ label: "Pick a different name" },
			],
			{
				placeHolder: `Agent '${name}' already exists`,
				title: "Agent Already Exists",
			},
		);

		if (!choice) {
			return undefined;
		}

		if (choice.label.startsWith("Reuse")) {
			await agentService.focusAgent(repoPath, name);
			return null; // signal: reuse handled
		}

		// User wants a different name -- recurse
		return promptForAgentName(agentService, repoPath);
	}

	return name;
}
