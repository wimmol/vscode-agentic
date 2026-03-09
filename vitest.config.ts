import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/unit/**/*.test.ts", "test/unit/**/*.test.tsx"],
		globals: true,
		environment: "node",
		alias: {
			// Resolve the virtual 'vscode' module to our manual mock
			vscode: new URL("./test/__mocks__/vscode.ts", import.meta.url).pathname,
		},
	},
});
