import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Integration", () => {
	test("extension should activate", async () => {
		const ext = vscode.extensions.getExtension("vscode-agentic.vscode-agentic");
		assert.ok(ext, "Extension should be found");
		// Extension activation will be tested in Phase 1 Plan 03 checkpoint
	});
});
