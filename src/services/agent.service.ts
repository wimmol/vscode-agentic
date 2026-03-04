import * as vscode from "vscode";
import type { AgentEntry, AgentStatus } from "../models/agent.js";
import { AGENT_REGISTRY_KEY, LAST_FOCUSED_KEY } from "../models/agent.js";
import type { TerminalService } from "./terminal.service.js";
import type { WorktreeService } from "./worktree.service.js";

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
		return this.getRegistry().find(
			(e) => e.repoPath === repoPath && e.agentName === agentName,
		);
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
	 * Focuses an agent: lazily creates a terminal (or shows existing one).
	 * - Status "created"/"finished"/"error": create terminal, update to "running"
	 * - Status "running": show existing terminal
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
		const agent = registry.find(
			(e) => e.repoPath === repoPath && e.agentName === agentName,
		);
		if (!agent) {
			return;
		}

		agent.status = status;
		agent.exitCode = exitCode;
		await this.saveRegistry(registry);
		this._onDidChangeAgents.fire();
	}

	/**
	 * On extension activation, resets any "running" agents to "created"
	 * because terminals are lost on VS Code restart.
	 */
	async reconcileOnActivation(): Promise<void> {
		const registry = this.getRegistry();
		let changed = false;

		for (const agent of registry) {
			if (agent.status === "running") {
				agent.status = "created";
				agent.exitCode = undefined;
				changed = true;
			}
		}

		if (changed) {
			await this.saveRegistry(registry);
			this._onDidChangeAgents.fire();
		}
	}

	/**
	 * Stores the last-focused agent compound key in Memento.
	 */
	async setLastFocused(
		repoPath: string,
		agentName: string,
	): Promise<void> {
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
