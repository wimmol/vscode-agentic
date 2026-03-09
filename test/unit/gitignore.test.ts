import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { ensureGitignoreEntry } from "../../src/utils/gitignore";

describe("ensureGitignoreEntry", () => {
	const encoder = new TextEncoder();

	beforeEach(() => {
		vi.clearAllMocks();
		// Default: getConfiguration returns ".worktrees" for worktreeDirectoryName
		(vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
			get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates .gitignore if it does not exist", async () => {
		// readFile throws (file not found)
		(vscode.workspace.fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("FileNotFound"),
		);
		(vscode.workspace.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

		await ensureGitignoreEntry("/repo");

		expect(vscode.workspace.fs.writeFile).toHaveBeenCalledOnce();
		const writtenBytes = (vscode.workspace.fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
		const content = new TextDecoder().decode(writtenBytes);
		expect(content).toContain("# VS Code Agentic worktrees");
		expect(content).toContain(".worktrees/");
	});

	it("appends entry to existing .gitignore", async () => {
		const existing = "node_modules/\ndist/\n";
		(vscode.workspace.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			encoder.encode(existing),
		);
		(vscode.workspace.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

		await ensureGitignoreEntry("/repo");

		const writtenBytes = (vscode.workspace.fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
		const content = new TextDecoder().decode(writtenBytes);
		expect(content).toContain("node_modules/");
		expect(content).toContain("dist/");
		expect(content).toContain("# VS Code Agentic worktrees");
		expect(content).toContain(".worktrees/");
	});

	it("does not duplicate entry if already present", async () => {
		const existing = "node_modules/\n.worktrees/\n";
		(vscode.workspace.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			encoder.encode(existing),
		);

		await ensureGitignoreEntry("/repo");

		expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
	});

	it("handles file without trailing newline", async () => {
		const existing = "node_modules/\ndist/";
		(vscode.workspace.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			encoder.encode(existing),
		);
		(vscode.workspace.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

		await ensureGitignoreEntry("/repo");

		const writtenBytes = (vscode.workspace.fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
		const content = new TextDecoder().decode(writtenBytes);
		expect(content).toContain(".worktrees/");
		// Should have double newline separator since file didn't end with \n
		expect(content).toContain("dist/\n\n# VS Code Agentic worktrees");
	});

	it("handles file with .worktrees (no trailing slash) as already present", async () => {
		const existing = "node_modules/\n.worktrees\n";
		(vscode.workspace.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			encoder.encode(existing),
		);

		await ensureGitignoreEntry("/repo");

		expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
	});

	it("uses configured worktree directory name from settings", async () => {
		(vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
			get: vi.fn((_key: string, _defaultValue: unknown) => ".agents"),
		});
		(vscode.workspace.fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("FileNotFound"),
		);
		(vscode.workspace.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

		await ensureGitignoreEntry("/repo");

		const writtenBytes = (vscode.workspace.fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
		const content = new TextDecoder().decode(writtenBytes);
		expect(content).toContain(".agents/");
	});
});
