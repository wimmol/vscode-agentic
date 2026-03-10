import { useState } from "react";
import type { RepoData } from "../types";
import { AgentTile } from "./AgentTile";
import { ActionButton } from "../atoms/ActionButton";
import { postCommand } from "../hooks/useVsCodeApi";

export const RepoSection = ({ repo, scope }: { repo: RepoData; scope: string }) => {
	const [collapsed, setCollapsed] = useState(false);
	const isScopeActive = scope === `repo:${repo.path}`;

	console.log("[RepoSection] render", repo.name, repo.agents.length, "agents");

	const handleRoot = () => {
		console.log("[RepoSection] rootRepo", repo.path);
		postCommand("rootRepo", { repoPath: repo.path });
	};

	const handleCreate = () => {
		console.log("[RepoSection] createAgent", repo.path);
		postCommand("createAgent", { repoPath: repo.path });
	};

	const handleRemove = () => {
		console.log("[RepoSection] removeRepo", repo.path);
		postCommand("removeRepo", { repoPath: repo.path });
	};

	return (
		<div className={`repo-section${collapsed ? " collapsed" : ""}`}>
			<div className="repo-header">
				<button
					className="collapse-btn"
					title="Toggle section"
					onClick={() => setCollapsed(!collapsed)}
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
						onClick={handleRoot}
					>
						<span className="codicon codicon-root-folder" />
					</button>
					<ActionButton icon="add" title="Create Agent" onClick={handleCreate} />
					<ActionButton icon="close" title="Remove Repository" onClick={handleRemove} />
				</div>
			</div>
			{!collapsed && (
				<div className="repo-agents">
					{repo.agents.length === 0 ? (
						<div className="no-agents">No agents yet</div>
					) : (
						repo.agents.map((agent) => (
							<AgentTile key={agent.agentName} agent={agent} />
						))
					)}
				</div>
			)}
		</div>
	);
};
