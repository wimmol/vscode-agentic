import { describe, expect, it, vi } from "vitest";

// Mock the child_process module BEFORE importing GitService
vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

describe("GitService", () => {
	// Real tests will be added in Plan 02 when GitService is implemented.
	// This skeleton ensures the test infrastructure is wired and discoverable.

	it("placeholder: test infrastructure is wired", () => {
		expect(true).toBe(true);
	});

	// Plan 02 will add:
	// - executes git commands and returns trimmed stdout
	// - throws GitError with stderr on failure
	// - branchExists returns true for existing branch
	// - branchExists returns false for non-existing branch
	// - respects timeout configuration
});
