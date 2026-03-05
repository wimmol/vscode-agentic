import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mock the child_process module BEFORE importing GitService
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
	execFile: mockExecFile,
}));

import { GitService, GitError } from "../../src/services/git.service";

describe("GitService", () => {
	let git: GitService;

	beforeEach(() => {
		vi.clearAllMocks();
		git = new GitService();
	});

	describe("exec", () => {
		it("returns trimmed stdout on success", async () => {
			mockExecFile.mockImplementation(
				(
					_cmd: string,
					_args: string[],
					_opts: unknown,
					cb: (err: null, result: { stdout: string; stderr: string }) => void,
				) => {
					cb(null, { stdout: "  hello world  \n", stderr: "" });
				},
			);

			const result = await git.exec("/repo", ["status"]);
			expect(result).toBe("hello world");
			expect(mockExecFile).toHaveBeenCalledWith(
				"git",
				["status"],
				expect.objectContaining({ cwd: "/repo", timeout: 30_000 }),
				expect.any(Function),
			);
		});

		it("throws GitError with stderr message on failure", async () => {
			const error = Object.assign(new Error("command failed"), {
				stderr: "fatal: not a git repository",
				code: 128,
			});
			mockExecFile.mockImplementation(
				(_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
					cb(error);
				},
			);

			await expect(git.exec("/repo", ["status"])).rejects.toThrow(GitError);
			await expect(git.exec("/repo", ["status"])).rejects.toThrow(
				"fatal: not a git repository",
			);

			try {
				await git.exec("/repo", ["status"]);
			} catch (e) {
				expect(e).toBeInstanceOf(GitError);
				const gitErr = e as GitError;
				expect(gitErr.args).toEqual(["status"]);
				expect(gitErr.exitCode).toBe(128);
			}
		});

		it("uses 10MB maxBuffer", async () => {
			mockExecFile.mockImplementation(
				(
					_cmd: string,
					_args: string[],
					opts: { maxBuffer: number },
					cb: (err: null, result: { stdout: string; stderr: string }) => void,
				) => {
					expect(opts.maxBuffer).toBe(10 * 1024 * 1024);
					cb(null, { stdout: "", stderr: "" });
				},
			);

			await git.exec("/repo", ["log"]);
		});
	});

	describe("branchExists", () => {
		it("returns true when branch exists", async () => {
			mockExecFile.mockImplementation(
				(
					_cmd: string,
					_args: string[],
					_opts: unknown,
					cb: (err: null, result: { stdout: string; stderr: string }) => void,
				) => {
					cb(null, { stdout: "abc123\n", stderr: "" });
				},
			);

			const result = await git.branchExists("/repo", "main");
			expect(result).toBe(true);
			expect(mockExecFile).toHaveBeenCalledWith(
				"git",
				["rev-parse", "--verify", "refs/heads/main"],
				expect.any(Object),
				expect.any(Function),
			);
		});

		it("returns false when branch does not exist", async () => {
			const error = Object.assign(new Error("command failed"), {
				stderr: "fatal: Needed a single revision",
				code: 128,
			});
			mockExecFile.mockImplementation(
				(_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
					cb(error);
				},
			);

			const result = await git.branchExists("/repo", "nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("PERF-04: no sync calls", () => {
		it("module does NOT contain execFileSync or spawnSync", () => {
			const source = readFileSync(
				resolve(__dirname, "../../src/services/git.service.ts"),
				"utf-8",
			);
			expect(source).not.toContain("execFileSync");
			expect(source).not.toContain("spawnSync");
		});
	});
});
