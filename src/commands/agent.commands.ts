import * as vscode from "vscode";
import type { AgentService } from "../services/agent.service.js";
import { AgentLimitError } from "../services/agent.service.js";
import type { DiffService } from "../services/diff.service.js";
import type { RepoConfigService } from "../services/repo-config.service.js";
import type { TerminalService } from "../services/terminal.service.js";
import { isValidBranchName } from "../utils/branch-validation.js";

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
	diffService?: DiffService,
): void {
	// --- Create Agent ---
	const createDisposable = vscode.commands.registerCommand(
		"vscode-agentic.createAgent",
		async (preSelectedRepoPath?: string) => {
			// 1. Pick repo (skip if pre-selected from sidebar inline button)
			const repos = repoConfigService.getAll();
			if (repos.length === 0) {
				vscode.window.showErrorMessage("No repositories configured. Run 'Add Repository' first.");
				return;
			}

			let repoPath: string;
			const matchedPreSelected =
				preSelectedRepoPath && repos.find((r) => r.path === preSelectedRepoPath);
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
			const agentName = await promptForAgentName(agentService, repoPath);
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

			// 4. Create agent (with auto-suspend offer on limit error)
			const initialPrompt = promptInput || undefined;
			try {
				await agentService.createAgent(repoPath, agentName, initialPrompt);
			} catch (err) {
				if (err instanceof AgentLimitError) {
					const handled = await handleAgentLimitError(err, agentService);
					if (handled) {
						// Retry after suspend
						await agentService.createAgent(repoPath, agentName, initialPrompt);
					} else {
						return; // User cancelled
					}
				} else {
					throw err;
				}
			}

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

			// Merge guard: block deletion if agent has unmerged changes
			if (diffService) {
				const hasUnmerged = await diffService.hasUnmergedChanges(
					selected._repoPath,
					selected._agentName,
				);
				if (hasUnmerged) {
					const action = await vscode.window.showWarningMessage(
						`Agent '${selected._agentName}' has unmerged changes vs staging. Review changes or create a PR first.`,
						"Review Changes",
						"Cancel",
					);
					if (action === "Review Changes") {
						await vscode.commands.executeCommand(
							"vscode-agentic.reviewChanges",
							selected._repoPath,
							selected._agentName,
						);
					}
					return;
				}
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
				await agentService.focusAgent(preSelectedRepoPath, preSelectedAgentName);
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

	// --- Suspend Agent ---
	const suspendDisposable = vscode.commands.registerCommand(
		"vscode-agentic.suspendAgent",
		async () => {
			const agents = agentService.getAll();
			const suspendable = agents.filter((a) => a.status !== "running" && a.status !== "suspended");

			if (suspendable.length === 0) {
				vscode.window.showInformationMessage("No agents available to suspend.");
				return;
			}

			const items: AgentPickItem[] = suspendable.map((a) => ({
				label: a.agentName,
				description: `${a.status} - ${a.repoPath}`,
				_repoPath: a.repoPath,
				_agentName: a.agentName,
			}));

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: "Select an agent to suspend",
				title: "Suspend Agent",
			});
			if (!selected) {
				return;
			}

			await agentService.suspendAgent(selected._repoPath, selected._agentName);
			vscode.window.showInformationMessage(`Agent '${selected._agentName}' suspended.`);
		},
	);

	// --- Suspend All Idle Agents ---
	const suspendAllDisposable = vscode.commands.registerCommand(
		"vscode-agentic.suspendAllIdle",
		async () => {
			const count = await agentService.suspendAllIdle();
			if (count === 0) {
				vscode.window.showInformationMessage("No idle agents to suspend.");
			} else {
				vscode.window.showInformationMessage(`Suspended ${count} agent(s).`);
			}
		},
	);

	context.subscriptions.push(
		createDisposable,
		deleteDisposable,
		focusDisposable,
		suspendDisposable,
		suspendAllDisposable,
	);
}

/**
 * Handles an AgentLimitError by offering to suspend the oldest idle agent.
 * Returns true if an agent was suspended (caller should retry creation),
 * false if the user cancelled or no idle agents are available.
 */
async function handleAgentLimitError(
	error: AgentLimitError,
	agentService: AgentService,
): Promise<boolean> {
	// Find oldest idle agent (not running, not suspended) to offer for suspension
	const candidates = error.existingAgents
		.filter((a) => a.status !== "running" && a.status !== "suspended")
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

	if (candidates.length === 0) {
		vscode.window.showWarningMessage(`${error.message} No idle agents available to suspend.`);
		return false;
	}

	const oldest = candidates[0];
	const scopeLabel =
		error.limitType === "per-repo"
			? `Per-repo agent limit (${error.limit})`
			: `Global agent limit (${error.limit})`;

	const action = await vscode.window.showWarningMessage(
		`${scopeLabel} reached. Suspend idle agent '${oldest.agentName}' to make room?`,
		"Suspend & Create",
		"Cancel",
	);

	if (action === "Suspend & Create") {
		await agentService.suspendAgent(oldest.repoPath, oldest.agentName);
		return true;
	}
	return false;
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
			[{ label: `Reuse existing agent '${name}'` }, { label: "Pick a different name" }],
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
