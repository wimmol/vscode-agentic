import { postCommand } from "./useVsCodeApi";

export interface AgentCallbacks {
	onFocus: () => void;
	onStop: () => void;
	onDelete: () => void;
}

export const useAgentActions = () => {
	const getAgentCallbacks = (repoPath: string, agentName: string): AgentCallbacks => ({
		onFocus: () => {
			console.log("[AgentTile] click -> focusAgent", repoPath, agentName);
			postCommand("focusAgent", { repoPath, agentName });
		},
		onStop: () => {
			console.log("[AgentTile] stopAgent", repoPath, agentName);
			postCommand("stopAgent", { repoPath, agentName });
		},
		onDelete: () => {
			console.log("[AgentTile] deleteAgent", repoPath, agentName);
			postCommand("deleteAgent", { repoPath, agentName });
		},
	});

	return { getAgentCallbacks };
};
