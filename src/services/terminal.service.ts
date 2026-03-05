import * as vscode from "vscode";
import type { AgentStatus } from "../models/agent.js";

/**
 * Manages VS Code terminal lifecycle for agent sessions.
 *
 * Maps terminals to agents by a compound key (repoPath::agentName).
 * Creates real VS Code terminals running Claude Code CLI.
 * Fires status change callbacks when terminals close.
 */
export class TerminalService {
	private terminals: Map<string, vscode.Terminal> = new Map();
	private disposables: vscode.Disposable[] = [];

	constructor(
		private readonly onStatusChange: (
			agentName: string,
			repoPath: string,
			status: AgentStatus,
			exitCode?: number,
		) => void,
	) {
		this.disposables.push(
			vscode.window.onDidCloseTerminal((terminal) => {
				this.handleTerminalClose(terminal);
			}),
		);
	}

	private terminalKey(repoPath: string, agentName: string): string {
		return `${repoPath}::${agentName}`;
	}

	createTerminal(
		repoPath: string,
		agentName: string,
		worktreePath: string,
		initialPrompt?: string,
	): vscode.Terminal {
		const key = this.terminalKey(repoPath, agentName);

		// If terminal already exists, just show it and return
		const existing = this.terminals.get(key);
		if (existing) {
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

		this.terminals.set(key, terminal);
		return terminal;
	}

	disposeTerminal(repoPath: string, agentName: string): void {
		const key = this.terminalKey(repoPath, agentName);
		const terminal = this.terminals.get(key);
		if (terminal) {
			// CRITICAL: Remove from map BEFORE calling dispose() to prevent
			// the close handler from firing onStatusChange (race condition).
			this.terminals.delete(key);
			terminal.dispose();
		}
	}

	showTerminal(repoPath: string, agentName: string): void {
		const terminal = this.terminals.get(this.terminalKey(repoPath, agentName));
		if (terminal) {
			terminal.show();
		}
	}

	hasTerminal(repoPath: string, agentName: string): boolean {
		return this.terminals.has(this.terminalKey(repoPath, agentName));
	}

	private handleTerminalClose(terminal: vscode.Terminal): void {
		for (const [key, t] of this.terminals.entries()) {
			if (t === terminal) {
				this.terminals.delete(key);

				const separatorIndex = key.indexOf("::");
				const repoPath = key.substring(0, separatorIndex);
				const agentName = key.substring(separatorIndex + 2);

				const exitCode = terminal.exitStatus?.code;
				const status: AgentStatus =
					exitCode !== undefined && exitCode !== 0 ? "error" : "finished";
				this.onStatusChange(agentName, repoPath, status, exitCode);
				break;
			}
		}
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables = [];
	}
}
