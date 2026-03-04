import * as vscode from "vscode";
import { registerAgentCommands } from "./commands/agent.commands.js";
import { registerDiffCommands } from "./commands/diff.commands.js";
import { registerRepoCommands } from "./commands/repo.commands.js";
import { registerSidebarCommands } from "./commands/sidebar.commands.js";
import { GitContentProvider } from "./providers/git-content.provider.js";
import { AgentService } from "./services/agent.service.js";
import { DiffService } from "./services/diff.service.js";
import { GitService } from "./services/git.service.js";
import { RepoConfigService } from "./services/repo-config.service.js";
import { TerminalService } from "./services/terminal.service.js";
import { WorkspaceSwitchService } from "./services/workspace-switch.service.js";
import { WorktreeService } from "./services/worktree.service.js";
import { AgentTreeItem } from "./views/agent-tree-items.js";
import { AgentTreeProvider } from "./views/agent-tree-provider.js";

export function activate(context: vscode.ExtensionContext): void {
	// 1. Create service singletons
	const gitService = new GitService();
	const worktreeService = new WorktreeService(gitService, context.workspaceState);
	const repoConfigService = new RepoConfigService(context.workspaceState, gitService);

	const diffService = new DiffService(gitService, repoConfigService);
	const gitContentProvider = new GitContentProvider(gitService);

	// AgentService and TerminalService have a circular dependency:
	// - TerminalService needs a status change callback that calls agentService.updateStatus
	// - AgentService needs TerminalService for focusAgent/deleteAgent
	// Resolved via setTerminalService() setter after both are constructed.
	const agentService = new AgentService(context.workspaceState, worktreeService);
	const terminalService = new TerminalService(
		(agentName, repoPath, status, exitCode) => {
			agentService.updateStatus(repoPath, agentName, status, exitCode);
		},
		context.workspaceState,
		// Notification callback for background agent exits
		async (agentName, repoPath, status) => {
			const statusLabel = status === "error" ? "encountered an error" : "finished";
			const action = await vscode.window.showInformationMessage(
				`Agent '${agentName}' ${statusLabel}.`,
				"Show Agent",
			);
			if (action === "Show Agent") {
				await vscode.commands.executeCommand(
					"vscode-agentic.focusAgent",
					repoPath,
					agentName,
				);
			}
		},
	);
	agentService.setTerminalService(terminalService);

	// 2. Create TreeView and workspace switch service
	const agentTreeProvider = new AgentTreeProvider(agentService, diffService);
	const treeView = vscode.window.createTreeView("vscode-agentic.agents", {
		treeDataProvider: agentTreeProvider,
	});
	const workspaceSwitchService = new WorkspaceSwitchService(
		agentService,
		terminalService,
		worktreeService,
	);

	// 3. Register commands
	registerRepoCommands(context, repoConfigService);
	registerAgentCommands(context, agentService, terminalService, repoConfigService, diffService);
	registerSidebarCommands(context, agentService, workspaceSwitchService, treeView, agentTreeProvider, diffService);
	registerDiffCommands(context, diffService, repoConfigService, agentService);

	// 4. Register content provider and dispose services on deactivation
	const contentProviderReg = vscode.workspace.registerTextDocumentContentProvider(
		GitContentProvider.SCHEME,
		gitContentProvider,
	);

	context.subscriptions.push(
		treeView,
		contentProviderReg,
		{ dispose: () => agentTreeProvider.dispose() },
		{ dispose: () => agentService.dispose() },
		{ dispose: () => terminalService.dispose() },
	);

	// 5. Git health check (warn if git not available, non-blocking)
	gitService.exec(".", ["--version"]).catch(() => {
		vscode.window.showErrorMessage(
			"VS Code Agentic: git is not installed or not in PATH. Worktree features are disabled.",
		);
	});

	// 6. Ordered reconciliation sequence (fire-and-forget, non-blocking)
	(async () => {
		try {
			// Step 1: Worktree reconciliation per repo (removes disk/manifest orphans)
			const repos = repoConfigService.getAll();
			let worktreeOrphanCount = 0;
			for (const repo of repos) {
				const result = await worktreeService.reconcile(repo.path);
				worktreeOrphanCount +=
					result.orphanedInManifest.length + result.orphanedOnDisk.length;
			}
			if (worktreeOrphanCount > 0) {
				vscode.window.showInformationMessage(
					`Agentic: Cleaned up ${worktreeOrphanCount} orphaned worktree(s)`,
				);
			}

			// Step 2: Agent-worktree cross-reference + reset running to created
			const { orphanedAgentCount } =
				await agentService.reconcileOnActivation();

			// Step 3: Orphan process cleanup
			const killedCount = await agentService.cleanupOrphanProcesses();

			// Combine agent + process orphan notification
			const totalCleaned = orphanedAgentCount + killedCount;
			if (totalCleaned > 0) {
				vscode.window.showInformationMessage(
					`Agentic: Cleaned up ${totalCleaned} orphaned agent(s)/process(es)`,
				);
			}

			// Step 4: Recompute diff status cache from scratch
			agentTreeProvider.updateDiffStatus();

			// Step 5: Reveal last-focused agent in sidebar
			const lastFocusedKey = agentService.getLastFocused();
			if (lastFocusedKey) {
				const [repoPath, agentName] = lastFocusedKey.split("::");
				if (repoPath && agentName) {
					const agent = agentService.getAgent(repoPath, agentName);
					if (agent) {
						const treeItem = new AgentTreeItem(
							agentName,
							repoPath,
							agent.status,
							agent.initialPrompt,
						);
						treeView.reveal(treeItem, { select: true, focus: false });
					}
				}
			}
		} catch (err) {
			if (err instanceof Error) {
				vscode.window.showErrorMessage(
					`Agentic: Reconciliation failed: ${err.message}`,
				);
			}
		}
	})();
}

export function deactivate(): void {
	// Cleanup handled via context.subscriptions
}
