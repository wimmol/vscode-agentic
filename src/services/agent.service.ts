import * as vscode from "vscode";
import type { AgentEntry, AgentStatus } from "../models/agent.js";
import { AGENT_REGISTRY_KEY, LAST_FOCUSED_KEY } from "../models/agent.js";
import type { TerminalService } from "./terminal.service.js";
import type { WorktreeService } from "./worktree.service.js";

/**
 * Checks if a process with the given PID is alive by sending signal 0.
 * Returns true if no error (process exists and we can signal it), false otherwise.
 */
function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Orchestrates agent lifecycle by coordinating WorktreeService (git operations),
 * TerminalService (terminal management), and Memento (persistence).
 *
 * Manages create, delete, focus, status updates, and activation reconciliation.
 * TerminalService is set after construction via setTerminalService() to break
 * the circular dependency with the status change callback.
 */
export class AgentService {
	private terminalService: TerminalService | undefined;
	private readonly _onDidChangeAgents = new vscode.EventEmitter<void>();
	readonly onDidChangeAgents = this._onDidChangeAgents.event;

	constructor(
		private readonly state: vscode.Memento,
		private readonly worktreeService: WorktreeService,
	) {}

	/**
	 * Sets the TerminalService reference. Must be called after both services
	 * are constructed, before focusAgent or deleteAgent are used.
	 */
	setTerminalService(ts: TerminalService): void {
		this.terminalService = ts;
	}

	private getRegistry(): AgentEntry[] {
		return this.state.get<AgentEntry[]>(AGENT_REGISTRY_KEY, []);
	}

	private async saveRegistry(entries: AgentEntry[]): Promise<void> {
		await this.state.update(AGENT_REGISTRY_KEY, entries);
	}

	/**
	 * Creates a new agent: creates a git worktree+branch, persists the agent entry.
	 * Does NOT create a terminal -- that happens lazily on focusAgent.
	 */
	async createAgent(
		repoPath: string,
		agentName: string,
		initialPrompt?: string,
	): Promise<AgentEntry> {
		await this.worktreeService.addWorktree(repoPath, agentName);

		const entry: AgentEntry = {
			agentName,
			repoPath,
			status: "created",
			initialPrompt,
			createdAt: new Date().toISOString(),
		};

		const registry = this.getRegistry();
		registry.push(entry);
		await this.saveRegistry(registry);
		this._onDidChangeAgents.fire();

		return entry;
	}

	/**
	 * Returns the agent entry for a given repoPath+agentName, or undefined.
	 */
	getAgent(repoPath: string, agentName: string): AgentEntry | undefined {
		return this.getRegistry().find((e) => e.repoPath === repoPath && e.agentName === agentName);
	}

	/**
	 * Returns all agent entries across all repos.
	 */
	getAll(): AgentEntry[] {
		return this.getRegistry();
	}

	/**
	 * Returns agents for the given repoPath only.
	 */
	getForRepo(repoPath: string): AgentEntry[] {
		return this.getRegistry().filter((e) => e.repoPath === repoPath);
	}

	/**
	 * Deletes an agent: disposes terminal, removes worktree+branch, removes registry entry.
	 * No-op if agent does not exist.
	 */
	async deleteAgent(repoPath: string, agentName: string): Promise<void> {
		const agent = this.getAgent(repoPath, agentName);
		if (!agent) {
			return;
		}

		this.requireTerminalService().disposeTerminal(repoPath, agentName);
		await this.worktreeService.removeWorktree(repoPath, agentName);

		const registry = this.getRegistry().filter(
			(e) => !(e.repoPath === repoPath && e.agentName === agentName),
		);
		await this.saveRegistry(registry);
		this._onDidChangeAgents.fire();
	}

	/**
	 * Suspends an agent: disposes terminal and sets status to "suspended".
	 * Only idle agents (created/finished/error) can be suspended.
	 * Running or already-suspended agents are no-ops.
	 */
	async suspendAgent(repoPath: string, agentName: string): Promise<void> {
		const agent = this.getAgent(repoPath, agentName);
		if (!agent) {
			return;
		}
		if (agent.status === "running" || agent.status === "suspended") {
			return;
		}
		this.requireTerminalService().disposeTerminal(repoPath, agentName);
		await this.updateStatus(repoPath, agentName, "suspended");
	}

	/**
	 * Suspends all idle agents (created/finished/error) in a single batch.
	 * Skips running and already-suspended agents.
	 * Returns the count of agents suspended.
	 */
	async suspendAllIdle(): Promise<number> {
		const registry = this.getRegistry();
		const eligible = registry.filter(
			(e) => e.status === "created" || e.status === "finished" || e.status === "error",
		);

		if (eligible.length === 0) {
			return 0;
		}

		const ts = this.requireTerminalService();
		for (const entry of eligible) {
			ts.disposeTerminal(entry.repoPath, entry.agentName);
		}

		// Single registry read-modify-write: update all eligible entries
		for (const entry of eligible) {
			const agent = registry.find(
				(e) => e.repoPath === entry.repoPath && e.agentName === entry.agentName,
			);
			if (agent) {
				agent.status = "suspended";
			}
		}
		await this.saveRegistry(registry);
		this._onDidChangeAgents.fire();

		return eligible.length;
	}

	/**
	 * Focuses an agent: lazily creates a terminal (or shows existing one).
	 * - Status "created"/"finished"/"error"/"suspended": create terminal, update to "running"
	 * - Status "running": show existing terminal
	 *
	 * "suspended" falls through to else branch -- handled identically to "created"/"finished"/"error"
	 *
	 * Restart detection: if the agent has been run before (hasBeenRun=true),
	 * passes continueSession=true to createTerminal which uses --continue flag.
	 * On first focus, passes the initialPrompt and sets hasBeenRun=true.
	 * Stores last-focused agent key in Memento after every focus.
	 */
	async focusAgent(repoPath: string, agentName: string): Promise<void> {
		const agent = this.getAgent(repoPath, agentName);
		if (!agent) {
			return;
		}

		if (agent.status === "running") {
			this.requireTerminalService().showTerminal(repoPath, agentName);
			return;
		}

		// Status is "created", "finished", or "error" -- create a new terminal
		const manifest = this.worktreeService.getManifest(repoPath);
		const worktreeEntry = manifest.find((w) => w.agentName === agentName);
		if (!worktreeEntry) {
			return;
		}

		// Determine if this is a restart (agent has been run before)
		const isRestart = agent.hasBeenRun === true;

		this.requireTerminalService().createTerminal(
			repoPath,
			agentName,
			worktreeEntry.path,
			isRestart ? undefined : agent.initialPrompt,
			isRestart,
		);

		// Single registry read-modify-write: set status to "running" and hasBeenRun=true
		const registry = this.getRegistry();
		const registryAgent = registry.find(
			(e) => e.repoPath === repoPath && e.agentName === agentName,
		);
		if (registryAgent) {
			registryAgent.status = "running";
			registryAgent.hasBeenRun = true;
			await this.saveRegistry(registry);
			this._onDidChangeAgents.fire();
		}

		// Store last-focused agent key
		await this.setLastFocused(repoPath, agentName);
	}

	/**
	 * Updates agent status and optional exitCode in the registry.
	 */
	async updateStatus(
		repoPath: string,
		agentName: string,
		status: AgentStatus,
		exitCode?: number,
	): Promise<void> {
		const registry = this.getRegistry();
		const agent = registry.find((e) => e.repoPath === repoPath && e.agentName === agentName);
		if (!agent) {
			return;
		}

		agent.status = status;
		agent.exitCode = exitCode;
		await this.saveRegistry(registry);
		this._onDidChangeAgents.fire();
	}

	/**
	 * On extension activation, cross-references agent registry with worktree
	 * manifests and resets any "running" agents to "created".
	 *
	 * Ordering:
	 * 1. Remove orphaned agents (no matching worktree in manifest)
	 * 2. Reset remaining "running" agents to "created"
	 *
	 * Returns counts for notification purposes.
	 */
	async reconcileOnActivation(): Promise<{
		resetCount: number;
		orphanedAgentCount: number;
	}> {
		const registry = this.getRegistry();
		let changed = false;

		// Step 1: Cross-reference agents with worktree manifests
		const orphanedIndices = new Set<number>();
		for (let i = 0; i < registry.length; i++) {
			const agent = registry[i];
			const manifest = this.worktreeService.getManifest(agent.repoPath);
			const hasWorktree = manifest.some((w) => w.agentName === agent.agentName);
			if (!hasWorktree) {
				orphanedIndices.add(i);
			}
		}

		const orphanedAgentCount = orphanedIndices.size;

		// Remove orphaned agents (iterate in reverse to maintain indices)
		if (orphanedAgentCount > 0) {
			const sortedIndices = [...orphanedIndices].sort((a, b) => b - a);
			for (const idx of sortedIndices) {
				registry.splice(idx, 1);
			}
			changed = true;
		}

		// Step 2: Reset "running" agents to "created"
		let resetCount = 0;
		for (const agent of registry) {
			if (agent.status === "running") {
				agent.status = "created";
				agent.exitCode = undefined;
				resetCount++;
				changed = true;
			}
		}

		if (changed) {
			await this.saveRegistry(registry);
			this._onDidChangeAgents.fire();
		}

		return { resetCount, orphanedAgentCount };
	}

	/**
	 * Cleans up orphan processes from previous sessions.
	 * Reads the PID registry, checks each PID, kills alive ones, clears the registry.
	 * Returns the number of processes successfully killed.
	 */
	async cleanupOrphanProcesses(): Promise<number> {
		const pidMap = this.requireTerminalService().getAllPids();
		let killedCount = 0;

		for (const [, pid] of Object.entries(pidMap)) {
			if (isProcessAlive(pid)) {
				try {
					process.kill(pid, "SIGTERM");
					killedCount++;
				} catch {
					// EPERM or other error -- process exists but we can't kill it
					// Count as not killed, continue
				}
			}
		}

		await this.requireTerminalService().clearAllPids();
		return killedCount;
	}

	/**
	 * Stores the last-focused agent compound key in Memento.
	 */
	async setLastFocused(repoPath: string, agentName: string): Promise<void> {
		await this.state.update(LAST_FOCUSED_KEY, `${repoPath}::${agentName}`);
	}

	/**
	 * Returns the last-focused agent compound key from Memento, or undefined.
	 */
	getLastFocused(): string | undefined {
		return this.state.get<string>(LAST_FOCUSED_KEY);
	}

	/**
	 * Disposes the change event emitter. Called on extension deactivation.
	 */
	dispose(): void {
		this._onDidChangeAgents.dispose();
	}

	private requireTerminalService(): TerminalService {
		if (!this.terminalService) {
			throw new Error(
				"TerminalService not set. Call setTerminalService() before using focusAgent or deleteAgent.",
			);
		}
		return this.terminalService;
	}
}
