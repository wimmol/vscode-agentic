import * as vscode from "vscode";
import type { AgentStatus } from "../models/agent";

/**
 * Shared terminal state used by agent feature files.
 * Keeps the terminals Map and close handler in one place.
 * Not a class -- just module-level functions for simplicity.
 */

const terminals = new Map<string, vscode.Terminal>();
const disposables: vscode.Disposable[] = [];
let onStatusChange:
	| ((agentName: string, repoPath: string, status: AgentStatus, exitCode?: number) => void)
	| undefined;

function terminalKey(repoPath: string, agentName: string): string {
	return `${repoPath}::${agentName}`;
}

function handleTerminalClose(terminal: vscode.Terminal): void {
	console.log("[terminal.handleTerminalClose]", terminal.name);
	for (const [key, t] of terminals.entries()) {
		if (t === terminal) {
			terminals.delete(key);

			const separatorIndex = key.indexOf("::");
			const repoPath = key.substring(0, separatorIndex);
			const agentName = key.substring(separatorIndex + 2);

			const exitCode = terminal.exitStatus?.code;
			const status: AgentStatus =
				exitCode !== undefined && exitCode !== 0 ? "error" : "finished";
			onStatusChange?.(agentName, repoPath, status, exitCode);
			break;
		}
	}
}

/**
 * Initialize terminal management. Must be called once from extension.ts.
 * Registers the close handler and sets the status callback.
 */
export function initTerminals(
	statusCallback: typeof onStatusChange,
): vscode.Disposable[] {
	console.log("[terminal.initTerminals]");
	onStatusChange = statusCallback;

	const closeListener = vscode.window.onDidCloseTerminal((terminal) => {
		handleTerminalClose(terminal);
	});
	disposables.push(closeListener);

	return disposables;
}

/**
 * Create a new terminal for an agent. If one already exists, shows it and returns it.
 */
export function createTerminal(
	repoPath: string,
	agentName: string,
	worktreePath: string,
	initialPrompt?: string,
): vscode.Terminal {
	console.log("[terminal.createTerminal]", { repoPath, agentName, worktreePath, initialPrompt });
	const key = terminalKey(repoPath, agentName);

	const existing = terminals.get(key);
	if (existing) {
		console.log("[terminal.createTerminal] existing terminal found, showing");
		existing.show();
		return existing;
	}

	const shellArgs: string[] = [];
	if (initialPrompt) {
		shellArgs.push(initialPrompt);
	}

	const terminal = vscode.window.createTerminal({
		name: `Agent: ${agentName}`,
		shellPath: "claude",
		shellArgs,
		cwd: worktreePath,
		isTransient: true,
	});

	terminals.set(key, terminal);
	return terminal;
}

/**
 * Dispose (close) a specific agent terminal.
 * Removes from map BEFORE dispose to prevent close handler race condition.
 */
export function disposeTerminal(repoPath: string, agentName: string): void {
	console.log("[terminal.disposeTerminal]", { repoPath, agentName });
	const key = terminalKey(repoPath, agentName);
	const terminal = terminals.get(key);
	if (terminal) {
		terminals.delete(key);
		terminal.dispose();
	}
}

/**
 * Show an existing terminal for an agent.
 */
export function showTerminal(repoPath: string, agentName: string): void {
	console.log("[terminal.showTerminal]", { repoPath, agentName });
	const terminal = terminals.get(terminalKey(repoPath, agentName));
	if (terminal) {
		terminal.show();
	}
}

/**
 * Check if a terminal exists for an agent.
 */
export function hasTerminal(repoPath: string, agentName: string): boolean {
	return terminals.has(terminalKey(repoPath, agentName));
}

/**
 * Dispose all agent terminals. Called on extension deactivation.
 */
export function disposeAllTerminals(): void {
	console.log("[terminal.disposeAllTerminals]", { count: terminals.size });
	for (const [key, terminal] of terminals.entries()) {
		terminals.delete(key);
		terminal.dispose();
	}
	for (const d of disposables) {
		d.dispose();
	}
	disposables.length = 0;
}
