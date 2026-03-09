import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockMemento, EventEmitter } from "../__mocks__/vscode";
import { ReposStore } from "../../src/services/repos-store";
import type { RepoConfig } from "../../src/models/repo";

describe("ReposStore", () => {
	let memento: ReturnType<typeof createMockMemento>;
	let store: ReposStore;

	beforeEach(() => {
		memento = createMockMemento();
		store = new ReposStore(memento);
	});

	describe("getAll", () => {
		it("returns empty array when no data", () => {
			expect(store.getAll()).toEqual([]);
		});

		it("returns saved entries after save", async () => {
			const configs: RepoConfig[] = [
				{
					path: "/repo/a",
					stagingBranch: "staging",
					worktreeLimit: 5,
				},
			];
			await store.save(configs);
			expect(store.getAll()).toEqual(configs);
		});
	});

	describe("getForRepo", () => {
		it("returns matching config", async () => {
			const configs: RepoConfig[] = [
				{ path: "/repo/a", stagingBranch: "staging", worktreeLimit: 5 },
				{ path: "/repo/b", stagingBranch: "main", worktreeLimit: 3 },
			];
			await store.save(configs);

			const result = store.getForRepo("/repo/b");
			expect(result).toBeDefined();
			expect(result?.stagingBranch).toBe("main");
		});

		it("returns undefined for missing repo", async () => {
			const configs: RepoConfig[] = [
				{ path: "/repo/a", stagingBranch: "staging", worktreeLimit: 5 },
			];
			await store.save(configs);

			expect(store.getForRepo("/repo/missing")).toBeUndefined();
		});
	});

	describe("save", () => {
		it("fires onDidChange event", async () => {
			const listener = vi.fn();
			store.onDidChange(listener);

			await store.save([]);
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe("dispose", () => {
		it("disposes the EventEmitter", () => {
			const listener = vi.fn();
			store.onDidChange(listener);

			store.dispose();

			// After dispose, firing should not notify listeners
		});
	});
});
