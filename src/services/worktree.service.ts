import * as path from "node:path";
import type * as vscode from "vscode";
import { DEFAULT_WORKTREE_LIMIT } from "../models/repo.js";
import type { WorktreeEntry, WorktreeOnDisk } from "../models/worktree.js";
import { WORKTREE_DIR_NAME, WORKTREE_MANIFEST_KEY } from "../models/worktree.js";
import { parseWorktreeList } from "../utils/worktree-parser.js";
import type { GitService } from "./git.service.js";

export class WorktreeLimitError extends Error {
	constructor(
		public readonly repoPath: string,
		public readonly limit: number,
		public readonly existingEntries: WorktreeEntry[],
	) {
		super(
			`Worktree limit (${limit}) reached for ${repoPath}. Delete an existing agent to make room.`,
		);
		this.name = "WorktreeLimitError";
	}
}

export interface ReconciliationResult {
	orphanedInManifest: WorktreeEntry[];
	orphanedOnDisk: WorktreeOnDisk[];
	healthy: WorktreeEntry[];
}

export class WorktreeService {
	private locks: Map<string, Promise<void>> = new Map();

	constructor(
		private readonly git: GitService,
		private readonly state: vscode.Memento,
	) {}

	/**
	 * Simple per-repo mutex. Queues operations so only one
	 * addWorktree/removeWorktree runs at a time per repo, preventing TOCTOU races.
	 */
	private async withLock<T>(repoPath: string, fn: () => Promise<T>): Promise<T> {
		// Wait for any existing operation on this repo to finish
		const existing = this.locks.get(repoPath) ?? Promise.resolve();

		let resolve: () => void;
		const newLock = new Promise<void>((r) => {
			resolve = r;
		});
		this.locks.set(repoPath, newLock);

		await existing;

		try {
			return await fn();
		} finally {
			resolve!();
			// Clean up if this is still the latest lock
			if (this.locks.get(repoPath) === newLock) {
				this.locks.delete(repoPath);
			}
		}
	}

	/**
	 * Creates a new worktree for the given agent.
	 * Throws WorktreeLimitError if the per-repo hard limit is reached.
	 */
	async addWorktree(
		repoPath: string,
		agentName: string,
		startPoint?: string,
		limit?: number,
	): Promise<WorktreeEntry> {
		return this.withLock(repoPath, async () => {
			const effectiveLimit = limit ?? DEFAULT_WORKTREE_LIMIT;
			const repoEntries = this.getManifest(repoPath);

			if (repoEntries.length >= effectiveLimit) {
				throw new WorktreeLimitError(repoPath, effectiveLimit, repoEntries);
			}

			const worktreePath = path.join(repoPath, WORKTREE_DIR_NAME, agentName);
			const branchName = agentName;

			await this.git.exec(repoPath, [
				"worktree",
				"add",
				"-b",
				branchName,
				worktreePath,
				startPoint || "HEAD",
			]);

			const entry: WorktreeEntry = {
				path: worktreePath,
				branch: branchName,
				agentName,
				repoPath,
				createdAt: new Date().toISOString(),
			};

			const allEntries = this.getAllManifestEntries();
			allEntries.push(entry);
			await this.saveManifest(allEntries);

			return entry;
		});
	}

	/**
	 * Removes a worktree and its branch. Handles already-missing worktrees gracefully.
	 */
	async removeWorktree(repoPath: string, agentName: string): Promise<void> {
		return this.withLock(repoPath, async () => {
			const allEntries = this.getAllManifestEntries();
			const entry = allEntries.find((e) => e.agentName === agentName && e.repoPath === repoPath);

			if (entry) {
				// Try to remove the worktree from disk (may already be gone)
				try {
					await this.git.exec(repoPath, ["worktree", "remove", "--force", entry.path]);
				} catch {
					// Worktree already gone from disk -- that's fine
				}

				// Try to delete the branch (may already be gone)
				try {
					await this.git.exec(repoPath, ["branch", "-D", entry.branch]);
				} catch {
					// Branch already gone -- that's fine
				}
			}

			// Remove from manifest regardless
			const updated = allEntries.filter(
				(e) => !(e.agentName === agentName && e.repoPath === repoPath),
			);
			await this.saveManifest(updated);
		});
	}

	/**
	 * Returns manifest entries for the given repo.
	 */
	getManifest(repoPath: string): WorktreeEntry[] {
		return this.getAllManifestEntries().filter((e) => e.repoPath === repoPath);
	}

	/**
	 * Reconciles manifest state vs disk state for a repo.
	 * - Entries in manifest but not on disk: orphanedInManifest (removed from manifest)
	 * - Entries on disk (under .worktrees/) but not in manifest: orphanedOnDisk (removed from disk)
	 * - Entries in both: healthy
	 */
	async reconcile(repoPath: string): Promise<ReconciliationResult> {
		const manifestEntries = this.getManifest(repoPath);
		const diskOutput = await this.git.exec(repoPath, ["worktree", "list", "--porcelain"]);
		const diskEntries = parseWorktreeList(diskOutput);

		// Only consider disk entries under .worktrees/ dir
		const worktreesDirPrefix = path.join(repoPath, WORKTREE_DIR_NAME);
		const managedDiskEntries = diskEntries.filter((d) => d.path.startsWith(worktreesDirPrefix));

		const diskPaths = new Set(managedDiskEntries.map((d) => d.path));
		const manifestPaths = new Set(manifestEntries.map((m) => m.path));

		// Entries in manifest but not on disk
		const orphanedInManifest = manifestEntries.filter((m) => !diskPaths.has(m.path));

		// Entries on disk but not in manifest
		const orphanedOnDisk = managedDiskEntries.filter((d) => !manifestPaths.has(d.path));

		// Entries in both
		const healthy = manifestEntries.filter((m) => diskPaths.has(m.path));

		// Clean up orphanedInManifest: remove from manifest
		if (orphanedInManifest.length > 0) {
			const orphanPaths = new Set(orphanedInManifest.map((o) => o.path));
			const allEntries = this.getAllManifestEntries();
			const cleaned = allEntries.filter((e) => !orphanPaths.has(e.path));
			await this.saveManifest(cleaned);
		}

		// Clean up orphanedOnDisk: remove worktrees from disk
		for (const orphan of orphanedOnDisk) {
			try {
				await this.git.exec(repoPath, ["worktree", "remove", "--force", orphan.path]);
			} catch {
				// Best effort cleanup
			}
		}

		return { orphanedInManifest, orphanedOnDisk, healthy };
	}

	private getAllManifestEntries(): WorktreeEntry[] {
		return this.state.get<WorktreeEntry[]>(WORKTREE_MANIFEST_KEY, []);
	}

	private async saveManifest(entries: WorktreeEntry[]): Promise<void> {
		await this.state.update(WORKTREE_MANIFEST_KEY, entries);
	}
}
