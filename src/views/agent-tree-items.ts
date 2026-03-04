import * as vscode from "vscode";
import type { AgentStatus } from "../models/agent.js";

/**
 * Maps agent status to a ThemeIcon with appropriate ThemeColor.
 */
export function getStatusIcon(status: AgentStatus): vscode.ThemeIcon {
	switch (status) {
		case "running":
			return new vscode.ThemeIcon(
				"circle-filled",
				new vscode.ThemeColor("testing.iconPassed"),
			);
		case "created":
			return new vscode.ThemeIcon(
				"circle-outline",
				new vscode.ThemeColor("disabledForeground"),
			);
		case "finished":
			return new vscode.ThemeIcon(
				"check",
				new vscode.ThemeColor("testing.iconPassed"),
			);
		case "error":
			return new vscode.ThemeIcon(
				"warning",
				new vscode.ThemeColor("testing.iconFailed"),
			);
		case "suspended":
			return new vscode.ThemeIcon(
				"debug-pause",
				new vscode.ThemeColor("disabledForeground"),
			);
	}
}

/**
 * Truncates a string to the given max length, appending "..." if truncated.
 */
function truncate(str: string, max: number): string {
	if (str.length <= max) {
		return str;
	}
	return `${str.slice(0, max)}...`;
}

/**
 * TreeItem representing a repository group header in the agent sidebar.
 * Collapsible parent node; children are AgentTreeItem leaves.
 */
export class RepoGroupItem extends vscode.TreeItem {
	readonly repoPath: string;

	constructor(repoPath: string) {
		const label = repoPath.split("/").pop() || repoPath;
		super(label, vscode.TreeItemCollapsibleState.Expanded);

		this.repoPath = repoPath;
		this.id = `repo:${repoPath}`;
		this.contextValue = "repoGroup";
		this.tooltip = repoPath;
		this.iconPath = new vscode.ThemeIcon("repo");
	}
}

/**
 * TreeItem representing a single agent in the sidebar.
 * Leaf node with status icon, description, and click-to-focus command.
 */
export class AgentTreeItem extends vscode.TreeItem {
	readonly agentName: string;
	readonly repoPath: string;

	constructor(
		agentName: string,
		repoPath: string,
		status: AgentStatus,
		initialPrompt?: string,
		hasDiffs?: boolean,
	) {
		super(agentName, vscode.TreeItemCollapsibleState.None);

		this.agentName = agentName;
		this.repoPath = repoPath;
		this.id = `agent:${repoPath}::${agentName}`;
		this.contextValue = hasDiffs ? "agentItemWithDiffs" : "agentItem";
		this.description = initialPrompt
			? truncate(initialPrompt, 40)
			: "Interactive session";
		this.iconPath = getStatusIcon(status);
		this.tooltip = `${agentName} (${status})\n${repoPath}`;
		this.command = {
			command: "vscode-agentic.focusAgentFromTile",
			title: "Focus Agent",
			arguments: [repoPath, agentName],
		};
	}
}
