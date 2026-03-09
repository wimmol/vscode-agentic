import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockMemento, EventEmitter } from "../__mocks__/vscode";
import { AgentsStore } from "../../src/services/agents-store";
import type { AgentEntry } from "../../src/models/agent";

describe("AgentsStore", () => {
	let memento: ReturnType<typeof createMockMemento>;
	let store: AgentsStore;

	beforeEach(() => {
		memento = createMockMemento();
		store = new AgentsStore(memento);
	});

	describe("getAll", () => {
		it("returns empty array when no data", () => {
			expect(store.getAll()).toEqual([]);
		});

		it("returns saved entries after save", async () => {
			const entries: AgentEntry[] = [
				{
					agentName: "agent-1",
					repoPath: "/repo/a",
					status: "created",
					createdAt: "2026-01-01T00:00:00Z",
				},
			];
			await store.save(entries);
			expect(store.getAll()).toEqual(entries);
		});
	});

	describe("getForRepo", () => {
		it("filters by repoPath", async () => {
			const entries: AgentEntry[] = [
				{
					agentName: "agent-1",
					repoPath: "/repo/a",
					status: "created",
					createdAt: "2026-01-01T00:00:00Z",
				},
				{
					agentName: "agent-2",
					repoPath: "/repo/b",
					status: "running",
					createdAt: "2026-01-01T00:00:00Z",
				},
				{
					agentName: "agent-3",
					repoPath: "/repo/a",
					status: "finished",
					createdAt: "2026-01-01T00:00:00Z",
				},
			];
			await store.save(entries);

			const result = store.getForRepo("/repo/a");
			expect(result).toHaveLength(2);
			expect(result[0].agentName).toBe("agent-1");
			expect(result[1].agentName).toBe("agent-3");
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
			// (EventEmitter clears listeners on dispose)
		});
	});
});
