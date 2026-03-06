import * as vscode from "vscode";
import type { AgentEntry } from "../models/agent.js";
import type { AgentService } from "../services/agent.service.js";
import type { RepoConfigService } from "../services/repo-config.service.js";
import { getHtmlForWebview } from "./sidebar-html.js";

/**
 * WebviewViewProvider for the sidebar dashboard.
 *
 * Renders agent tiles grouped by repository, handles webview messages
 * by routing them to VS Code commands, and auto-refreshes when
 * AgentService data changes.
 */
export class SidebarViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "vscode-agentic.agents";
	private _view?: vscode.WebviewView;

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

		webviewView.webview.onDidReceiveMessage((message) => {
			this._handleMessage(message);
		});
	}

	refresh(): void {
		if (this._view) {
			this._view.webview.html = this._getHtml(this._view.webview);
		}
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
		}
	}
}
