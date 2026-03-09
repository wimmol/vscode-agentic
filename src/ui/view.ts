import * as vscode from "vscode";
import { getNonce } from "../utils/nonce.js";

/**
 * Generate the HTML shell for the React webview.
 * Includes CSP with nonce, codicons CSS, dashboard.css, and the React bundle script.
 */
export function getWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
): string {
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
}
