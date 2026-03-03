import { describe, expect, it } from "vitest";
import { parseWorktreeList } from "../../src/utils/worktree-parser.js";

describe("parseWorktreeList", () => {
	it("returns empty array for empty input", () => {
		expect(parseWorktreeList("")).toEqual([]);
	});

	it("returns empty array for whitespace-only input", () => {
		expect(parseWorktreeList("  \n  \n")).toEqual([]);
	});

	it("parses a single worktree entry with branch", () => {
		const output = [
			"worktree /home/user/repo",
			"HEAD abc1234567890abcdef1234567890abcdef123456",
			"branch refs/heads/main",
			"",
		].join("\n");

		const result = parseWorktreeList(output);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			path: "/home/user/repo",
			head: "abc1234567890abcdef1234567890abcdef123456",
			branch: "main",
			locked: false,
			prunable: false,
		});
	});

	it("strips refs/heads/ prefix from branch names", () => {
		const output = [
			"worktree /repo",
			"HEAD aaa",
			"branch refs/heads/feature/my-branch",
			"",
		].join("\n");

		const result = parseWorktreeList(output);
		expect(result[0].branch).toBe("feature/my-branch");
	});

	it("parses detached HEAD worktree (branch is null)", () => {
		const output = [
			"worktree /home/user/repo-detached",
			"HEAD def456",
			"detached",
			"",
		].join("\n");

		const result = parseWorktreeList(output);
		expect(result).toHaveLength(1);
		expect(result[0].branch).toBeNull();
		expect(result[0].path).toBe("/home/user/repo-detached");
	});

	it("parses locked flag", () => {
		const output = [
			"worktree /repo/locked-wt",
			"HEAD abc123",
			"branch refs/heads/locked-branch",
			"locked",
			"",
		].join("\n");

		const result = parseWorktreeList(output);
		expect(result[0].locked).toBe(true);
	});

	it("parses prunable flag", () => {
		const output = [
			"worktree /repo/prunable-wt",
			"HEAD abc123",
			"branch refs/heads/prunable-branch",
			"prunable",
			"",
		].join("\n");

		const result = parseWorktreeList(output);
		expect(result[0].prunable).toBe(true);
	});

	it("parses locked and prunable flags together", () => {
		const output = [
			"worktree /repo/both-wt",
			"HEAD abc123",
			"branch refs/heads/both-branch",
			"locked",
			"prunable",
			"",
		].join("\n");

		const result = parseWorktreeList(output);
		expect(result[0].locked).toBe(true);
		expect(result[0].prunable).toBe(true);
	});

	it("parses multiple worktree blocks separated by blank lines", () => {
		const output = [
			"worktree /home/user/repo",
			"HEAD abc123",
			"branch refs/heads/main",
			"",
			"worktree /home/user/repo/.worktrees/agent-1",
			"HEAD def456",
			"branch refs/heads/agent-1",
			"",
			"worktree /home/user/repo/.worktrees/agent-2",
			"HEAD 789abc",
			"detached",
			"locked",
			"",
		].join("\n");

		const result = parseWorktreeList(output);
		expect(result).toHaveLength(3);

		expect(result[0].path).toBe("/home/user/repo");
		expect(result[0].branch).toBe("main");
		expect(result[0].locked).toBe(false);

		expect(result[1].path).toBe("/home/user/repo/.worktrees/agent-1");
		expect(result[1].branch).toBe("agent-1");
		expect(result[1].locked).toBe(false);

		expect(result[2].path).toBe("/home/user/repo/.worktrees/agent-2");
		expect(result[2].branch).toBeNull();
		expect(result[2].locked).toBe(true);
	});
});
