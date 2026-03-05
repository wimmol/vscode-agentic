import { describe, expect, it } from "vitest";
import { parseWorktreeList } from "../../src/utils/worktree-parser";

describe("parseWorktreeList", () => {
	it("returns empty array for empty input", () => {
		expect(parseWorktreeList("")).toEqual([]);
		expect(parseWorktreeList("  \n  ")).toEqual([]);
	});

	it("parses a single worktree entry with branch", () => {
		const input = [
			"worktree /home/user/repo",
			"HEAD abc123def456789012345678901234567890abcd",
			"branch refs/heads/main",
			"",
		].join("\n");

		const result = parseWorktreeList(input);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			path: "/home/user/repo",
			head: "abc123def456789012345678901234567890abcd",
			branch: "main",
			locked: false,
			prunable: false,
		});
	});

	it("strips refs/heads/ prefix from branch names", () => {
		const input = [
			"worktree /home/user/repo",
			"HEAD abc123",
			"branch refs/heads/feature/my-branch",
			"",
		].join("\n");

		const result = parseWorktreeList(input);
		expect(result[0].branch).toBe("feature/my-branch");
	});

	it("parses a detached HEAD worktree (branch is null)", () => {
		const input = [
			"worktree /home/user/repo/.worktrees/detached",
			"HEAD def456",
			"detached",
			"",
		].join("\n");

		const result = parseWorktreeList(input);
		expect(result).toHaveLength(1);
		expect(result[0].branch).toBeNull();
		expect(result[0].path).toBe("/home/user/repo/.worktrees/detached");
	});

	it("parses locked flag", () => {
		const input = [
			"worktree /home/user/repo/.worktrees/locked-wt",
			"HEAD aaa111",
			"branch refs/heads/locked-branch",
			"locked",
			"",
		].join("\n");

		const result = parseWorktreeList(input);
		expect(result[0].locked).toBe(true);
		expect(result[0].prunable).toBe(false);
	});

	it("parses prunable flag", () => {
		const input = [
			"worktree /home/user/repo/.worktrees/prunable-wt",
			"HEAD bbb222",
			"branch refs/heads/prunable-branch",
			"prunable",
			"",
		].join("\n");

		const result = parseWorktreeList(input);
		expect(result[0].prunable).toBe(true);
		expect(result[0].locked).toBe(false);
	});

	it("parses locked and prunable flags together", () => {
		const input = [
			"worktree /home/user/repo/.worktrees/both-wt",
			"HEAD ccc333",
			"branch refs/heads/both-branch",
			"locked",
			"prunable",
			"",
		].join("\n");

		const result = parseWorktreeList(input);
		expect(result[0].locked).toBe(true);
		expect(result[0].prunable).toBe(true);
	});

	it("parses multiple worktree blocks separated by blank lines", () => {
		const input = [
			"worktree /home/user/repo",
			"HEAD aaa111",
			"branch refs/heads/main",
			"",
			"worktree /home/user/repo/.worktrees/agent-1",
			"HEAD bbb222",
			"branch refs/heads/agent-1",
			"",
			"worktree /home/user/repo/.worktrees/agent-2",
			"HEAD ccc333",
			"branch refs/heads/agent-2",
			"locked",
			"",
		].join("\n");

		const result = parseWorktreeList(input);
		expect(result).toHaveLength(3);
		expect(result[0].path).toBe("/home/user/repo");
		expect(result[0].branch).toBe("main");
		expect(result[1].path).toBe("/home/user/repo/.worktrees/agent-1");
		expect(result[1].branch).toBe("agent-1");
		expect(result[2].path).toBe("/home/user/repo/.worktrees/agent-2");
		expect(result[2].locked).toBe(true);
	});
});
