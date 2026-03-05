import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento } from "../__mocks__/vscode";

// Mock GitService
function createMockGitService() {
	return {
		exec: vi.fn<[string, string[]], Promise<string>>().mockResolvedValue(""),
		branchExists: vi.fn<[string, string], Promise<boolean>>().mockResolvedValue(false),
	};
}

import type { WorktreeEntry } from "../../src/models/worktree";
// We need to import after defining mocks
import {
	type ReconciliationResult,
	WorktreeLimitError,
	WorktreeService,
} from "../../src/services/worktree.service";

describe("WorktreeService", () => {
	let git: ReturnType<typeof createMockGitService>;
	let memento: ReturnType<typeof createMockMemento>;
	let service: WorktreeService;

	beforeEach(() => {
		vi.clearAllMocks();
		git = createMockGitService();
		memento = createMockMemento();
		service = new WorktreeService(git as any, memento as any);
	});

	describe("addWorktree", () => {
		it("calls git worktree add with correct args and returns WorktreeEntry", async () => {
			const entry = await service.addWorktree("/repo", "agent-1");

			expect(git.exec).toHaveBeenCalledWith("/repo", [
				"worktree",
				"add",
				"-b",
				"agent-1",
				"/repo/.worktrees/agent-1",
				"HEAD",
			]);

			expect(entry.path).toBe("/repo/.worktrees/agent-1");
			expect(entry.branch).toBe("agent-1");
			expect(entry.agentName).toBe("agent-1");
			expect(entry.repoPath).toBe("/repo");
			expect(entry.createdAt).toBeTruthy();
		});

		it("uses custom startPoint when provided", async () => {
			await service.addWorktree("/repo", "agent-2", "develop");

			expect(git.exec).toHaveBeenCalledWith("/repo", [
				"worktree",
				"add",
				"-b",
				"agent-2",
				"/repo/.worktrees/agent-2",
				"develop",
			]);
		});

		it("saves entry to manifest", async () => {
			await service.addWorktree("/repo", "agent-1");

			const manifest = service.getManifest("/repo");
			expect(manifest).toHaveLength(1);
			expect(manifest[0].agentName).toBe("agent-1");
		});

		it("throws WorktreeLimitError (not generic Error) when limit reached", async () => {
			// Add entries up to limit of 2
			await service.addWorktree("/repo", "agent-1", undefined, 2);
			await service.addWorktree("/repo", "agent-2", undefined, 2);

			// Third should fail
			await expect(service.addWorktree("/repo", "agent-3", undefined, 2)).rejects.toThrow(
				WorktreeLimitError,
			);
		});

		it("WorktreeLimitError includes repoPath, limit, and existingEntries", async () => {
			await service.addWorktree("/repo", "agent-1", undefined, 1);

			try {
				await service.addWorktree("/repo", "agent-2", undefined, 1);
				expect.fail("Should have thrown");
			} catch (e) {
				expect(e).toBeInstanceOf(WorktreeLimitError);
				const err = e as WorktreeLimitError;
				expect(err.repoPath).toBe("/repo");
				expect(err.limit).toBe(1);
				expect(err.existingEntries).toHaveLength(1);
				expect(err.existingEntries[0].agentName).toBe("agent-1");
			}
		});

		it("enforces limit per repo (different repos have independent counts)", async () => {
			await service.addWorktree("/repo-a", "agent-1", undefined, 1);

			// Different repo should not hit the limit
			const entry = await service.addWorktree("/repo-b", "agent-1", undefined, 1);
			expect(entry.repoPath).toBe("/repo-b");
		});
	});

	describe("removeWorktree", () => {
		it("calls git worktree remove and branch delete, removes from manifest", async () => {
			await service.addWorktree("/repo", "agent-1");
			expect(service.getManifest("/repo")).toHaveLength(1);

			await service.removeWorktree("/repo", "agent-1");

			expect(git.exec).toHaveBeenCalledWith("/repo", [
				"worktree",
				"remove",
				"--force",
				"/repo/.worktrees/agent-1",
			]);
			expect(git.exec).toHaveBeenCalledWith("/repo", ["branch", "-D", "agent-1"]);
			expect(service.getManifest("/repo")).toHaveLength(0);
		});

		it("handles already-missing worktree gracefully (still removes from manifest)", async () => {
			await service.addWorktree("/repo", "agent-1");

			// Make git worktree remove fail (worktree already gone)
			git.exec.mockImplementation(async (_repo: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "remove") {
					throw new Error("fatal: '/repo/.worktrees/agent-1' is not a working tree");
				}
				if (args[0] === "branch") {
					throw new Error("error: branch 'agent-1' not found");
				}
				return "";
			});

			// Should not throw
			await service.removeWorktree("/repo", "agent-1");
			expect(service.getManifest("/repo")).toHaveLength(0);
		});
	});

	describe("getManifest", () => {
		it("returns only entries matching the given repoPath", async () => {
			await service.addWorktree("/repo-a", "agent-1");
			await service.addWorktree("/repo-b", "agent-2");
			await service.addWorktree("/repo-a", "agent-3");

			const manifestA = service.getManifest("/repo-a");
			expect(manifestA).toHaveLength(2);
			expect(manifestA.map((e) => e.agentName)).toEqual(["agent-1", "agent-3"]);

			const manifestB = service.getManifest("/repo-b");
			expect(manifestB).toHaveLength(1);
			expect(manifestB[0].agentName).toBe("agent-2");
		});
	});

	describe("reconcile", () => {
		it("detects orphaned entries in manifest and on disk", async () => {
			// Add an entry to manifest manually (agent-manifest)
			await service.addWorktree("/repo", "agent-manifest");

			// Now simulate git worktree list returning a DIFFERENT worktree on disk
			const porcelainOutput = [
				"worktree /repo",
				"HEAD aaa111",
				"branch refs/heads/main",
				"",
				"worktree /repo/.worktrees/agent-disk",
				"HEAD bbb222",
				"branch refs/heads/agent-disk",
				"",
			].join("\n");

			git.exec.mockImplementation(async (_repo: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "list") {
					return porcelainOutput;
				}
				return "";
			});

			const result = await service.reconcile("/repo");

			// agent-manifest is in manifest but NOT on disk => orphanedInManifest
			expect(result.orphanedInManifest).toHaveLength(1);
			expect(result.orphanedInManifest[0].agentName).toBe("agent-manifest");

			// agent-disk is on disk (under .worktrees/) but NOT in manifest => orphanedOnDisk
			expect(result.orphanedOnDisk).toHaveLength(1);
			expect(result.orphanedOnDisk[0].path).toBe("/repo/.worktrees/agent-disk");

			// No healthy entries (manifest entry is orphaned, disk entry is orphaned)
			expect(result.healthy).toHaveLength(0);
		});

		it("removes orphanedInManifest entries from manifest", async () => {
			await service.addWorktree("/repo", "agent-gone");

			// Disk shows no worktrees under .worktrees/
			const porcelainOutput = ["worktree /repo", "HEAD aaa111", "branch refs/heads/main", ""].join(
				"\n",
			);

			git.exec.mockImplementation(async (_repo: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "list") {
					return porcelainOutput;
				}
				return "";
			});

			await service.reconcile("/repo");

			// Manifest should be cleaned up
			expect(service.getManifest("/repo")).toHaveLength(0);
		});

		it("only flags .worktrees/ paths as orphanedOnDisk (ignores main worktree)", async () => {
			const porcelainOutput = [
				"worktree /repo",
				"HEAD aaa111",
				"branch refs/heads/main",
				"",
				"worktree /some/other/path",
				"HEAD bbb222",
				"branch refs/heads/feature",
				"",
			].join("\n");

			git.exec.mockImplementation(async (_repo: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "list") {
					return porcelainOutput;
				}
				return "";
			});

			const result = await service.reconcile("/repo");

			// Neither /repo nor /some/other/path are under .worktrees/ so neither should be flagged
			expect(result.orphanedOnDisk).toHaveLength(0);
		});

		it("identifies healthy entries (in both manifest and on disk)", async () => {
			await service.addWorktree("/repo", "agent-healthy");

			const porcelainOutput = [
				"worktree /repo",
				"HEAD aaa111",
				"branch refs/heads/main",
				"",
				"worktree /repo/.worktrees/agent-healthy",
				"HEAD ccc333",
				"branch refs/heads/agent-healthy",
				"",
			].join("\n");

			git.exec.mockImplementation(async (_repo: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "list") {
					return porcelainOutput;
				}
				return "";
			});

			const result = await service.reconcile("/repo");

			expect(result.healthy).toHaveLength(1);
			expect(result.healthy[0].agentName).toBe("agent-healthy");
			expect(result.orphanedInManifest).toHaveLength(0);
			expect(result.orphanedOnDisk).toHaveLength(0);
		});
	});

	describe("mutex (concurrent safety)", () => {
		it("serializes concurrent addWorktree calls for same repo", async () => {
			const callOrder: string[] = [];

			// Make exec take time for first call, instant for second
			let callCount = 0;
			git.exec.mockImplementation(async (_repo: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "add") {
					callCount++;
					const thisCall = callCount;
					callOrder.push(`start-${thisCall}`);
					// First call takes longer
					if (thisCall === 1) {
						await new Promise((r) => setTimeout(r, 50));
					}
					callOrder.push(`end-${thisCall}`);
				}
				return "";
			});

			// Fire both at the same time
			const [entry1, entry2] = await Promise.all([
				service.addWorktree("/repo", "agent-a", undefined, 10),
				service.addWorktree("/repo", "agent-b", undefined, 10),
			]);

			// Both should succeed
			expect(entry1.agentName).toBe("agent-a");
			expect(entry2.agentName).toBe("agent-b");

			// First call should complete before second starts
			expect(callOrder).toEqual(["start-1", "end-1", "start-2", "end-2"]);
		});
	});
});
