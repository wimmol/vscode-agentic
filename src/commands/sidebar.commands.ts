import * as vscode from "vscode";
import type { AgentService } from "../services/agent.service.js";
import type { DiffService } from "../services/diff.service.js";
import type { WorkspaceSwitchService } from "../services/workspace-switch.service.js";
import type { AgentTreeProvider } from "../views/agent-tree-provider.js";
import { AgentTreeItem } from "../views/agent-tree-items.js";

/**
 * Registers sidebar-specific commands:
 * - focusAgentFromTile: click handler for agent TreeItem (distinct from command palette focusAgent)
 * - deleteAgentFromTile: context menu delete on agent tile
 * - copyBranchName: context menu copy branch name
 * - createAgentInRepo: inline "+" button on repo group header
 */
export function registerSidebarCommands(
	context: vscode.ExtensionContext,
	agentService: AgentService,
	workspaceSwitchService: WorkspaceSwitchService,
	treeView: vscode.TreeView<unknown>,
	_treeProvider: AgentTreeProvider,
	diffService?: DiffService,
): void {
	// --- Focus Agent From Tile (click handler) ---
	const focusFromTile = vscode.commands.registerCommand(
		"vscode-agentic.focusAgentFromTile",
		async (repoPath: string, agentName: string) => {
			await workspaceSwitchService.switchToAgent(repoPath, agentName);

			// Reveal the agent in the TreeView for active highlighting.
			// TreeView matches by id -- status doesn't matter for id construction.
			const agentItem = new AgentTreeItem(
				agentName,
				repoPath,
				"created",
			);
			treeView.reveal(agentItem, { select: true, focus: false });
		},
	);

	// --- Delete Agent From Tile (context menu) ---
	const deleteFromTile = vscode.commands.registerCommand(
		"vscode-agentic.deleteAgentFromTile",
		async (repoPath: string, agentName: string) => {
			// Merge guard: block deletion if agent has unmerged changes
			if (diffService) {
				const hasUnmerged = await diffService.hasUnmergedChanges(repoPath, agentName);
				if (hasUnmerged) {
					const action = await vscode.window.showWarningMessage(
						`Agent '${agentName}' has unmerged changes vs staging. Review changes or create a PR first.`,
						"Review Changes",
						"Cancel",
					);
					if (action === "Review Changes") {
						await vscode.commands.executeCommand(
							"vscode-agentic.reviewChanges",
							repoPath,
							agentName,
						);
					}
					return;
				}
			}

			const confirmed = await vscode.window.showWarningMessage(
				`Delete agent '${agentName}'? This removes the worktree and branch.`,
				{ modal: true },
				"Delete",
			);
			if (confirmed !== "Delete") {
				return;
			}

			await agentService.deleteAgent(repoPath, agentName);
			vscode.window.showInformationMessage(
				`Agent '${agentName}' deleted.`,
			);
		},
	);

	// --- Copy Branch Name (context menu) ---
	const copyBranch = vscode.commands.registerCommand(
		"vscode-agentic.copyBranchName",
		async (_repoPath: string, agentName: string) => {
			await vscode.env.clipboard.writeText(agentName);
			vscode.window.showInformationMessage(
				`Copied branch name: ${agentName}`,
			);
		},
	);

	// --- Create Agent In Repo (inline button on repo group) ---
	const createInRepo = vscode.commands.registerCommand(
		"vscode-agentic.createAgentInRepo",
		async (repoPath: string) => {
			await vscode.commands.executeCommand(
				"vscode-agentic.createAgent",
				repoPath,
			);
		},
	);

	// --- Suspend Agent From Tile (context menu) ---
	const suspendFromTile = vscode.commands.registerCommand(
		"vscode-agentic.suspendAgentFromTile",
		async (repoPath: string, agentName: string) => {
			await agentService.suspendAgent(repoPath, agentName);
			vscode.window.showInformationMessage(
				`Agent '${agentName}' suspended.`,
			);
		},
	);

	// --- Restore Agent From Tile (context menu) ---
	const restoreFromTile = vscode.commands.registerCommand(
		"vscode-agentic.restoreAgentFromTile",
		async (repoPath: string, agentName: string) => {
			await workspaceSwitchService.switchToAgent(repoPath, agentName);

			const agentItem = new AgentTreeItem(
				agentName,
				repoPath,
				"created",
			);
			treeView.reveal(agentItem, { select: true, focus: false });

			vscode.window.showInformationMessage(
				`Agent '${agentName}' restored.`,
			);
		},
	);

	context.subscriptions.push(
		focusFromTile,
		deleteFromTile,
		copyBranch,
		createInRepo,
		suspendFromTile,
		restoreFromTile,
	);
}
