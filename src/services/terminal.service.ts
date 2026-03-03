import * as vscode from "vscode";
import type { AgentStatus } from "../models/agent.js";

/**
 * Manages VS Code terminal lifecycle for agent sessions.
 *
 * Owns a Map<string, vscode.Terminal> keyed by `${repoPath}::${agentName}`.
 * Creates real VS Code terminals running Claude Code CLI, tracks terminal-to-agent
 * mapping, and fires status change callbacks when terminals close.
 *
 * Terminal references are ephemeral -- they are NOT persisted. On VS Code restart,
 * terminals are marked isTransient so they won't be restored. Phase 5 handles
 * session persistence.
 */
export class TerminalService {
	private readonly terminals: Map<string, vscode.Terminal> = new Map();
	private readonly disposables: vscode.Disposable[] = [];

	constructor(
		private readonly onStatusChange: (
			agentName: string,
			repoPath: string,
			status: AgentStatus,
			exitCode?: number,
		) => void,
	) {
		// Subscribe to terminal close events
		this.disposables.push(
			vscode.window.onDidCloseTerminal((terminal) => {
				this.handleTerminalClose(terminal);
			}),
		);
	}

	private terminalKey(repoPath: string, agentName: string): string {
		return `${repoPath}::${agentName}`;
	}

	/**
	 * Creates a VS Code terminal for the given agent, or returns the existing one.
	 * Terminal runs Claude Code CLI with shellPath="claude", optional prompt as shellArgs,
	 * and cwd set to the agent's worktree path.
	 */
	createTerminal(
		repoPath: string,
		agentName: string,
		worktreePath: string,
		initialPrompt?: string,
	): vscode.Terminal {
		const key = this.terminalKey(repoPath, agentName);

		// If terminal already exists, show it and return
		const existing = this.terminals.get(key);
		if (existing) {
			existing.show();
			return existing;
		}

		const shellArgs: string[] = initialPrompt ? [initialPrompt] : [];

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

	/**
	 * Disposes the terminal for the given agent.
	 * Critical: removes the map entry BEFORE calling terminal.dispose() to prevent
	 * the close handler from firing a status change (race condition per Pitfall 2).
	 */
	disposeTerminal(repoPath: string, agentName: string): void {
		const key = this.terminalKey(repoPath, agentName);
		const terminal = this.terminals.get(key);
		if (terminal) {
			this.terminals.delete(key);
			terminal.dispose();
		}
	}

	/**
	 * Shows the terminal for the given agent, if one exists.
	 */
	showTerminal(repoPath: string, agentName: string): void {
		const key = this.terminalKey(repoPath, agentName);
		const terminal = this.terminals.get(key);
		if (terminal) {
			terminal.show();
		}
	}

	/**
	 * Returns whether a terminal exists for the given agent.
	 */
	hasTerminal(repoPath: string, agentName: string): boolean {
		return this.terminals.has(this.terminalKey(repoPath, agentName));
	}

	/**
	 * Handles a terminal close event. Identifies the agent by terminal identity (===),
	 * removes from map, and fires onStatusChange with the appropriate status.
	 */
	private handleTerminalClose(terminal: vscode.Terminal): void {
		for (const [key, t] of this.terminals.entries()) {
			if (t === terminal) {
				this.terminals.delete(key);

				const [repoPath, agentName] = key.split("::");
				const exitCode = terminal.exitStatus?.code;
				const status: AgentStatus =
					exitCode !== undefined && exitCode !== 0 ? "error" : "finished";

				this.onStatusChange(agentName, repoPath, status, exitCode);
				break;
			}
		}
	}

	/**
	 * Disposes all event subscriptions. Call on extension deactivation.
	 */
	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables.length = 0;
	}
}
