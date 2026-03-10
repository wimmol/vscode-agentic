import { useState } from "react";
import { postCommand } from "./useVsCodeApi";

export interface RepoCallbacks {
	onRoot: () => void;
	onCreate: () => void;
	onRemove: () => void;
	onToggleCollapse: () => void;
}

export const useRepoActions = () => {
	const [collapsedRepos, setCollapsedRepos] = useState<Record<string, boolean>>({});

	const getRepoCallbacks = (repoPath: string): RepoCallbacks => ({
		onRoot: () => {
			console.log("[RepoSection] rootRepo", repoPath);
			postCommand("rootRepo", { repoPath });
		},
		onCreate: () => {
			console.log("[RepoSection] createAgent", repoPath);
			postCommand("createAgent", { repoPath });
		},
		onRemove: () => {
			console.log("[RepoSection] removeRepo", repoPath);
			postCommand("removeRepo", { repoPath });
		},
		onToggleCollapse: () => {
			setCollapsedRepos((prev) => ({
				...prev,
				[repoPath]: !prev[repoPath],
			}));
		},
	});

	return { collapsedRepos, getRepoCallbacks };
};
