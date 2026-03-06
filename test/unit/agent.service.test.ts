import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento } from "../__mocks__/vscode";
import type { AgentEntry } from "../../src/models/agent";
import { AGENT_REGISTRY_KEY } from "../../src/models/agent";
import { AgentService } from "../../src/services/agent.service";

function createMockWorktreeService() {
	return {
		addWorktree: vi.fn().mockResolvedValue({
			path: "/repo/.worktrees/test-agent",
			branch: "test-agent",
			agentName: "test-agent",
			repoPath: "/repo",
			createdAt: "2026-01-01T00:00:00.000Z",
		}),
		removeWorktree: vi.fn().mockResolvedValue(undefined),
		getManifest: vi.fn().mockReturnValue([
			{
				path: "/repo/.worktrees/test-agent",
				branch: "test-agent",
				agentName: "test-agent",
				repoPath: "/repo",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		]),
	};
}

function createMockTerminalService() {
	return {
		createTerminal: vi.fn().mockReturnValue({ show: vi.fn() }),
		disposeTerminal: vi.fn(),
		showTerminal: vi.fn(),
		hasTerminal: vi.fn().mockReturnValue(false),
		dispose: vi.fn(),
	};
}

describe("AgentService", () => {
	let service: AgentService;
	let state: ReturnType<typeof createMockMemento>;
	let worktreeService: ReturnType<typeof createMockWorktreeService>;
	let terminalService: ReturnType<typeof createMockTerminalService>;

	beforeEach(() => {
		vi.clearAllMocks();
		state = createMockMemento();
		worktreeService = createMockWorktreeService();
		terminalService = createMockTerminalService();
		service = new AgentService(state, worktreeService as never);
		service.setTerminalService(terminalService as never);
	});

	describe("createAgent", () => {
		it("persists a new AgentEntry with status 'created'", async () => {
			const entry = await service.createAgent("/repo", "my-agent");

			expect(entry.status).toBe("created");
			expect(entry.agentName).toBe("my-agent");
			expect(entry.repoPath).toBe("/repo");
		});

		it("calls WorktreeService.addWorktree", async () => {
			await service.createAgent("/repo", "my-agent");

			expect(worktreeService.addWorktree).toHaveBeenCalledWith("/repo", "my-agent");
		});

		it("stores initialPrompt when provided", async () => {
			const entry = await service.createAgent("/repo", "my-agent", "Fix the auth bug");

			expect(entry.initialPrompt).toBe("Fix the auth bug");
		});

		it("stores initialPrompt as undefined when not provided", async () => {
			const entry = await service.createAgent("/repo", "my-agent");

			expect(entry.initialPrompt).toBeUndefined();
		});

		it("sets createdAt to an ISO timestamp", async () => {
			const entry = await service.createAgent("/repo", "my-agent");

			// ISO format: 2026-01-01T00:00:00.000Z
			expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it("persists the entry in Memento", async () => {
			await service.createAgent("/repo", "my-agent");

			const registry = state.get(AGENT_REGISTRY_KEY, []) as AgentEntry[];
			expect(registry).toHaveLength(1);
			expect(registry[0].agentName).toBe("my-agent");
		});
	});

	describe("getAgent", () => {
		it("returns the AgentEntry for a given repoPath+agentName", async () => {
			await service.createAgent("/repo", "my-agent");

			const entry = service.getAgent("/repo", "my-agent");

			expect(entry).toBeDefined();
			expect(entry?.agentName).toBe("my-agent");
			expect(entry?.repoPath).toBe("/repo");
		});

		it("returns undefined if not found", () => {
			const entry = service.getAgent("/repo", "nonexistent");

			expect(entry).toBeUndefined();
		});
	});

	describe("getAll", () => {
		it("returns all agent entries across all repos", async () => {
			await service.createAgent("/repo1", "agent-1");
			await service.createAgent("/repo2", "agent-2");

			const all = service.getAll();

			expect(all).toHaveLength(2);
		});
	});

	describe("getForRepo", () => {
		it("returns only agents for the given repoPath", async () => {
			await service.createAgent("/repo1", "agent-1");
			await service.createAgent("/repo2", "agent-2");
			await service.createAgent("/repo1", "agent-3");

			const repo1Agents = service.getForRepo("/repo1");

			expect(repo1Agents).toHaveLength(2);
			expect(repo1Agents.every((a) => a.repoPath === "/repo1")).toBe(true);
		});
	});

	describe("deleteAgent", () => {
		it("calls TerminalService.disposeTerminal before WorktreeService.removeWorktree", async () => {
			await service.createAgent("/repo", "my-agent");

			const callOrder: string[] = [];
			terminalService.disposeTerminal.mockImplementation(() => {
				callOrder.push("disposeTerminal");
			});
			worktreeService.removeWorktree.mockImplementation(async () => {
				callOrder.push("removeWorktree");
			});

			await service.deleteAgent("/repo", "my-agent");

			expect(callOrder).toEqual(["disposeTerminal", "removeWorktree"]);
		});

		it("removes the AgentEntry from Memento", async () => {
			await service.createAgent("/repo", "my-agent");
			expect(service.getAll()).toHaveLength(1);

			await service.deleteAgent("/repo", "my-agent");

			expect(service.getAll()).toHaveLength(0);
		});

		it("is a no-op if the agent does not exist", async () => {
			// Should not throw
			await service.deleteAgent("/repo", "nonexistent");

			expect(terminalService.disposeTerminal).not.toHaveBeenCalled();
			expect(worktreeService.removeWorktree).not.toHaveBeenCalled();
		});
	});

	describe("focusAgent", () => {
		it("creates a terminal when agent status is 'created'", async () => {
			await service.createAgent("/repo", "test-agent");

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalledWith(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				undefined,
			);
		});

		it("creates a terminal with initialPrompt when agent has one", async () => {
			await service.createAgent("/repo", "test-agent", "Fix bugs");

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalledWith(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				"Fix bugs",
			);
		});

		it("updates status to 'running' after creating terminal", async () => {
			await service.createAgent("/repo", "test-agent");

			await service.focusAgent("/repo", "test-agent");

			const entry = service.getAgent("/repo", "test-agent");
			expect(entry?.status).toBe("running");
		});

		it("calls showTerminal when agent status is already 'running'", async () => {
			await service.createAgent("/repo", "test-agent");
			await service.focusAgent("/repo", "test-agent"); // Sets to running

			await service.focusAgent("/repo", "test-agent"); // Now should showTerminal

			expect(terminalService.showTerminal).toHaveBeenCalledWith("/repo", "test-agent");
		});

		it("creates terminal when agent status is 'finished'", async () => {
			await service.createAgent("/repo", "test-agent");
			await service.updateStatus("/repo", "test-agent", "finished", 0);

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalled();
		});

		it("creates terminal when agent status is 'error'", async () => {
			await service.createAgent("/repo", "test-agent");
			await service.updateStatus("/repo", "test-agent", "error", 1);

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalled();
		});

		it("looks up worktree path from WorktreeService.getManifest", async () => {
			await service.createAgent("/repo", "test-agent");

			await service.focusAgent("/repo", "test-agent");

			expect(worktreeService.getManifest).toHaveBeenCalledWith("/repo");
		});

		it("returns silently if agent does not exist", async () => {
			// Should not throw
			await service.focusAgent("/repo", "nonexistent");

			expect(terminalService.createTerminal).not.toHaveBeenCalled();
		});

		it("returns silently if worktree not found in manifest", async () => {
			await service.createAgent("/repo", "test-agent");
			worktreeService.getManifest.mockReturnValue([]);

			// Should not throw
			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).not.toHaveBeenCalled();
		});
	});

	describe("updateStatus", () => {
		it("updates the agent status in Memento", async () => {
			await service.createAgent("/repo", "my-agent");

			await service.updateStatus("/repo", "my-agent", "running");

			const entry = service.getAgent("/repo", "my-agent");
			expect(entry?.status).toBe("running");
		});

		it("updates the exitCode when provided", async () => {
			await service.createAgent("/repo", "my-agent");

			await service.updateStatus("/repo", "my-agent", "error", 1);

			const entry = service.getAgent("/repo", "my-agent");
			expect(entry?.exitCode).toBe(1);
		});
	});

	describe("reconcileOnActivation", () => {
		it("sets all agents with status 'running' back to 'created'", async () => {
			await service.createAgent("/repo", "agent-1");
			await service.updateStatus("/repo", "agent-1", "running");
			await service.createAgent("/repo", "agent-2");
			await service.updateStatus("/repo", "agent-2", "running");

			await service.reconcileOnActivation();

			const agent1 = service.getAgent("/repo", "agent-1");
			const agent2 = service.getAgent("/repo", "agent-2");
			expect(agent1?.status).toBe("created");
			expect(agent2?.status).toBe("created");
		});

		it("does not modify agents with other statuses", async () => {
			await service.createAgent("/repo", "created-agent");
			await service.createAgent("/repo", "finished-agent");
			await service.updateStatus("/repo", "finished-agent", "finished", 0);
			await service.createAgent("/repo", "error-agent");
			await service.updateStatus("/repo", "error-agent", "error", 1);

			await service.reconcileOnActivation();

			expect(service.getAgent("/repo", "created-agent")?.status).toBe("created");
			expect(service.getAgent("/repo", "finished-agent")?.status).toBe("finished");
			expect(service.getAgent("/repo", "error-agent")?.status).toBe("error");
		});

		it("clears exitCode for reconciled running agents", async () => {
			await service.createAgent("/repo", "agent-1");
			await service.updateStatus("/repo", "agent-1", "running");

			await service.reconcileOnActivation();

			const entry = service.getAgent("/repo", "agent-1");
			expect(entry?.exitCode).toBeUndefined();
		});
	});

	describe("onDidChange event", () => {
		it("fires after createAgent", async () => {
			const listener = vi.fn();
			service.onDidChange(listener);

			await service.createAgent("/repo", "my-agent");

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("fires after deleteAgent", async () => {
			await service.createAgent("/repo", "my-agent");
			const listener = vi.fn();
			service.onDidChange(listener);

			await service.deleteAgent("/repo", "my-agent");

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("fires after updateStatus", async () => {
			await service.createAgent("/repo", "my-agent");
			const listener = vi.fn();
			service.onDidChange(listener);

			await service.updateStatus("/repo", "my-agent", "running");

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("fires after reconcileOnActivation when changes occur", async () => {
			await service.createAgent("/repo", "my-agent");
			await service.updateStatus("/repo", "my-agent", "running");
			const listener = vi.fn();
			service.onDidChange(listener);

			await service.reconcileOnActivation();

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("does NOT fire on reconcileOnActivation when no running agents exist", async () => {
			await service.createAgent("/repo", "my-agent"); // status is "created"
			const listener = vi.fn();
			service.onDidChange(listener);

			await service.reconcileOnActivation();

			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("finishedAt field", () => {
		it("sets finishedAt when transitioning to 'finished'", async () => {
			await service.createAgent("/repo", "my-agent");

			await service.updateStatus("/repo", "my-agent", "finished", 0);

			const entry = service.getAgent("/repo", "my-agent");
			expect(entry?.finishedAt).toBeDefined();
			expect(entry?.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it("sets finishedAt when transitioning to 'error'", async () => {
			await service.createAgent("/repo", "my-agent");

			await service.updateStatus("/repo", "my-agent", "error", 1);

			const entry = service.getAgent("/repo", "my-agent");
			expect(entry?.finishedAt).toBeDefined();
			expect(entry?.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it("does NOT set finishedAt when transitioning to 'running'", async () => {
			await service.createAgent("/repo", "my-agent");

			await service.updateStatus("/repo", "my-agent", "running");

			const entry = service.getAgent("/repo", "my-agent");
			expect(entry?.finishedAt).toBeUndefined();
		});

		it("does NOT set finishedAt when transitioning to 'created'", async () => {
			await service.createAgent("/repo", "my-agent");

			await service.updateStatus("/repo", "my-agent", "created");

			const entry = service.getAgent("/repo", "my-agent");
			expect(entry?.finishedAt).toBeUndefined();
		});

		it("clears finishedAt when transitioning from finished back to running", async () => {
			await service.createAgent("/repo", "my-agent");
			await service.updateStatus("/repo", "my-agent", "finished", 0);
			expect(service.getAgent("/repo", "my-agent")?.finishedAt).toBeDefined();

			await service.updateStatus("/repo", "my-agent", "running");

			const entry = service.getAgent("/repo", "my-agent");
			expect(entry?.finishedAt).toBeUndefined();
		});
	});

	describe("setTerminalService", () => {
		it("throws in focusAgent if terminalService is not set", async () => {
			const svc = new AgentService(state, worktreeService as never);
			await svc.createAgent("/repo", "test-agent");

			await expect(svc.focusAgent("/repo", "test-agent")).rejects.toThrow();
		});

		it("throws in deleteAgent if terminalService is not set", async () => {
			const svc = new AgentService(state, worktreeService as never);
			await svc.createAgent("/repo", "test-agent");

			await expect(svc.deleteAgent("/repo", "test-agent")).rejects.toThrow();
		});
	});
});
