// Webview entry point -- React app mounted here
// Bundled by esbuild into dist/webview.js

import { createRoot } from "react-dom/client";
import { Dashboard } from "./components/Dashboard";

const rootEl = document.getElementById("root");
if (rootEl) {
	console.log("[agenticTab] mounting React root");
	const root = createRoot(rootEl);
	root.render(<Dashboard />);
} else {
	console.error("[agenticTab] #root element not found");
}
