// Shared types for webview data -- mirrors the DashboardData shape sent by the extension host

export interface AgentData {
	agentName: string;
	repoPath: string;
	status: "created" | "running" | "finished" | "error";
	initialPrompt?: string;
	createdAt: string;
	finishedAt?: string;
	exitCode?: number;
}

export interface RepoData {
	path: string;
	name: string;
	agents: AgentData[];
}

export interface DashboardData {
	repos: RepoData[];
	scope: string;
}
