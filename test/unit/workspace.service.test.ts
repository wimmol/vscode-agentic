import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, workspace, Uri, window } from "../__mocks__/vscode";

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
	access: vi.fn().mockRejectedValue(new Error("ENOENT")),
}));

// Mock node:os
vi.mock("node:os", () => ({
	homedir: vi.fn(() => "/home/test"),
}));

import * as fs from "node:fs/promises";
import { WorkspaceService } from "../../src/services/workspace.service";

function createMockRepoConfigService() {
	return {
		getAll: vi.fn().mockReturnValue([]),
		getForRepo: vi.fn(),
		addRepo: vi.fn(),
		removeRepo: vi.fn(),
	};
}

describe("WorkspaceService", () => {
	let repoConfigService: ReturnType<typeof createMockRepoConfigService>;
	let service: WorkspaceService;

	beforeEach(() => {
		vi.clearAllMocks();
		repoConfigService = createMockRepoConfigService();
		service = new WorkspaceService(repoConfigService as never);

		// Reset workspace.workspaceFile for each test
		(workspace as any).workspaceFile = undefined;
	});

	describe("getWorkspaceFilePath", () => {
		it("returns path.join(os.homedir(), '.agentic', 'agentic.code-workspace')", () => {
			const result = service.getWorkspaceFilePath();
			expect(result).toBe("/home/test/.agentic/agentic.code-workspace");
		});
	});

	describe("isInWorkspaceMode", () => {
		it("returns true when vscode.workspace.workspaceFile is a file:// URI ending in agentic.code-workspace", () => {
			(workspace as any).workspaceFile = {
				fsPath: "/home/test/.agentic/agentic.code-workspace",
				scheme: "file",
			};
			expect(service.isInWorkspaceMode()).toBe(true);
		});

		it("returns false when workspaceFile is undefined", () => {
			(workspace as any).workspaceFile = undefined;
			expect(service.isInWorkspaceMode()).toBe(false);
		});

		it("returns false when workspaceFile has untitled: scheme", () => {
			(workspace as any).workspaceFile = {
				fsPath: "untitled:something",
				scheme: "untitled",
			};
			expect(service.isInWorkspaceMode()).toBe(false);
		});
	});

	describe("ensureWorkspaceFile", () => {
		it("creates ~/.agentic/ directory and agentic.code-workspace with correct JSON structure", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			// Simulate file not existing
			(fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("ENOENT"));

			const result = await service.ensureWorkspaceFile();

			expect(result).toBe(true);
			expect(fs.mkdir).toHaveBeenCalledWith("/home/test/.agentic", { recursive: true });
			expect(fs.writeFile).toHaveBeenCalledWith(
				"/home/test/.agentic/agentic.code-workspace",
				expect.any(String),
				"utf-8",
			);

			// Verify JSON structure
			const writtenContent = (fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
			const parsed = JSON.parse(writtenContent);
			expect(parsed.folders).toEqual([
				{ path: "/repos/my-app", name: "my-app" },
			]);
			expect(parsed.settings).toEqual({});
		});

		it("updates existing workspace file when repos change", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repos/other-app", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			// Simulate existing file with different content
			(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				JSON.stringify({
					folders: [{ path: "/repos/my-app", name: "my-app" }],
					settings: {},
				}),
			);

			const result = await service.ensureWorkspaceFile();

			expect(result).toBe(false);
			expect(fs.writeFile).toHaveBeenCalled();
			const writtenContent = (fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
			const parsed = JSON.parse(writtenContent);
			expect(parsed.folders).toHaveLength(2);
		});

		it("is a no-op when file already matches current repos", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			// Simulate existing file with matching content
			(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				JSON.stringify({
					folders: [{ path: "/repos/my-app", name: "my-app" }],
					settings: {},
				}),
			);

			const result = await service.ensureWorkspaceFile();

			expect(result).toBe(false);
			expect(fs.writeFile).not.toHaveBeenCalled();
		});
	});

	describe("promptReopenInWorkspace", () => {
		it("shows info message with 'Reopen in Workspace' and 'Later' options", async () => {
			window.showInformationMessage.mockResolvedValueOnce(undefined);

			await service.promptReopenInWorkspace();

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("workspace"),
				"Reopen in Workspace",
				"Later",
			);
		});

		it("executes vscode.openFolder with workspace file URI when user clicks 'Reopen in Workspace'", async () => {
			window.showInformationMessage.mockResolvedValueOnce("Reopen in Workspace");

			await service.promptReopenInWorkspace();

			expect(commands.executeCommand).toHaveBeenCalledWith(
				"vscode.openFolder",
				expect.objectContaining({
					fsPath: "/home/test/.agentic/agentic.code-workspace",
				}),
			);
		});

		it("does nothing when user clicks 'Later' or dismisses", async () => {
			window.showInformationMessage.mockResolvedValueOnce("Later");

			await service.promptReopenInWorkspace();

			expect(commands.executeCommand).not.toHaveBeenCalled();
		});
	});

	describe("syncWorkspaceFile", () => {
		it("writes workspace file with folders from repoConfigService.getAll()", async () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repos/backend", stagingBranch: "staging", worktreeLimit: 5 },
			]);

			await service.syncWorkspaceFile();

			expect(fs.mkdir).toHaveBeenCalledWith("/home/test/.agentic", { recursive: true });
			expect(fs.writeFile).toHaveBeenCalledWith(
				"/home/test/.agentic/agentic.code-workspace",
				expect.any(String),
				"utf-8",
			);

			const writtenContent = (fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
			const parsed = JSON.parse(writtenContent);
			expect(parsed.folders).toEqual([
				{ path: "/repos/my-app", name: "my-app" },
				{ path: "/repos/backend", name: "backend" },
			]);
			expect(parsed.settings).toEqual({});
		});
	});

	describe("setExplorerScope", () => {
		it("updateWorkspaceFolders with all repo roots for 'global' mode", () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repos/backend", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			workspace.workspaceFolders = [{ uri: { fsPath: "/old" }, name: "old", index: 0 }];

			service.setExplorerScope("global");

			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
				0,
				1,
				{ uri: expect.objectContaining({ fsPath: "/repos/my-app" }), name: "my-app" },
				{ uri: expect.objectContaining({ fsPath: "/repos/backend" }), name: "backend" },
			);
		});

		it("updateWorkspaceFolders with single repo root for repo mode", () => {
			workspace.workspaceFolders = [{ uri: { fsPath: "/old" }, name: "old", index: 0 }];

			service.setExplorerScope({ repo: "/repos/my-app" });

			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
				0,
				1,
				{ uri: expect.objectContaining({ fsPath: "/repos/my-app" }), name: "my-app" },
			);
		});

		it("updateWorkspaceFolders with single worktree path for agent mode", () => {
			workspace.workspaceFolders = [{ uri: { fsPath: "/old" }, name: "old", index: 0 }];

			service.setExplorerScope({
				repo: "/repos/my-app",
				agent: "fix-bug",
				worktreePath: "/repos/my-app/.worktrees/fix-bug",
			});

			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
				0,
				1,
				{
					uri: expect.objectContaining({ fsPath: "/repos/my-app/.worktrees/fix-bug" }),
					name: "fix-bug",
				},
			);
		});

		it("handles empty workspaceFolders for global mode", () => {
			repoConfigService.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			workspace.workspaceFolders = undefined;

			service.setExplorerScope("global");

			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
				0,
				0,
				{ uri: expect.objectContaining({ fsPath: "/repos/my-app" }), name: "my-app" },
			);
		});
	});
});
