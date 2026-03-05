import { describe, expect, it, vi } from "vitest";

// Mock the child_process module BEFORE importing GitService
vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

describe("GitService", () => {
	// Real tests will be added in Plan 02:
	// - exec() returns trimmed stdout
	// - exec() throws GitError with stderr on failure
	// - branchExists() returns true for existing branch
	// - branchExists() returns false for non-existing branch
	// - timeout is enforced on long operations

	it("placeholder: service module will be testable", () => {
		expect(true).toBe(true);
	});
});
