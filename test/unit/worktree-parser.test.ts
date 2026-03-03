import { describe, expect, it } from "vitest";

describe("parseWorktreeList", () => {
	// Real tests will be added in Plan 02 when the parser is implemented.
	// This is a pure function test -- no mocks needed.

	it("placeholder: test infrastructure is wired", () => {
		expect(true).toBe(true);
	});

	// Plan 02 will add:
	// - parses single worktree (main only)
	// - parses multiple worktrees with branches
	// - handles detached HEAD worktree
	// - handles locked worktree
	// - handles prunable worktree
	// - handles empty output
});
