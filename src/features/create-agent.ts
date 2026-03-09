import * as vscode from "vscode";
import type { AgentEntry } from "../models/agent";
import { WORKTREE_MANIFEST_KEY, type WorktreeEntry } from "../models/worktree";
import type { AgentsStore } from "../services/agents-store";
import type { GitService } from "../services/git.service";
import type { ReposStore } from "../services/repos-store";
import { isValidBranchName } from "../utils/branch-validation";
import { createTerminal } from "../utils/terminal";

/**
 * Create agent feature -- command registration, handler, and all business logic.
 *
 * Absorbs: agent.commands.ts createAgent handler + AgentService.createAgent + WorktreeService.addWorktree + worktree.commands.ts handleWorktreeLimitError
 */

/** Per-repo mutex: queues worktree operations so only one runs at a time per repo. */
const locks = new Map<string, Promise<void>>();

async function withLock<T>(repoPath: string, fn: () => Promise<T>): Promise<T> {
	const pending = locks.get(repoPath) ?? Promise.resolve();
	let resolve!: () => void;
	const next = new Promise<void>((r) => {
		resolve = r;
	});
	locks.set(repoPath, next);

	await pending;
	try {
		return await fn();
	} finally {
		resolve();
	}
}

function getWorktreeLimit(): number {
	return vscode.workspace.getConfiguration("vscode-agentic").get<number>("maxWorktreesPerRepo", 5);
}

function getWorktreeDirName(): string {
	return vscode.workspace.getConfiguration("vscode-agentic").get<string>("worktreeDirectoryName", ".worktrees");
}

interface WorktreePickItem extends vscode.QuickPickItem {
	agentName: string;
}

/**
 * When the worktree limit is reached, offer to delete an existing worktree.
 * Returns true if a worktree was deleted (caller can retry), false if user cancelled.
 */
async function handleWorktreeLimitError(
	repoPath: string,
	limit: number,
	existingEntries: WorktreeEntry[],
	gitService: GitService,
	globalState: vscode.Memento,
): Promise<boolean> {
	console.log("[feature:createAgent] handleWorktreeLimitError", { repoPath, limit });
	const items: WorktreePickItem[] = existingEntries.map((entry) => ({
		label: entry.agentName,
		description: `created ${entry.createdAt}`,
		detail: entry.path,
		agentName: entry.agentName,
	}));

	const selected = await vscode.window.showQuickPick(items, {
		title: `Worktree limit reached (${limit}). Select an agent to delete:`,
		placeHolder: "Choose an agent worktree to remove, or press Escape to cancel",
	});

	if (!selected) {
		return false;
	}

	// Remove worktree from disk
	try {
		await gitService.exec(repoPath, ["worktree", "remove", "--force", selected.detail!]);
	} catch {
		// Worktree may already be gone
	}

	// Remove branch
	try {
		await gitService.exec(repoPath, ["branch", "-D", selected.agentName]);
	} catch {
		// Branch may already be gone
	}

	// Remove from manifest
	const allManifest = globalState.get<WorktreeEntry[]>(WORKTREE_MANIFEST_KEY, []);
	const updated = allManifest.filter(
		(e) => !(e.agentName === selected.agentName && e.repoPath === repoPath),
	);
	await globalState.update(WORKTREE_MANIFEST_KEY, updated);

	vscode.window.showInformationMessage(
		`Deleted agent '${selected.agentName}'. You can now create a new agent.`,
	);

	return true;
}

export function registerCreateAgent(
	context: vscode.ExtensionContext,
	agentsStore: AgentsStore,
	reposStore: ReposStore,
	gitService: GitService,
): void {
	const disposable = vscode.commands.registerCommand(
		"vscode-agentic.createAgent",
		async (repoPath?: string) => {
			console.log("[feature:createAgent]", { repoPath });

			// Fall back to first configured repo if not passed from sidebar
			if (!repoPath) {
				const repos = reposStore.getAll();
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
				const existing = agentsStore
					.getAll()
					.find((e) => e.repoPath === repoPath && e.agentName === agentName);

				if (existing) {
					console.log("[feature:createAgent] name collision", { agentName });
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
						// Focus the existing agent instead
						await vscode.commands.executeCommand(
							"vscode-agentic.focusAgent",
							repoPath,
							agentName,
						);
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

			// Create worktree and agent entry
			const worktreeLimit = getWorktreeLimit();
			const worktreeDirName = getWorktreeDirName();
			const globalState = context.globalState;

			console.log("[feature:createAgent] creating worktree", { repoPath, agentName, worktreeLimit, worktreeDirName });

			const entry = await withLock(repoPath, async () => {
				// Check worktree limit
				const existingWorktrees = globalState
					.get<WorktreeEntry[]>(WORKTREE_MANIFEST_KEY, [])
					.filter((e) => e.repoPath === repoPath);

				if (existingWorktrees.length >= worktreeLimit) {
					const deleted = await handleWorktreeLimitError(
						repoPath!,
						worktreeLimit,
						existingWorktrees,
						gitService,
						globalState,
					);
					if (!deleted) {
						return undefined;
					}
				}

				// Build worktree path using vscode.Uri
				const repoUri = vscode.Uri.file(repoPath!);
				const worktreeUri = vscode.Uri.joinPath(repoUri, worktreeDirName, agentName!);
				const worktreePath = worktreeUri.fsPath;
				const branchName = agentName!;

				// Get the repo config for start point
				const repoConfig = reposStore.getForRepo(repoPath!);
				const startPoint = repoConfig?.stagingBranch || "HEAD";

				await gitService.exec(repoPath!, [
					"worktree",
					"add",
					"-b",
					branchName,
					worktreePath,
					startPoint,
				]);

				// Save to worktree manifest
				const worktreeEntry: WorktreeEntry = {
					path: worktreePath,
					branch: branchName,
					agentName: agentName!,
					repoPath: repoPath!,
					createdAt: new Date().toISOString(),
				};

				const allManifest = globalState.get<WorktreeEntry[]>(WORKTREE_MANIFEST_KEY, []);
				allManifest.push(worktreeEntry);
				await globalState.update(WORKTREE_MANIFEST_KEY, allManifest);

				// Save agent entry
				const agentEntry: AgentEntry = {
					agentName: agentName!,
					repoPath: repoPath!,
					status: "created",
					initialPrompt: initialPrompt || undefined,
					createdAt: new Date().toISOString(),
				};

				const agents = agentsStore.getAll();
				agents.push(agentEntry);
				await agentsStore.save(agents);

				return agentEntry;
			});

			if (entry) {
				console.log("[feature:createAgent] agent created", { agentName: entry.agentName });
				vscode.window.showInformationMessage(
					`Agent '${entry.agentName}' created. Focus it to start Claude Code.`,
				);
			}
		},
	);

	context.subscriptions.push(disposable);
}
