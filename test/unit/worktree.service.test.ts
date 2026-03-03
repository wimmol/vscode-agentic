import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WORKTREE_LIMIT } from "../../src/models/repo.js";
import type { WorktreeEntry } from "../../src/models/worktree.js";
import { WORKTREE_DIR_NAME, WORKTREE_MANIFEST_KEY } from "../../src/models/worktree.js";
import type { GitService } from "../../src/services/git.service.js";
import type { ReconciliationResult } from "../../src/services/worktree.service.js";
import { WorktreeLimitError, WorktreeService } from "../../src/services/worktree.service.js";
import { createMockMemento } from "../__mocks__/vscode.js";

function createMockGitService(): GitService {
	return {
		exec: vi.fn().mockResolvedValue(""),
		branchExists: vi.fn().mockResolvedValue(false),
	} as unknown as GitService;
}

function makeEntry(overrides: Partial<WorktreeEntry> = {}): WorktreeEntry {
	return {
		path: "/repo/.worktrees/agent-1",
		branch: "agent-1",
		agentName: "agent-1",
		repoPath: "/repo",
		createdAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("WorktreeService", () => {
	let git: ReturnType<typeof createMockGitService>;
	let memento: ReturnType<typeof createMockMemento>;
	let service: WorktreeService;

	beforeEach(() => {
		vi.clearAllMocks();
		git = createMockGitService();
		memento = createMockMemento();
		service = new WorktreeService(git, memento);
	});

	describe("addWorktree", () => {
		it("calls git worktree add with correct args and saves to manifest", async () => {
			const entry = await service.addWorktree("/repo", "agent-1");

			// Verify git command
			expect(git.exec).toHaveBeenCalledWith("/repo", [
				"worktree",
				"add",
				"-b",
				"agent-1",
				"/repo/.worktrees/agent-1",
				"HEAD",
			]);

			// Verify returned entry
			expect(entry.path).toBe("/repo/.worktrees/agent-1");
			expect(entry.branch).toBe("agent-1");
			expect(entry.agentName).toBe("agent-1");
			expect(entry.repoPath).toBe("/repo");
			expect(entry.createdAt).toBeDefined();

			// Verify saved to manifest
			const manifest = memento.get(WORKTREE_MANIFEST_KEY, []);
			expect(manifest).toHaveLength(1);
			expect((manifest as WorktreeEntry[])[0].agentName).toBe("agent-1");
		});

		it("uses startPoint when provided", async () => {
			await service.addWorktree("/repo", "agent-1", "main");

			expect(git.exec).toHaveBeenCalledWith("/repo", [
				"worktree",
				"add",
				"-b",
				"agent-1",
				"/repo/.worktrees/agent-1",
				"main",
			]);
		});

		it("throws WorktreeLimitError (not generic Error) when limit reached", async () => {
			// Pre-populate manifest with entries at the limit
			const existing: WorktreeEntry[] = [
				makeEntry({ agentName: "agent-1", path: "/repo/.worktrees/agent-1" }),
				makeEntry({ agentName: "agent-2", path: "/repo/.worktrees/agent-2" }),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, existing);

			try {
				await service.addWorktree("/repo", "agent-3", undefined, 2);
				// Should not reach here
				expect.unreachable("Expected WorktreeLimitError to be thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(WorktreeLimitError);
				const limitErr = err as WorktreeLimitError;
				expect(limitErr.repoPath).toBe("/repo");
				expect(limitErr.limit).toBe(2);
				expect(limitErr.existingEntries).toHaveLength(2);
				expect(limitErr.existingEntries[0].agentName).toBe("agent-1");
			}
		});

		it("WorktreeLimitError.existingEntries contains entries for that repo only", async () => {
			const existing: WorktreeEntry[] = [
				makeEntry({
					agentName: "agent-1",
					path: "/repo/.worktrees/agent-1",
					repoPath: "/repo",
				}),
				makeEntry({
					agentName: "other-repo-agent",
					path: "/other-repo/.worktrees/other-repo-agent",
					repoPath: "/other-repo",
				}),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, existing);

			try {
				await service.addWorktree("/repo", "agent-2", undefined, 1);
				expect.unreachable("Expected WorktreeLimitError");
			} catch (err) {
				const limitErr = err as WorktreeLimitError;
				expect(limitErr.existingEntries).toHaveLength(1);
				expect(limitErr.existingEntries[0].repoPath).toBe("/repo");
			}
		});

		it("allows adding when under limit (does not throw)", async () => {
			const existing: WorktreeEntry[] = [
				makeEntry({ agentName: "agent-1", path: "/repo/.worktrees/agent-1" }),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, existing);

			const entry = await service.addWorktree("/repo", "agent-2", undefined, 5);
			expect(entry.agentName).toBe("agent-2");
		});

		it("uses DEFAULT_WORKTREE_LIMIT when no limit specified", async () => {
			// Fill up to default limit
			const existing: WorktreeEntry[] = [];
			for (let i = 0; i < DEFAULT_WORKTREE_LIMIT; i++) {
				existing.push(
					makeEntry({
						agentName: `agent-${i}`,
						path: `/repo/.worktrees/agent-${i}`,
					}),
				);
			}
			await memento.update(WORKTREE_MANIFEST_KEY, existing);

			await expect(service.addWorktree("/repo", "agent-overflow")).rejects.toThrow(
				WorktreeLimitError,
			);
		});
	});

	describe("removeWorktree", () => {
		it("calls git worktree remove + branch -D and removes from manifest", async () => {
			const existing: WorktreeEntry[] = [
				makeEntry({ agentName: "agent-1", path: "/repo/.worktrees/agent-1" }),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, existing);

			await service.removeWorktree("/repo", "agent-1");

			expect(git.exec).toHaveBeenCalledWith("/repo", [
				"worktree",
				"remove",
				"--force",
				"/repo/.worktrees/agent-1",
			]);
			expect(git.exec).toHaveBeenCalledWith("/repo", ["branch", "-D", "agent-1"]);

			const manifest = memento.get(WORKTREE_MANIFEST_KEY, []) as WorktreeEntry[];
			expect(manifest).toHaveLength(0);
		});

		it("handles already-missing worktree gracefully", async () => {
			const existing: WorktreeEntry[] = [
				makeEntry({ agentName: "agent-1", path: "/repo/.worktrees/agent-1" }),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, existing);

			// Git commands fail (worktree already gone)
			(git.exec as ReturnType<typeof vi.fn>)
				.mockRejectedValueOnce(new Error("not a valid worktree"))
				.mockRejectedValueOnce(new Error("branch not found"));

			// Should NOT throw
			await expect(service.removeWorktree("/repo", "agent-1")).resolves.not.toThrow();

			// Manifest should still be cleaned up
			const manifest = memento.get(WORKTREE_MANIFEST_KEY, []) as WorktreeEntry[];
			expect(manifest).toHaveLength(0);
		});
	});

	describe("getManifest", () => {
		it("returns only entries matching the given repoPath", async () => {
			const existing: WorktreeEntry[] = [
				makeEntry({
					agentName: "agent-1",
					repoPath: "/repo-a",
					path: "/repo-a/.worktrees/agent-1",
				}),
				makeEntry({
					agentName: "agent-2",
					repoPath: "/repo-b",
					path: "/repo-b/.worktrees/agent-2",
				}),
				makeEntry({
					agentName: "agent-3",
					repoPath: "/repo-a",
					path: "/repo-a/.worktrees/agent-3",
				}),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, existing);

			const result = service.getManifest("/repo-a");
			expect(result).toHaveLength(2);
			expect(result.map((e) => e.agentName)).toEqual(["agent-1", "agent-3"]);
		});

		it("returns empty array when no entries exist", () => {
			const result = service.getManifest("/repo-a");
			expect(result).toEqual([]);
		});
	});

	describe("reconcile", () => {
		it("detects orphaned-in-manifest entries (manifest entry with no disk worktree)", async () => {
			// Manifest has an entry, but disk listing doesn't include it
			const manifestEntries: WorktreeEntry[] = [
				makeEntry({
					agentName: "ghost-agent",
					path: "/repo/.worktrees/ghost-agent",
				}),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, manifestEntries);

			// git worktree list returns only the main worktree (no .worktrees/ entries)
			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				["worktree /repo", "HEAD abc123", "branch refs/heads/main", ""].join("\n"),
			);

			const result = await service.reconcile("/repo");
			expect(result.orphanedInManifest).toHaveLength(1);
			expect(result.orphanedInManifest[0].agentName).toBe("ghost-agent");
			expect(result.healthy).toHaveLength(0);
		});

		it("detects orphaned-on-disk entries (disk worktree with no manifest entry)", async () => {
			// Empty manifest
			await memento.update(WORKTREE_MANIFEST_KEY, []);

			// Disk has a worktree under .worktrees/ that's not in manifest
			(git.exec as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(
					[
						"worktree /repo",
						"HEAD abc123",
						"branch refs/heads/main",
						"",
						"worktree /repo/.worktrees/orphan-agent",
						"HEAD def456",
						"branch refs/heads/orphan-agent",
						"",
					].join("\n"),
				)
				// Second call is the cleanup: git worktree remove
				.mockResolvedValueOnce("");

			const result = await service.reconcile("/repo");
			expect(result.orphanedOnDisk).toHaveLength(1);
			expect(result.orphanedOnDisk[0].path).toBe("/repo/.worktrees/orphan-agent");
		});

		it("only flags .worktrees/ paths as orphanedOnDisk (ignores main worktree)", async () => {
			await memento.update(WORKTREE_MANIFEST_KEY, []);

			// Disk has main worktree (no .worktrees/ prefix) -- should NOT be flagged
			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				["worktree /repo", "HEAD abc123", "branch refs/heads/main", ""].join("\n"),
			);

			const result = await service.reconcile("/repo");
			expect(result.orphanedOnDisk).toHaveLength(0);
			expect(result.healthy).toHaveLength(0);
		});

		it("removes orphanedInManifest entries from manifest", async () => {
			const manifestEntries: WorktreeEntry[] = [
				makeEntry({
					agentName: "ghost-agent",
					path: "/repo/.worktrees/ghost-agent",
				}),
				makeEntry({
					agentName: "alive-agent",
					path: "/repo/.worktrees/alive-agent",
				}),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, manifestEntries);

			// Only alive-agent exists on disk
			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				[
					"worktree /repo",
					"HEAD abc123",
					"branch refs/heads/main",
					"",
					"worktree /repo/.worktrees/alive-agent",
					"HEAD def456",
					"branch refs/heads/alive-agent",
					"",
				].join("\n"),
			);

			await service.reconcile("/repo");

			// Manifest should only have the alive agent now
			const manifest = memento.get(WORKTREE_MANIFEST_KEY, []) as WorktreeEntry[];
			expect(manifest).toHaveLength(1);
			expect(manifest[0].agentName).toBe("alive-agent");
		});

		it("returns healthy entries (present in both manifest and disk)", async () => {
			const manifestEntries: WorktreeEntry[] = [
				makeEntry({
					agentName: "healthy-agent",
					path: "/repo/.worktrees/healthy-agent",
				}),
			];
			await memento.update(WORKTREE_MANIFEST_KEY, manifestEntries);

			(git.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				[
					"worktree /repo",
					"HEAD abc123",
					"branch refs/heads/main",
					"",
					"worktree /repo/.worktrees/healthy-agent",
					"HEAD def456",
					"branch refs/heads/healthy-agent",
					"",
				].join("\n"),
			);

			const result = await service.reconcile("/repo");
			expect(result.healthy).toHaveLength(1);
			expect(result.healthy[0].agentName).toBe("healthy-agent");
			expect(result.orphanedInManifest).toHaveLength(0);
			expect(result.orphanedOnDisk).toHaveLength(0);
		});

		it("cleans up orphanedOnDisk by running git worktree remove", async () => {
			await memento.update(WORKTREE_MANIFEST_KEY, []);

			(git.exec as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(
					[
						"worktree /repo",
						"HEAD abc123",
						"branch refs/heads/main",
						"",
						"worktree /repo/.worktrees/orphan-agent",
						"HEAD def456",
						"branch refs/heads/orphan-agent",
						"",
					].join("\n"),
				)
				.mockResolvedValueOnce(""); // worktree remove

			await service.reconcile("/repo");

			expect(git.exec).toHaveBeenCalledWith("/repo", [
				"worktree",
				"remove",
				"--force",
				"/repo/.worktrees/orphan-agent",
			]);
		});
	});

	describe("mutex (per-repo lock)", () => {
		it("serializes concurrent addWorktree calls for the same repo", async () => {
			const callOrder: string[] = [];

			// First call takes 50ms
			(git.exec as ReturnType<typeof vi.fn>).mockImplementation(
				async (_repoPath: string, args: string[]) => {
					if (args[0] === "worktree" && args[1] === "add") {
						const agentName = args[3]; // -b <branch>
						callOrder.push(`start:${agentName}`);
						await new Promise((r) => setTimeout(r, 50));
						callOrder.push(`end:${agentName}`);
					}
					return "";
				},
			);

			// Launch both concurrently
			const [entry1, entry2] = await Promise.all([
				service.addWorktree("/repo", "agent-a"),
				service.addWorktree("/repo", "agent-b"),
			]);

			// Both should succeed
			expect(entry1.agentName).toBe("agent-a");
			expect(entry2.agentName).toBe("agent-b");

			// The second call should have started AFTER the first ended
			expect(callOrder.indexOf("end:agent-a")).toBeLessThan(callOrder.indexOf("start:agent-b"));
		});
	});
});
