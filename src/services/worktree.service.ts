import * as path from "node:path";
import type * as vscode from "vscode";
import { DEFAULT_WORKTREE_LIMIT } from "../models/repo";
import {
	WORKTREE_DIR_NAME,
	WORKTREE_MANIFEST_KEY,
	type WorktreeEntry,
	type WorktreeOnDisk,
} from "../models/worktree";
import { parseWorktreeList } from "../utils/worktree-parser";
import type { GitService } from "./git.service";

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
	private readonly locks = new Map<string, Promise<void>>();

	constructor(
		private readonly git: GitService,
		private readonly state: vscode.Memento,
	) {}

	/**
	 * Simple per-repo mutex: queues operations so only one runs at a time per repo.
	 */
	private async withLock<T>(repoPath: string, fn: () => Promise<T>): Promise<T> {
		// Wait for any pending operation on this repo
		const pending = this.locks.get(repoPath) ?? Promise.resolve();

		let resolve!: () => void;
		const next = new Promise<void>((r) => {
			resolve = r;
		});
		this.locks.set(repoPath, next);

		await pending;
		try {
			return await fn();
		} finally {
			resolve();
		}
	}

	/**
	 * Create a new worktree for an agent.
	 * Throws WorktreeLimitError if the per-repo limit is reached.
	 */
	async addWorktree(
		repoPath: string,
		agentName: string,
		startPoint?: string,
		limit: number = DEFAULT_WORKTREE_LIMIT,
	): Promise<WorktreeEntry> {
		return this.withLock(repoPath, async () => {
			const existing = this.getManifest(repoPath);

			if (existing.length >= limit) {
				throw new WorktreeLimitError(repoPath, limit, existing);
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
	 * Remove an agent's worktree and its branch.
	 * Handles missing worktrees/branches gracefully.
	 */
	async removeWorktree(repoPath: string, agentName: string): Promise<void> {
		return this.withLock(repoPath, async () => {
			const allEntries = this.getAllManifestEntries();
			const entry = allEntries.find((e) => e.agentName === agentName && e.repoPath === repoPath);

			if (entry) {
				// Try to remove the worktree from disk
				try {
					await this.git.exec(repoPath, ["worktree", "remove", "--force", entry.path]);
				} catch {
					// Worktree may already be gone -- that's fine
				}

				// Try to delete the branch
				try {
					await this.git.exec(repoPath, ["branch", "-D", entry.branch]);
				} catch {
					// Branch may already be gone -- that's fine
				}

				// Remove from manifest
				const updated = allEntries.filter(
					(e) => !(e.agentName === agentName && e.repoPath === repoPath),
				);
				await this.saveManifest(updated);
			}
		});
	}

	/**
	 * Get all manifest entries for a specific repo.
	 */
	getManifest(repoPath: string): WorktreeEntry[] {
		return this.getAllManifestEntries().filter((e) => e.repoPath === repoPath);
	}

	/**
	 * Reconcile manifest vs disk state.
	 * - Removes orphaned manifest entries (worktree no longer on disk)
	 * - Removes orphaned disk worktrees (under .worktrees/ but not in manifest)
	 * - Returns a report of what was found and cleaned
	 */
	async reconcile(repoPath: string): Promise<ReconciliationResult> {
		const manifestEntries = this.getManifest(repoPath);

		// Get actual worktrees on disk
		const output = await this.git.exec(repoPath, ["worktree", "list", "--porcelain"]);
		const diskEntries = parseWorktreeList(output);

		// Build set of disk paths for fast lookup
		const diskPaths = new Set(diskEntries.map((d) => d.path));

		// Build set of manifest paths for fast lookup
		const manifestPaths = new Set(manifestEntries.map((m) => m.path));

		// Worktrees dir prefix for scoping orphan detection
		const worktreesPrefix = path.join(repoPath, WORKTREE_DIR_NAME);

		// Entries in manifest but NOT on disk
		const orphanedInManifest = manifestEntries.filter((m) => !diskPaths.has(m.path));

		// Entries on disk (under .worktrees/) but NOT in manifest
		const orphanedOnDisk = diskEntries.filter(
			(d) => d.path.startsWith(worktreesPrefix) && !manifestPaths.has(d.path),
		);

		// Entries in both manifest and on disk
		const healthy = manifestEntries.filter((m) => diskPaths.has(m.path));

		// Clean up orphaned manifest entries
		if (orphanedInManifest.length > 0) {
			const orphanPaths = new Set(orphanedInManifest.map((o) => o.path));
			const allEntries = this.getAllManifestEntries();
			const cleaned = allEntries.filter((e) => !orphanPaths.has(e.path));
			await this.saveManifest(cleaned);
		}

		// Clean up orphaned disk worktrees
		for (const orphan of orphanedOnDisk) {
			try {
				await this.git.exec(repoPath, ["worktree", "remove", "--force", orphan.path]);
			} catch {
				// Best effort -- log in production, ignore in tests
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
