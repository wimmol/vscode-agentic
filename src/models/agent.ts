/**
 * Agent data model -- represents a named agent session backed by a git worktree.
 * Persisted in VS Code Memento (workspaceState) under AGENT_REGISTRY_KEY.
 */

/** Agent lifecycle status */
export type AgentStatus = "created" | "running" | "finished" | "error";

/** Persistent agent metadata stored per repo */
export interface AgentEntry {
	agentName: string; // unique per repo, matches WorktreeEntry.agentName
	repoPath: string; // parent repo path, matches WorktreeEntry.repoPath
	status: AgentStatus;
	initialPrompt?: string; // optional task description provided at creation
	createdAt: string; // ISO timestamp
	exitCode?: number; // set when terminal exits (undefined while running or created)
}

/** Memento key for the agent registry */
export const AGENT_REGISTRY_KEY = "vscode-agentic.agentRegistry";
