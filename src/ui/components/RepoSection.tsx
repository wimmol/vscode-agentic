import type { RepoData } from "../types";
import type { AgentCallbacks } from "../hooks/useAgentActions";
import { AgentTile } from "./AgentTile";
import { ActionButton } from "../atoms/ActionButton";

interface RepoSectionProps {
	repo: RepoData;
	scope: string;
	collapsed: boolean;
	onRoot: () => void;
	onCreate: () => void;
	onRemove: () => void;
	onToggleCollapse: () => void;
	getAgentCallbacks: (repoPath: string, agentName: string) => AgentCallbacks;
}

export const RepoSection = ({
	repo,
	scope,
	collapsed,
	onRoot,
	onCreate,
	onRemove,
	onToggleCollapse,
	getAgentCallbacks,
}: RepoSectionProps) => {
	const isScopeActive = scope === `repo:${repo.path}`;

	console.log("[RepoSection] render", repo.name, repo.agents.length, "agents");

	return (
		<div className={`repo-section${collapsed ? " collapsed" : ""}`}>
			<div className="repo-header">
				<button
					className="collapse-btn"
					title="Toggle section"
					onClick={onToggleCollapse}
				>
					<span className="codicon codicon-chevron-down" />
				</button>
				<span className="repo-name">{repo.name}</span>
				{repo.agents.some((a) => a.status === "running") && (
					<span className="active-dot" />
				)}
				<div className="repo-actions">
					<button
						className={`repo-action-btn${isScopeActive ? " scope-active" : ""}`}
						title="Show Repo Root"
						onClick={onRoot}
					>
						<span className="codicon codicon-root-folder" />
					</button>
					<ActionButton icon="add" title="Create Agent" onClick={onCreate} />
					<ActionButton icon="close" title="Remove Repository" onClick={onRemove} />
				</div>
			</div>
			{!collapsed && (
				<div className="repo-agents">
					{repo.agents.length === 0 ? (
						<div className="no-agents">No agents yet</div>
					) : (
						repo.agents.map((agent) => (
							<AgentTile
								key={agent.agentName}
								agent={agent}
								{...getAgentCallbacks(agent.repoPath, agent.agentName)}
							/>
						))
					)}
				</div>
			)}
		</div>
	);
};
