import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { ensureGitignoreEntry } from "../../src/utils/gitignore.js";

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
		await fs.writeFile(path.join(tmpDir, ".gitignore"), "node_modules/\ndist/\n");

		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain("dist/");
		expect(content).toContain("# VS Code Agentic worktrees");
		expect(content).toContain(".worktrees/");
	});

	it("does not duplicate entry if already present", async () => {
		await fs.writeFile(
			path.join(tmpDir, ".gitignore"),
			"node_modules/\n.worktrees/\n",
		);

		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
		const matches = content.match(/\.worktrees\//g);
		expect(matches).toHaveLength(1);
	});

	it("handles file without trailing newline", async () => {
		await fs.writeFile(path.join(tmpDir, ".gitignore"), "node_modules/");

		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain(".worktrees/");
		// Should have a newline between the existing content and the new entry
		expect(content).toMatch(/node_modules\/\n/);
	});

	it("recognizes .worktrees (no trailing slash) as already present", async () => {
		await fs.writeFile(
			path.join(tmpDir, ".gitignore"),
			"node_modules/\n.worktrees\n",
		);

		await ensureGitignoreEntry(tmpDir);

		const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
		// Should NOT add another entry since .worktrees is already covered
		const matches = content.match(/\.worktrees/g);
		expect(matches).toHaveLength(1);
	});
});
