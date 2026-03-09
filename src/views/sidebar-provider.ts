import * as vscode from "vscode";
import type { AgentsStore } from "../services/agents-store.js";
import type { ReposStore } from "../services/repos-store.js";
import { getWebviewHtml } from "../ui/view.js";

/**
 * Dashboard data sent to webview via postMessage for React rendering.
 */
export interface DashboardData {
	repos: Array<{
		path: string;
		name: string;
		agents: import("../models/agent.js").AgentEntry[];
	}>;
	scope: string;
}

/**
 * WebviewViewProvider for the sidebar dashboard.
 *
 * Sends the React HTML shell on initial load, then postMessage-based
 * data updates for all subsequent changes.
 */
export class SidebarViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "vscode-agentic.agents";
	private _view?: vscode.WebviewView;
	private _currentScope = "global";

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly agentsStore: AgentsStore,
		private readonly reposStore: ReposStore,
	) {
		console.log("[SidebarViewProvider] created");
		this.agentsStore.onDidChange(() => this.refresh());
		this.reposStore.onDidChange(() => this.refresh());
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		console.log("[SidebarViewProvider.resolveWebviewView]");
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};

		webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri);

		// Send initial data after setting HTML
		const data = this._buildDashboardData();
		webviewView.webview.postMessage({ type: "update", data });

		webviewView.webview.onDidReceiveMessage((message) => {
			this._handleMessage(message);
		});
	}

	/**
	 * Update the sidebar with current data via postMessage.
	 */
	refresh(): void {
		console.log("[SidebarViewProvider.refresh]");
		if (!this._view) return;
		const data = this._buildDashboardData();
		this._view.webview.postMessage({ type: "update", data });
	}

	/**
	 * Update the scope mode and trigger a refresh.
	 */
	setScope(scope: string): void {
		console.log("[SidebarViewProvider.setScope]", scope);
		this._currentScope = scope;
		this.refresh();
	}

	/**
	 * Build the dashboard data payload for postMessage updates.
	 */
	private _buildDashboardData(): DashboardData {
		const repos = this.reposStore.getAll();
		return {
			repos: repos.map((repo) => ({
				path: repo.path,
				name: repo.path.split("/").pop() ?? repo.path,
				agents: this.agentsStore.getForRepo(repo.path),
			})),
			scope: this._currentScope,
		};
	}

	private _handleMessage(message: any): void {
		console.log("[SidebarViewProvider._handleMessage]", message.command, message);
		switch (message.command) {
			case "focusAgent":
				vscode.commands.executeCommand(
					"vscode-agentic.focusAgent",
					message.repoPath,
					message.agentName,
				);
				break;
			case "deleteAgent":
				vscode.commands.executeCommand(
					"vscode-agentic.deleteAgent",
					message.repoPath,
					message.agentName,
				);
				break;
			case "createAgent":
				vscode.commands.executeCommand(
					"vscode-agentic.createAgent",
					message.repoPath,
				);
				break;
			case "addRepo":
				vscode.commands.executeCommand("vscode-agentic.addRepo");
				break;
			case "stopAgent":
				vscode.commands.executeCommand(
					"vscode-agentic.stopAgent",
					message.repoPath,
					message.agentName,
				);
				break;
			case "removeRepo":
				vscode.commands.executeCommand(
					"vscode-agentic.removeRepo",
					message.repoPath,
				);
				break;
			case "rootGlobal":
				vscode.commands.executeCommand("vscode-agentic.rootGlobal");
				break;
			case "rootRepo":
				vscode.commands.executeCommand(
					"vscode-agentic.rootRepo",
					message.repoPath,
				);
				break;
		}
	}
}
