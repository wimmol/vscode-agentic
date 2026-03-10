// Webview entry point -- React app mounted here
// Bundled by esbuild into dist/webview.js

import { createRoot } from "react-dom/client";
import { Dashboard } from "./components/Dashboard";
import { useDashboardData } from "./hooks/useDashboardData";
import { useRepoActions } from "./hooks/useRepoActions";
import { useAgentActions } from "./hooks/useAgentActions";

const App = () => {
	const { data, onRootGlobal, onAddRepo } = useDashboardData();
	const { collapsedRepos, getRepoCallbacks } = useRepoActions();
	const { getAgentCallbacks } = useAgentActions();

	return (
		<Dashboard
			data={data}
			onRootGlobal={onRootGlobal}
			onAddRepo={onAddRepo}
			collapsedRepos={collapsedRepos}
			getRepoCallbacks={getRepoCallbacks}
			getAgentCallbacks={getAgentCallbacks}
		/>
	);
};

const rootEl = document.getElementById("root");
if (rootEl) {
	console.log("[agenticTab] mounting React root");
	const root = createRoot(rootEl);
	root.render(<App />);
} else {
	console.error("[agenticTab] #root element not found");
}
