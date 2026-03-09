import * as vscode from "vscode";
import type { AgentEntry, AgentStatus } from "../models/agent.js";
import { AGENT_REGISTRY_KEY } from "../models/agent.js";
import type { TerminalService } from "./terminal.service.js";
import type { WorktreeService } from "./worktree.service.js";

/**
 * Orchestrates agent lifecycle: create, delete, focus, status management, and reconciliation.
 *
 * Delegates git operations to WorktreeService and terminal management to TerminalService.
 * Persists agent registry in VS Code Memento (globalState).
 */
export class AgentService { 
	private terminalService: TerminalService | undefined;
	private readonly _onDidChange = new vscode.EventEmitter<void>();
	readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

	constructor(
		private readonly state: vscode.Memento,
		private readonly worktreeService: WorktreeService,
	) {}

	/**
	 * Dispose resources held by this service (EventEmitter).
	 */
	dispose(): void {
		this._onDidChange.dispose();
	}

	/**
	 * Set the TerminalService reference.
	 * Required before calling focusAgent or deleteAgent.
	 * Separated from constructor to break circular dependency with TerminalService's status callback.
	 */
	setTerminalService(ts: TerminalService): void {
		this.terminalService = ts;
	}

	private requireTerminalService(): TerminalService {
		if (!this.terminalService) {
			throw new Error("TerminalService not set. Call setTerminalService() before using focusAgent or deleteAgent.");
		}
		return this.terminalService;
	}

	private getRegistry(): AgentEntry[] {
		return this.state.get<AgentEntry[]>(AGENT_REGISTRY_KEY, []);
	}

	private async saveRegistry(entries: AgentEntry[]): Promise<void> {
		await this.state.update(AGENT_REGISTRY_KEY, entries);
	}

	/**
	 * Create a new agent with a git worktree and persist it with status "created".
	 */
	async createAgent(repoPath: string, agentName: string, initialPrompt?: string): Promise<AgentEntry> {
		console.log("[AgentService.createAgent]", { repoPath, agentName, initialPrompt });
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

		this._onDidChange.fire();
		return entry;
	}

	/**
	 * Get an agent by repoPath and agentName.
	 */
	getAgent(repoPath: string, agentName: string): AgentEntry | undefined {
		const agent = this.getRegistry().find((e) => e.repoPath === repoPath && e.agentName === agentName);
		console.log("[AgentService.getAgent]", { repoPath, agentName, found: !!agent, status: agent?.status });
		return agent;
	}

	/**
	 * Get all agent entries across all repos.
	 */
	getAll(): AgentEntry[] {
		const all = this.getRegistry();
		console.log("[AgentService.getAll]", { count: all.length });
		return all;
	}

	/**
	 * Get agents for a specific repo.
	 */
	getForRepo(repoPath: string): AgentEntry[] {
		const agents = this.getRegistry().filter((e) => e.repoPath === repoPath);
		console.log("[AgentService.getForRepo]", { repoPath, count: agents.length });
		return agents;
	}

	/**
	 * Delete an agent: dispose terminal, remove worktree+branch, remove from registry.
	 * No-op if agent does not exist.
	 */
	async deleteAgent(repoPath: string, agentName: string): Promise<void> {
		console.log("[AgentService.deleteAgent]", { repoPath, agentName });
		const ts = this.requireTerminalService();
		const registry = this.getRegistry();
		const index = registry.findIndex((e) => e.repoPath === repoPath && e.agentName === agentName);

		if (index === -1) {
			return;
		}

		ts.disposeTerminal(repoPath, agentName);
		await this.worktreeService.removeWorktree(repoPath, agentName);

		const updated = registry.filter((_, i) => i !== index);
		await this.saveRegistry(updated);

		this._onDidChange.fire();
	}

	/**
	 * Focus an agent: lazily create a terminal (or show existing one).
	 * Transitions status to "running" when creating a new terminal.
	 */
	async focusAgent(repoPath: string, agentName: string): Promise<void> {
		console.log("[AgentService.focusAgent]", { repoPath, agentName });
		const ts = this.requireTerminalService();
		const agent = this.getAgent(repoPath, agentName);
		if (!agent) {
			console.log("[AgentService.focusAgent] agent not found, returning");
			return;
		}

		if (agent.status === "running") {
			console.log("[AgentService.focusAgent] already running, showing terminal");
			ts.showTerminal(repoPath, agentName);
			return;
		}

		// Status is "created", "finished", or "error" -- create a new terminal
		console.log("[AgentService.focusAgent] status=%s, creating terminal", agent.status);
		const manifest = this.worktreeService.getManifest(repoPath);
		const worktreeEntry = manifest.find((w) => w.agentName === agentName);
		if (!worktreeEntry) {
			return;
		}

		const terminal = ts.createTerminal(repoPath, agentName, worktreeEntry.path, agent.initialPrompt);
		terminal.show();
		await this.updateStatus(repoPath, agentName, "running");
	}

	/**
	 * Update an agent's status and optional exit code in the registry.
	 */
	async updateStatus(repoPath: string, agentName: string, status: AgentStatus, exitCode?: number): Promise<void> {
		console.log("[AgentService.updateStatus]", { repoPath, agentName, status, exitCode });
		const registry = this.getRegistry();
		const entry = registry.find((e) => e.repoPath === repoPath && e.agentName === agentName);
		if (!entry) {
			return;
		}

		entry.status = status;
		entry.exitCode = exitCode;

		if (status === "finished" || status === "error") {
			entry.finishedAt = new Date().toISOString();
		} else {
			entry.finishedAt = undefined;
		}

		await this.saveRegistry(registry);
		this._onDidChange.fire();
	}

	/**
	 * On extension activation, reset all "running" agents to "created" since terminals are lost on restart.
	 */
	async reconcileOnActivation(): Promise<void> {
		console.log("[AgentService.reconcileOnActivation]");
		const registry = this.getRegistry();
		let changed = false;

		for (const entry of registry) {
			if (entry.status === "running") {
				entry.status = "created";
				entry.exitCode = undefined;
				changed = true;
			}
		}

		if (changed) {
			await this.saveRegistry(registry);
			this._onDidChange.fire();
		}
	}
}
