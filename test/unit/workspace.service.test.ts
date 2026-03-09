import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, workspace, Uri, window } from "../__mocks__/vscode";

// Mock node:os
vi.mock("node:os", () => ({
	homedir: vi.fn(() => "/home/test"),
}));

import { WorkspaceService } from "../../src/services/workspace.service";

function createMockRepoDataSource() {
	return {
		getAll: vi.fn().mockReturnValue([]),
	};
}

const encoder = new TextEncoder();

describe("WorkspaceService", () => {
	let repoDataSource: ReturnType<typeof createMockRepoDataSource>;
	let service: WorkspaceService;

	beforeEach(() => {
		vi.clearAllMocks();
		repoDataSource = createMockRepoDataSource();
		service = new WorkspaceService(repoDataSource as never);

		// Reset workspace.workspaceFile for each test
		(workspace as any).workspaceFile = undefined;

		// Default: createDirectory and writeFile resolve
		(workspace.fs.createDirectory as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(workspace.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
	});

	describe("getWorkspaceFilePath", () => {
		it("returns path under ~/.agentic/agentic.code-workspace", () => {
			const result = service.getWorkspaceFilePath();
			expect(result).toContain(".agentic");
			expect(result).toContain("agentic.code-workspace");
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
		it("creates directory and workspace file with correct JSON structure", async () => {
			repoDataSource.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			// Simulate file not existing
			(workspace.fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error("FileNotFound"),
			);

			const result = await service.ensureWorkspaceFile();

			expect(result).toBe(true);
			expect(workspace.fs.createDirectory).toHaveBeenCalled();
			expect(workspace.fs.writeFile).toHaveBeenCalled();

			// Verify JSON structure
			const writtenBytes = (workspace.fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
			const writtenContent = new TextDecoder().decode(writtenBytes);
			const parsed = JSON.parse(writtenContent);
			expect(parsed.folders).toEqual([
				{ path: "/repos/my-app", name: "my-app" },
			]);
			expect(parsed.settings).toEqual({});
		});

		it("updates existing workspace file when repos change", async () => {
			repoDataSource.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repos/other-app", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			// Simulate existing file with different content
			const existingContent = JSON.stringify({
				folders: [{ path: "/repos/my-app", name: "my-app" }],
				settings: {},
			});
			(workspace.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				encoder.encode(existingContent),
			);

			const result = await service.ensureWorkspaceFile();

			expect(result).toBe(false);
			expect(workspace.fs.writeFile).toHaveBeenCalled();
			const writtenBytes = (workspace.fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
			const writtenContent = new TextDecoder().decode(writtenBytes);
			const parsed = JSON.parse(writtenContent);
			expect(parsed.folders).toHaveLength(2);
		});

		it("is a no-op when file already matches current repos", async () => {
			repoDataSource.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			// Simulate existing file with matching content
			const existingContent = JSON.stringify({
				folders: [{ path: "/repos/my-app", name: "my-app" }],
				settings: {},
			});
			(workspace.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				encoder.encode(existingContent),
			);

			const result = await service.ensureWorkspaceFile();

			expect(result).toBe(false);
			expect(workspace.fs.writeFile).not.toHaveBeenCalled();
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
				expect.any(Object),
			);
		});

		it("does nothing when user clicks 'Later' or dismisses", async () => {
			window.showInformationMessage.mockResolvedValueOnce("Later");

			await service.promptReopenInWorkspace();

			expect(commands.executeCommand).not.toHaveBeenCalled();
		});
	});

	describe("syncWorkspaceFile", () => {
		it("writes workspace file with folders from repoDataSource.getAll()", async () => {
			repoDataSource.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repos/backend", stagingBranch: "staging", worktreeLimit: 5 },
			]);

			await service.syncWorkspaceFile();

			expect(workspace.fs.createDirectory).toHaveBeenCalled();
			expect(workspace.fs.writeFile).toHaveBeenCalled();

			const writtenBytes = (workspace.fs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
			const writtenContent = new TextDecoder().decode(writtenBytes);
			const parsed = JSON.parse(writtenContent);
			expect(parsed.folders).toEqual([
				{ path: "/repos/my-app", name: "my-app" },
				{ path: "/repos/backend", name: "backend" },
			]);
			expect(parsed.settings).toEqual({});
		});
	});

	describe("setExplorerScope", () => {
		it("replaces workspace folders with the given path", () => {
			workspace.workspaceFolders = [{ uri: { fsPath: "/old" }, name: "old", index: 0 }];

			service.setExplorerScope("/repos/my-app");

			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
				0,
				1,
				{ uri: expect.objectContaining({ fsPath: "/repos/my-app" }), name: "my-app" },
			);
		});

		it("uses custom name when provided", () => {
			workspace.workspaceFolders = [{ uri: { fsPath: "/old" }, name: "old", index: 0 }];

			service.setExplorerScope("/repos/my-app/.worktrees/fix-bug", "fix-bug");

			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
				0,
				1,
				{
					uri: expect.objectContaining({ fsPath: "/repos/my-app/.worktrees/fix-bug" }),
					name: "fix-bug",
				},
			);
		});

		it("uses basename when name is not provided", () => {
			workspace.workspaceFolders = undefined;

			service.setExplorerScope("/repos/my-app");

			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
				0,
				0,
				{ uri: expect.objectContaining({ fsPath: "/repos/my-app" }), name: "my-app" },
			);
		});
	});

	describe("resetExplorerScope", () => {
		it("replaces workspace folders with all repo roots", () => {
			repoDataSource.getAll.mockReturnValue([
				{ path: "/repos/my-app", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repos/backend", stagingBranch: "staging", worktreeLimit: 5 },
			]);
			workspace.workspaceFolders = [{ uri: { fsPath: "/old" }, name: "old", index: 0 }];

			service.resetExplorerScope();

			expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
				0,
				1,
				{ uri: expect.objectContaining({ fsPath: "/repos/my-app" }), name: "my-app" },
				{ uri: expect.objectContaining({ fsPath: "/repos/backend" }), name: "backend" },
			);
		});

		it("does nothing when no repos configured", () => {
			repoDataSource.getAll.mockReturnValue([]);

			service.resetExplorerScope();

			expect(workspace.updateWorkspaceFolders).not.toHaveBeenCalled();
		});
	});
});
