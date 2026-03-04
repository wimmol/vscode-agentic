import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter, TreeItemCollapsibleState } from "../__mocks__/vscode.js";
import { AgentTreeProvider } from "../../src/views/agent-tree-provider.js";
import { AgentTreeItem, RepoGroupItem } from "../../src/views/agent-tree-items.js";
import type { AgentEntry } from "../../src/models/agent.js";

function createMockAgentService() {
	const emitter = new EventEmitter<void>();
	return {
		getAll: vi.fn<() => AgentEntry[]>().mockReturnValue([]),
		getForRepo: vi.fn<(repoPath: string) => AgentEntry[]>().mockReturnValue([]),
		onDidChangeAgents: emitter.event,
		_emitter: emitter,
	};
}

function makeAgent(
	agentName: string,
	repoPath: string,
	status: AgentEntry["status"],
	initialPrompt?: string,
): AgentEntry {
	return {
		agentName,
		repoPath,
		status,
		initialPrompt,
		createdAt: new Date().toISOString(),
	};
}

describe("AgentTreeProvider", () => {
	let agentService: ReturnType<typeof createMockAgentService>;
	let provider: AgentTreeProvider;

	beforeEach(() => {
		vi.clearAllMocks();
		agentService = createMockAgentService();
		provider = new AgentTreeProvider(agentService as never);
	});

	describe("getChildren(undefined) - root level", () => {
		it("returns RepoGroupItem per repo that has agents", async () => {
			agentService.getAll.mockReturnValue([
				makeAgent("agent-1", "/repo1", "running"),
				makeAgent("agent-2", "/repo2", "created"),
			]);

			const children = await provider.getChildren(undefined);

			expect(children).toHaveLength(2);
			expect(children[0]).toBeInstanceOf(RepoGroupItem);
			expect(children[1]).toBeInstanceOf(RepoGroupItem);
		});

		it("returns empty array when no agents exist", async () => {
			agentService.getAll.mockReturnValue([]);

			const children = await provider.getChildren(undefined);

			expect(children).toEqual([]);
		});

		it("groups multiple agents from same repo into one RepoGroupItem", async () => {
			agentService.getAll.mockReturnValue([
				makeAgent("agent-1", "/repo1", "running"),
				makeAgent("agent-2", "/repo1", "created"),
			]);

			const children = await provider.getChildren(undefined);

			expect(children).toHaveLength(1);
			expect((children[0] as RepoGroupItem).repoPath).toBe("/repo1");
		});
	});

	describe("getChildren(repoGroup) - agent level", () => {
		it("returns AgentTreeItem[] sorted by status priority then name", async () => {
			const repoGroup = new RepoGroupItem("/repo");
			agentService.getForRepo.mockReturnValue([
				makeAgent("zebra", "/repo", "created"),
				makeAgent("alpha", "/repo", "running"),
				makeAgent("beta", "/repo", "running"),
			]);

			const children = await provider.getChildren(repoGroup);

			expect(children).toHaveLength(3);
			expect(children[0]).toBeInstanceOf(AgentTreeItem);
			// running agents first (alphabetical), then created
			expect((children[0] as AgentTreeItem).agentName).toBe("alpha");
			expect((children[1] as AgentTreeItem).agentName).toBe("beta");
			expect((children[2] as AgentTreeItem).agentName).toBe("zebra");
		});

		it("sorts: running > created > finished > error, then alphabetical", async () => {
			const repoGroup = new RepoGroupItem("/repo");
			agentService.getForRepo.mockReturnValue([
				makeAgent("err-agent", "/repo", "error"),
				makeAgent("done-agent", "/repo", "finished"),
				makeAgent("new-agent", "/repo", "created"),
				makeAgent("active-agent", "/repo", "running"),
			]);

			const children = await provider.getChildren(repoGroup);

			expect((children[0] as AgentTreeItem).agentName).toBe("active-agent");
			expect((children[1] as AgentTreeItem).agentName).toBe("new-agent");
			expect((children[2] as AgentTreeItem).agentName).toBe("done-agent");
			expect((children[3] as AgentTreeItem).agentName).toBe("err-agent");
		});

		it("sorts suspended between created and finished", async () => {
			const repoGroup = new RepoGroupItem("/repo");
			agentService.getForRepo.mockReturnValue([
				makeAgent("err-agent", "/repo", "error"),
				makeAgent("done-agent", "/repo", "finished"),
				makeAgent("paused-agent", "/repo", "suspended"),
				makeAgent("new-agent", "/repo", "created"),
				makeAgent("active-agent", "/repo", "running"),
			]);

			const children = await provider.getChildren(repoGroup);

			expect((children[0] as AgentTreeItem).agentName).toBe("active-agent");
			expect((children[1] as AgentTreeItem).agentName).toBe("new-agent");
			expect((children[2] as AgentTreeItem).agentName).toBe("paused-agent");
			expect((children[3] as AgentTreeItem).agentName).toBe("done-agent");
			expect((children[4] as AgentTreeItem).agentName).toBe("err-agent");
		});
	});

	describe("getChildren(agentItem) - leaf level", () => {
		it("returns empty array for agent items (leaf nodes)", async () => {
			const agentItem = new AgentTreeItem("fix-bug", "/repo", "running");

			const children = await provider.getChildren(agentItem);

			expect(children).toEqual([]);
		});
	});

	describe("getParent", () => {
		it("returns RepoGroupItem for AgentTreeItem", () => {
			const agentItem = new AgentTreeItem("fix-bug", "/repo", "running");

			const parent = provider.getParent(agentItem);

			expect(parent).toBeInstanceOf(RepoGroupItem);
			expect((parent as RepoGroupItem).repoPath).toBe("/repo");
		});

		it("returns undefined for RepoGroupItem", () => {
			const repoGroup = new RepoGroupItem("/repo");

			const parent = provider.getParent(repoGroup);

			expect(parent).toBeUndefined();
		});
	});

	describe("getTreeItem", () => {
		it("returns the element itself", () => {
			const item = new AgentTreeItem("fix-bug", "/repo", "running");

			const result = provider.getTreeItem(item);

			expect(result).toBe(item);
		});
	});

	describe("refresh", () => {
		it("fires onDidChangeTreeData event", () => {
			const listener = vi.fn();
			provider.onDidChangeTreeData(listener);

			provider.refresh();

			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe("auto-refresh on agent changes", () => {
		it("calls refresh when agentService fires onDidChangeAgents", async () => {
			const listener = vi.fn();
			provider.onDidChangeTreeData(listener);

			// Fire the agent change event
			agentService._emitter.fire();

			// Debounce delay -- wait 200ms to ensure debounced refresh fires
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(listener).toHaveBeenCalled();
		});
	});

	describe("dispose", () => {
		it("does not throw when called", () => {
			expect(() => provider.dispose()).not.toThrow();
		});
	});
});
