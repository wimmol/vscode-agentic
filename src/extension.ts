import * as vscode from "vscode";
import { AgentsStore } from "./services/agents-store";
import { ReposStore } from "./services/repos-store";
import { GitService } from "./services/git.service";
import { WorkspaceService } from "./services/workspace.service";
import { initTerminals, disposeAllTerminals } from "./utils/terminal";
import { SidebarViewProvider } from "./ui/view";
import { registerCreateAgent } from "./features/create-agent";
import { registerDeleteAgent } from "./features/delete-agent";
import { registerFocusAgent } from "./features/focus-agent";
import { registerStopAgent } from "./features/stop-agent";
import { registerAddRepo } from "./features/add-repo";
import { registerRemoveRepo } from "./features/remove-repo";
import { registerRootGlobal } from "./features/root-global";
import { registerRootRepo } from "./features/root-repo";

export const activate = (context: vscode.ExtensionContext): void => {
	console.log("[extension.activate]");

	// 1. Create shared services and thin stores
	const gitService = new GitService();
	const agentsStore = new AgentsStore(context.globalState);
	const reposStore = new ReposStore(context.globalState);
	const workspaceService = new WorkspaceService(reposStore);

	// 2. Initialize terminal management with status callback
	initTerminals((agentName, repoPath, status, exitCode) => {
		console.log("[extension] terminal status callback", { agentName, repoPath, status, exitCode });
		const entries = agentsStore.getAll();
		const entry = entries.find(e => e.repoPath === repoPath && e.agentName === agentName);
		if (entry) {
			entry.status = status;
			entry.exitCode = exitCode;
			if (status === "finished" || status === "error") {
				entry.finishedAt = new Date().toISOString();
			}
			agentsStore.save(entries);
		}
	});

	// 3. Register sidebar webview provider
	const sidebarProvider = new SidebarViewProvider(
		context.extensionUri, agentsStore, reposStore,
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, sidebarProvider),
	);

	// 4. Register all feature commands
	registerCreateAgent(context, agentsStore, reposStore, gitService);
	registerDeleteAgent(context, agentsStore, gitService);
	registerFocusAgent(context, agentsStore, workspaceService);
	registerStopAgent(context, agentsStore);
	registerAddRepo(context, reposStore, gitService, workspaceService);
	registerRemoveRepo(context, reposStore, workspaceService);
	registerRootGlobal(context, workspaceService);
	registerRootRepo(context, workspaceService);

	// 5. Dispose stores and terminal listeners on deactivation
	context.subscriptions.push({ dispose: () => agentsStore.dispose() });
	context.subscriptions.push({ dispose: () => reposStore.dispose() });
	context.subscriptions.push({ dispose: () => disposeAllTerminals() });

	// 6. Git health check (non-blocking)
	gitService.exec(".", ["--version"]).catch(() => {
		vscode.window.showErrorMessage(
			"VS Code Agentic: git is not installed or not in PATH. Worktree features are disabled.",
		);
	});

	// 7. Reconcile agent statuses on activation (reset running -> created)
	const entries = agentsStore.getAll();
	let changed = false;
	for (const entry of entries) {
		if (entry.status === "running") {
			entry.status = "created";
			entry.exitCode = undefined;
			changed = true;
		}
	}
	if (changed) {
		agentsStore.save(entries).catch((err: Error) => {
			vscode.window.showErrorMessage(`Agentic: Agent reconciliation failed: ${err.message}`);
		});
	}

	// 8. Initialize workspace file (non-blocking)
	workspaceService.ensureWorkspaceFile().then((created) => {
		if (created) {
			workspaceService.promptReopenInWorkspace();
		}
	}).catch((err: Error) => {
		vscode.window.showErrorMessage(`Agentic: Failed to create workspace file: ${err.message}`);
	});
};

export const deactivate = (): void => {};
