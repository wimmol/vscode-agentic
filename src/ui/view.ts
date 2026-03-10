import * as vscode from "vscode";
import type { AgentsStore } from "../services/agents-store.js";
import type { ReposStore } from "../services/repos-store.js";
import type { DashboardData } from "./types.js";
import { getNonce } from "../utils/nonce.js";

/**
 * Generate the HTML shell for the React webview.
 * Includes CSP with nonce, codicons CSS, dashboard.css, and the React bundle script.
 */
const getWebviewHtml = (
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
): string => {
	const nonce = getNonce();

	const codiconsUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "codicons", "dist", "codicon.css"),
	);

	const dashboardCssUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, "src", "ui", "styles", "dashboard.css"),
	);

	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, "dist", "webview.js"),
	);

	console.log("[view] getWebviewHtml: generating HTML shell");

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
	<link href="${codiconsUri}" rel="stylesheet" />
	<link href="${dashboardCssUri}" rel="stylesheet" />
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
};

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

		webviewView.webview.onDidReceiveMessage((message) => {
			console.log("[SidebarViewProvider._handleMessage]", message.command, message);
			const { command, repoPath, agentName } = message;
			if (command === "webviewReady") {
				this.refresh();
				return;
			}
			const args = [repoPath, agentName].filter(Boolean);
			vscode.commands.executeCommand(`vscode-agentic.${command}`, ...args);
		});
	}

	refresh(): void {
		console.log("[SidebarViewProvider.refresh]");
		if (!this._view) return;
		const data = this._buildDashboardData();
		this._view.webview.postMessage({ type: "update", data });
	}

	setScope(scope: string): void {
		console.log("[SidebarViewProvider.setScope]", scope);
		this._currentScope = scope;
		this.refresh();
	}

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
}
