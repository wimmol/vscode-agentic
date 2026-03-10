import type { AgentData } from "../types";
import { StatusIcon } from "../atoms/StatusIcon";
import { ActionButton } from "../atoms/ActionButton";
import { ElapsedTimer } from "../atoms/ElapsedTimer";

interface AgentTileProps {
	agent: AgentData;
	onFocus: () => void;
	onStop: () => void;
	onDelete: () => void;
}

export const AgentTile = ({ agent, onFocus, onStop, onDelete }: AgentTileProps) => {
	const isRunning = agent.status === "running";

	return (
		<div
			className="agent-tile"
			data-status={agent.status}
			onClick={onFocus}
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
					onClick={onStop}
				/>
				<ActionButton
					icon="trash"
					title="Delete Agent"
					onClick={onDelete}
				/>
			</div>
		</div>
	);
};
