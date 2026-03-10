import type { DashboardData } from "../types";
import type { RepoCallbacks } from "../hooks/useRepoActions";
import type { AgentCallbacks } from "../hooks/useAgentActions";
import { RepoSection } from "./RepoSection";

interface DashboardProps {
	data: DashboardData | null;
	onRootGlobal: () => void;
	onAddRepo: () => void;
	collapsedRepos: Record<string, boolean>;
	getRepoCallbacks: (repoPath: string) => RepoCallbacks;
	getAgentCallbacks: (repoPath: string, agentName: string) => AgentCallbacks;
}

export const Dashboard = ({
	data,
	onRootGlobal,
	onAddRepo,
	collapsedRepos,
	getRepoCallbacks,
	getAgentCallbacks,
}: DashboardProps) => {
	if (!data) {
		return <div className="dashboard">Loading...</div>;
	}

	return (
		<div className="dashboard">
			<div className="dashboard-toolbar">
				<button
					className="repo-action-btn"
					title="Show All Repos"
					onClick={onRootGlobal}
				>
					<span className="codicon codicon-root-folder" />
				</button>
				<button
					className="repo-action-btn"
					title="Add Repository"
					onClick={onAddRepo}
				>
					<span className="codicon codicon-add" />
				</button>
			</div>
			{data.repos.map((repo) => {
				const callbacks = getRepoCallbacks(repo.path);
				return (
					<RepoSection
						key={repo.path}
						repo={repo}
						scope={data.scope}
						collapsed={collapsedRepos[repo.path] ?? false}
						onRoot={callbacks.onRoot}
						onCreate={callbacks.onCreate}
						onRemove={callbacks.onRemove}
						onToggleCollapse={callbacks.onToggleCollapse}
						getAgentCallbacks={getAgentCallbacks}
					/>
				);
			})}
		</div>
	);
};
