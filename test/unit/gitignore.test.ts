import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { ensureGitignoreEntry } from "../../src/utils/gitignore";

describe("ensureGitignoreEntry", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gitignore-test-"));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("creates .gitignore if it does not exist", async () => {
		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
		expect(content).toContain("# VS Code Agentic worktrees");
		expect(content).toContain(".worktrees/");
	});

	it("appends entry to existing .gitignore", async () => {
		const gitignorePath = path.join(tmpDir, ".gitignore");
		await fs.writeFile(gitignorePath, "node_modules/\ndist/\n");

		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(gitignorePath, "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain("dist/");
		expect(content).toContain("# VS Code Agentic worktrees");
		expect(content).toContain(".worktrees/");
	});

	it("does not duplicate entry if already present", async () => {
		const gitignorePath = path.join(tmpDir, ".gitignore");
		await fs.writeFile(gitignorePath, "node_modules/\n.worktrees/\n");

		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(gitignorePath, "utf-8");
		const matches = content.match(/\.worktrees\//g);
		expect(matches).toHaveLength(1);
	});

	it("handles file without trailing newline", async () => {
		const gitignorePath = path.join(tmpDir, ".gitignore");
		await fs.writeFile(gitignorePath, "node_modules/\ndist/");

		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(gitignorePath, "utf-8");
		expect(content).toContain(".worktrees/");
		// Should not have the entry glued to the previous line
		const lines = content.split("\n");
		const worktreeLine = lines.find((l) => l.trim() === ".worktrees/");
		expect(worktreeLine).toBeDefined();
	});

	it("handles file with .worktrees (no trailing slash) as already present", async () => {
		const gitignorePath = path.join(tmpDir, ".gitignore");
		await fs.writeFile(gitignorePath, "node_modules/\n.worktrees\n");

		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(gitignorePath, "utf-8");
		// Should not add a duplicate
		const worktreeMatches = content.match(/\.worktrees/g);
		expect(worktreeMatches).toHaveLength(1);
	});
});
