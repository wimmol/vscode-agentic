import * as path from "node:path";
import * as vscode from "vscode";
import type { AgentEntry } from "../models/agent.js";
import type { AgentService } from "../services/agent.service.js";
import type { RepoConfigService } from "../services/repo-config.service.js";
import { getHtmlForWebview } from "./sidebar-html.js";

/**
 * Dashboard data sent to webview via postMessage for DOM patching.
 */
export interface DashboardData {
	repos: Array<{
		path: string;
		name: string;
		agents: AgentEntry[];
	}>;
	scope: string;
}

/**
 * WebviewViewProvider for the sidebar dashboard.
 *
 * Uses full HTML render for initial load, then postMessage-based
 * DOM patching for all subsequent updates to avoid flicker,
 * lost scroll position, and lost focus.
 */
export class SidebarViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "vscode-agentic.agents";
	private _view?: vscode.WebviewView;
	private _initialRenderDone = false;
	private _currentScope = "global";

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly agentService: AgentService,
		private readonly repoConfigService: RepoConfigService,
	) {
		this.agentService.onDidChange(() => this.refresh());
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};

		webviewView.webview.html = this._getHtml(webviewView.webview);
		this._initialRenderDone = true;

		webviewView.webview.onDidReceiveMessage((message) => {
			this._handleMessage(message);
		});
	}

	/**
	 * Update the sidebar. Uses postMessage for in-place DOM patching
	 * after the initial full HTML render.
	 */
	refresh(): void {
		if (!this._view) return;
		if (!this._initialRenderDone) return;
		const data = this._buildDashboardData();
		this._view.webview.postMessage({ type: "update", data });
	}

	/**
	 * Update the scope mode and trigger a refresh.
	 */
	setScope(scope: string): void {
		this._currentScope = scope;
		this.refresh();
	}

	/**
	 * Build the dashboard data payload for postMessage updates.
	 */
	private _buildDashboardData(): DashboardData {
		const repos = this.repoConfigService.getAll();
		return {
			repos: repos.map((repo) => ({
				path: repo.path,
				name: path.basename(repo.path),
				agents: this.agentService.getForRepo(repo.path),
			})),
			scope: this._currentScope,
		};
	}

	private _getHtml(webview: vscode.Webview): string {
		const repos = this.repoConfigService.getAll();
		const agentsByRepo = new Map<string, AgentEntry[]>();
		for (const repo of repos) {
			agentsByRepo.set(repo.path, this.agentService.getForRepo(repo.path));
		}
		return getHtmlForWebview(webview, this.extensionUri, repos, agentsByRepo);
	}

	private _handleMessage(message: any): void {
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
