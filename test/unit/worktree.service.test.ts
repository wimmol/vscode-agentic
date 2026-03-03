import { describe, expect, it } from "vitest";

describe("WorktreeService", () => {
	// Real tests will be added in Plan 02 when WorktreeService is implemented.
	// This skeleton ensures the test infrastructure is wired and discoverable.

	it("placeholder: test infrastructure is wired", () => {
		expect(true).toBe(true);
	});

	// Plan 02 will add:
	// - creates worktree with correct path convention
	// - enforces worktree limit per repo
	// - refuses creation when limit reached
	// - reconciliation detects orphaned-in-manifest entries
	// - reconciliation detects orphaned-on-disk entries
	// - reconciliation handles clean state (no changes)
});
