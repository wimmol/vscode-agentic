// biome-ignore lint/style/useImportType: vscode used as value import in Plan 03
import * as vscode from "vscode";

// biome-ignore lint/correctness/noUnusedFunctionParameters: context will be wired in Plan 03
export function activate(context: vscode.ExtensionContext): void {
	// Services and commands will be wired here in Plan 03
	console.log("vscode-agentic is now active");
}

export function deactivate(): void {
	// Cleanup if needed
}
