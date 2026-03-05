import { describe, expect, it } from "vitest";
import { createMockMemento } from "../__mocks__/vscode";

describe("RepoConfigService", () => {
	// Real tests will be added in Plan 02:
	// - add repo with default staging branch "staging"
	// - add repo with custom staging branch name
	// - staging branch already exists: user confirms to use it
	// - staging branch already exists: user picks different name
	// - multiple repos stored independently
	// - retrieve config for specific repo path

	it("placeholder: mock memento works for repo configs", () => {
		const memento = createMockMemento();
		memento.update("configs", [{ path: "/repo", stagingBranch: "staging" }]);
		expect(memento.get("configs")).toEqual([{ path: "/repo", stagingBranch: "staging" }]);
	});
});
