export type AgentStatus = "created" | "running" | "finished" | "error";

export interface AgentEntry {
	agentName: string;
	repoPath: string;
	status: AgentStatus;
	initialPrompt?: string;
	createdAt: string;
	finishedAt?: string;
	exitCode?: number;
}

export const AGENT_REGISTRY_KEY = "vscode-agentic.agentRegistry";
