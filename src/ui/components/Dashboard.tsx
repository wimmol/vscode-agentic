import { useState, useEffect } from "react";
import type { DashboardData } from "../types";
import { RepoSection } from "./RepoSection";
import { postCommand } from "../hooks/useVsCodeApi";

export function Dashboard() {
	const [data, setData] = useState<DashboardData | null>(null);

	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			const msg = event.data;
			if (msg.type === "update") {
				console.log("[Dashboard] received update", msg.data);
				setData(msg.data);
			}
		}
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, []);

	if (!data) {
		return <div className="dashboard">Loading...</div>;
	}

	return (
		<div className="dashboard">
			<div className="dashboard-toolbar">
				<button
					className="repo-action-btn"
					title="Show All Repos"
					onClick={() => {
						console.log("[Dashboard] rootGlobal");
						postCommand("rootGlobal");
					}}
				>
					<span className="codicon codicon-root-folder" />
				</button>
				<button
					className="repo-action-btn"
					title="Add Repository"
					onClick={() => {
						console.log("[Dashboard] addRepo");
						postCommand("addRepo");
					}}
				>
					<span className="codicon codicon-add" />
				</button>
			</div>
			{data.repos.map((repo) => (
				<RepoSection key={repo.path} repo={repo} scope={data.scope} />
			))}
		</div>
	);
}
