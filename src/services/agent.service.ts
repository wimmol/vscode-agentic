import type * as vscode from "vscode";
import type { AgentEntry, AgentStatus } from "../models/agent.js";
import { AGENT_REGISTRY_KEY } from "../models/agent.js";
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
	}

	/**
	 * Focuses an agent: lazily creates a terminal (or shows existing one).
	 * - Status "created"/"finished"/"error": create terminal, update to "running"
	 * - Status "running": show existing terminal
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

		this.requireTerminalService().createTerminal(
			repoPath,
			agentName,
			worktreeEntry.path,
			agent.initialPrompt,
		);

		await this.updateStatus(repoPath, agentName, "running");
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
		}
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
