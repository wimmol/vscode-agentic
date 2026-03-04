import * as vscode from "vscode";
import type { AgentStatus } from "../models/agent.js";
import { PID_REGISTRY_KEY } from "../models/agent.js";

/**
 * Manages VS Code terminal lifecycle for agent sessions.
 *
 * Owns a Map<string, vscode.Terminal> keyed by `${repoPath}::${agentName}`.
 * Creates real VS Code terminals running Claude Code CLI, tracks terminal-to-agent
 * mapping, and fires status change callbacks when terminals close.
 *
 * Terminal references are ephemeral -- they are NOT persisted. On VS Code restart,
 * terminals are marked isTransient so they won't be restored. Phase 5 handles
 * session persistence via PID tracking and --continue flag support.
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
		private readonly state: vscode.Memento,
		private readonly onBackgroundExit?: (
			agentName: string,
			repoPath: string,
			status: AgentStatus,
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
	 *
	 * When continueSession is true, passes ["--continue"] to resume the last
	 * Claude session in the worktree directory.
	 */
	createTerminal(
		repoPath: string,
		agentName: string,
		worktreePath: string,
		initialPrompt?: string,
		continueSession?: boolean,
	): vscode.Terminal {
		const key = this.terminalKey(repoPath, agentName);

		// If terminal already exists, show it and return
		const existing = this.terminals.get(key);
		if (existing) {
			existing.show();
			return existing;
		}

		// Restart: use --continue to resume last session in worktree cwd
		// First run: pass initialPrompt if provided
		const shellArgs: string[] = continueSession
			? ["--continue"]
			: initialPrompt
				? [initialPrompt]
				: [];

		const terminal = vscode.window.createTerminal({
			name: `Agent: ${agentName}`,
			shellPath: "claude",
			shellArgs,
			cwd: worktreePath,
			isTransient: true,
		});

		this.terminals.set(key, terminal);

		// Track PID for orphan detection (fire-and-forget)
		this.trackPid(key, terminal);

		return terminal;
	}

	/**
	 * Disposes the terminal for the given agent.
	 * Critical: removes the map entry BEFORE calling terminal.dispose() to prevent
	 * the close handler from firing a status change (race condition per Pitfall 2).
	 * Also clears the PID entry from Memento.
	 */
	disposeTerminal(repoPath: string, agentName: string): void {
		const key = this.terminalKey(repoPath, agentName);
		const terminal = this.terminals.get(key);
		if (terminal) {
			this.terminals.delete(key);
			this.removePid(key);
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
	 * Returns the stored PID map from Memento.
	 */
	getAllPids(): Record<string, number> {
		return this.state.get<Record<string, number>>(PID_REGISTRY_KEY, {});
	}

	/**
	 * Clears all stored PIDs from Memento.
	 */
	async clearAllPids(): Promise<void> {
		await this.state.update(PID_REGISTRY_KEY, {});
	}

	/**
	 * Tracks the terminal PID in Memento for orphan detection.
	 * Fire-and-forget -- awaits processId with best-effort error handling.
	 */
	private async trackPid(key: string, terminal: vscode.Terminal): Promise<void> {
		try {
			const pid = await terminal.processId;
			if (pid !== undefined) {
				await this.savePidToMemento(key, pid);
			}
		} catch {
			// PID tracking is best-effort
		}
	}

	/**
	 * Saves a PID to the Memento registry, merging into existing map.
	 */
	private async savePidToMemento(key: string, pid: number): Promise<void> {
		const pidMap = this.getAllPids();
		pidMap[key] = pid;
		await this.state.update(PID_REGISTRY_KEY, pidMap);
	}

	/**
	 * Removes a PID entry from the Memento registry.
	 */
	private removePid(key: string): void {
		const pidMap = this.getAllPids();
		delete pidMap[key];
		// Fire-and-forget: don't await Memento update in dispose path
		this.state.update(PID_REGISTRY_KEY, pidMap);
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
				const status: AgentStatus = exitCode !== undefined && exitCode !== 0 ? "error" : "finished";

				this.onStatusChange(agentName, repoPath, status, exitCode);

				// Notify if this terminal was NOT the active terminal (user was elsewhere)
				if (this.onBackgroundExit && vscode.window.activeTerminal !== terminal) {
					this.onBackgroundExit(agentName, repoPath, status);
				}
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
