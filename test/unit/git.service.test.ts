import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted so the mock fn is available when vi.mock factory runs (hoisted)
const { mockExecFile } = vi.hoisted(() => ({
	mockExecFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	execFile: mockExecFile,
}));

import { GitError, GitService } from "../../src/services/git.service.js";

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
		});

		it("calls git with correct cwd, timeout, and maxBuffer", async () => {
			mockExecFile.mockImplementation(
				(
					_cmd: string,
					_args: string[],
					opts: { cwd: string; timeout: number; maxBuffer: number },
					cb: (err: null, result: { stdout: string; stderr: string }) => void,
				) => {
					expect(opts.cwd).toBe("/repo");
					expect(opts.timeout).toBe(30_000);
					expect(opts.maxBuffer).toBe(10 * 1024 * 1024);
					cb(null, { stdout: "", stderr: "" });
				},
			);

			await git.exec("/repo", ["log"]);
			expect(mockExecFile).toHaveBeenCalledWith(
				"git",
				["log"],
				expect.objectContaining({
					cwd: "/repo",
					timeout: 30_000,
					maxBuffer: 10 * 1024 * 1024,
				}),
				expect.any(Function),
			);
		});

		it("throws GitError with stderr on failure", async () => {
			const error = Object.assign(new Error("Command failed"), {
				stderr: "fatal: not a git repository",
				code: 128,
			});
			mockExecFile.mockImplementation(
				(_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
					cb(error);
				},
			);

			await expect(git.exec("/bad-repo", ["status"])).rejects.toThrow(GitError);
			await expect(git.exec("/bad-repo", ["status"])).rejects.toThrow(
				"fatal: not a git repository",
			);

			try {
				await git.exec("/bad-repo", ["status"]);
			} catch (e) {
				expect(e).toBeInstanceOf(GitError);
				const gitErr = e as GitError;
				expect(gitErr.args).toEqual(["status"]);
				expect(gitErr.exitCode).toBe(128);
			}
		});
	});

	describe("branchExists", () => {
		it("returns true when rev-parse succeeds", async () => {
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

		it("returns false when rev-parse fails", async () => {
			mockExecFile.mockImplementation(
				(_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
					cb(
						Object.assign(new Error("failed"), {
							stderr: "fatal: not a valid ref",
							code: 128,
						}),
					);
				},
			);

			const result = await git.branchExists("/repo", "nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("PERF-04: no sync calls", () => {
		it("does NOT contain execFileSync or spawnSync", () => {
			const sourceFile = resolve(__dirname, "../../src/services/git.service.ts");
			const source = readFileSync(sourceFile, "utf-8");
			expect(source).not.toContain("execFileSync");
			expect(source).not.toContain("spawnSync");
		});
	});
});
