import * as vscode from "vscode";
import type { AgentEntry } from "../models/agent.js";
import type { AgentService } from "../services/agent.service.js";
import { AgentTreeItem, RepoGroupItem } from "./agent-tree-items.js";

/** Status priority for sorting: lower number = higher priority */
const STATUS_PRIORITY: Record<string, number> = {
	running: 0,
	created: 1,
	finished: 2,
	error: 3,
};

/**
 * TreeDataProvider for the vscode-agentic.agents sidebar view.
 *
 * Two-level hierarchy:
 * - Root: RepoGroupItem per repo that has agents (derived from agentService.getAll())
 * - Children: AgentTreeItem per agent, sorted by status priority then alphabetical
 *
 * Auto-refreshes when AgentService fires onDidChangeAgents (debounced).
 */
export class AgentTreeProvider
	implements vscode.TreeDataProvider<RepoGroupItem | AgentTreeItem>
{
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private readonly agentChangeSubscription: { dispose(): void };
	private debounceTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly agentService: AgentService) {
		this.agentChangeSubscription = this.agentService.onDidChangeAgents(
			() => this.debouncedRefresh(),
		);
	}

	/**
	 * Fires onDidChangeTreeData to trigger a full tree refresh.
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	private debouncedRefresh(): void {
		if (this.debounceTimer !== undefined) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = undefined;
			this.refresh();
		}, 150);
	}

	getTreeItem(
		element: RepoGroupItem | AgentTreeItem,
	): RepoGroupItem | AgentTreeItem {
		return element;
	}

	getChildren(
		element?: RepoGroupItem | AgentTreeItem,
	): (RepoGroupItem | AgentTreeItem)[] {
		// Root level: return repo group items
		if (!element) {
			const agents = this.agentService.getAll();
			const repoMap = new Map<string, boolean>();
			for (const agent of agents) {
				repoMap.set(agent.repoPath, true);
			}
			return [...repoMap.keys()].map(
				(repoPath) => new RepoGroupItem(repoPath),
			);
		}

		// Agent item level: leaf nodes have no children
		if (element instanceof AgentTreeItem) {
			return [];
		}

		// Repo group level: return sorted agent items
		const repoAgents = this.agentService.getForRepo(element.repoPath);
		return this.sortAgents(repoAgents).map(
			(a) =>
				new AgentTreeItem(
					a.agentName,
					a.repoPath,
					a.status,
					a.initialPrompt,
				),
		);
	}

	getParent(
		element: RepoGroupItem | AgentTreeItem,
	): RepoGroupItem | undefined {
		if (element instanceof AgentTreeItem) {
			return new RepoGroupItem(element.repoPath);
		}
		return undefined;
	}

	private sortAgents(agents: AgentEntry[]): AgentEntry[] {
		return [...agents].sort((a, b) => {
			const priorityA = STATUS_PRIORITY[a.status] ?? 999;
			const priorityB = STATUS_PRIORITY[b.status] ?? 999;
			if (priorityA !== priorityB) {
				return priorityA - priorityB;
			}
			return a.agentName.localeCompare(b.agentName);
		});
	}

	/**
	 * Cleans up event subscriptions and the change event emitter.
	 */
	dispose(): void {
		if (this.debounceTimer !== undefined) {
			clearTimeout(this.debounceTimer);
		}
		this.agentChangeSubscription.dispose();
		this._onDidChangeTreeData.dispose();
	}
}
