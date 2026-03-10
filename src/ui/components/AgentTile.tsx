import type { AgentData } from "../types";
import { StatusIcon } from "../atoms/StatusIcon";
import { ActionButton } from "../atoms/ActionButton";
import { ElapsedTimer } from "../atoms/ElapsedTimer";
import { postCommand } from "../hooks/useVsCodeApi";

export const AgentTile = ({ agent }: { agent: AgentData }) => {
	const isRunning = agent.status === "running";

	const handleTileClick = () => {
		console.log("[AgentTile] click -> focusAgent", agent.repoPath, agent.agentName);
		postCommand("focusAgent", { repoPath: agent.repoPath, agentName: agent.agentName });
	};

	const handleStop = () => {
		console.log("[AgentTile] stopAgent", agent.repoPath, agent.agentName);
		postCommand("stopAgent", { repoPath: agent.repoPath, agentName: agent.agentName });
	};

	const handleDelete = () => {
		console.log("[AgentTile] deleteAgent", agent.repoPath, agent.agentName);
		postCommand("deleteAgent", { repoPath: agent.repoPath, agentName: agent.agentName });
	};

	return (
		<div
			className="agent-tile"
			data-status={agent.status}
			onClick={handleTileClick}
		>
			<div className="tile-header">
				<StatusIcon status={agent.status} />
				<span className="agent-name">{agent.agentName}</span>
				<ElapsedTimer
					startedAt={agent.createdAt}
					finishedAt={agent.finishedAt}
					isRunning={isRunning}
				/>
			</div>
			{agent.initialPrompt && (
				<div className="tile-info" title={agent.initialPrompt}>
					{agent.initialPrompt}
				</div>
			)}
			<div className="tile-actions">
				<ActionButton
					icon="debug-stop"
					title="Stop Agent"
					disabled={!isRunning}
					onClick={handleStop}
				/>
				<ActionButton
					icon="trash"
					title="Delete Agent"
					onClick={handleDelete}
				/>
			</div>
		</div>
	);
};
