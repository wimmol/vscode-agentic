import { describe, expect, it } from "vitest";
import { createMockMemento } from "../__mocks__/vscode";

describe("WorktreeService", () => {
	// Real tests will be added in Plan 02:
	// - create worktree with new branch
	// - worktree path follows .worktrees/<agentName>/ convention
	// - .gitignore guard called before git worktree add
	// - limit enforcement: creation refused at limit
	// - reconciliation: orphaned-in-manifest entries removed
	// - reconciliation: orphaned-on-disk worktrees cleaned
	// - concurrent guard: mutex prevents double-create

	it("placeholder: mock memento works for worktree manifest", () => {
		const memento = createMockMemento();
		memento.update("test-key", [{ path: "/test" }]);
		expect(memento.get("test-key")).toEqual([{ path: "/test" }]);
	});
});
