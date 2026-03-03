import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento } from "../__mocks__/vscode.js";
import { AgentService } from "../../src/services/agent.service.js";
import { AGENT_REGISTRY_KEY } from "../../src/models/agent.js";
import type { AgentEntry } from "../../src/models/agent.js";

// Mock WorktreeService
function createMockWorktreeService() {
	return {
		addWorktree: vi.fn().mockResolvedValue({
			path: "/repo/.worktrees/test-agent",
			branch: "test-agent",
			agentName: "test-agent",
			repoPath: "/repo",
			createdAt: new Date().toISOString(),
		}),
		removeWorktree: vi.fn().mockResolvedValue(undefined),
		getManifest: vi.fn().mockReturnValue([
			{
				path: "/repo/.worktrees/test-agent",
				branch: "test-agent",
				agentName: "test-agent",
				repoPath: "/repo",
				createdAt: new Date().toISOString(),
			},
		]),
	};
}

// Mock TerminalService
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
			const entry = await service.createAgent("/repo", "test-agent");

			expect(entry.status).toBe("created");
			expect(entry.agentName).toBe("test-agent");
			expect(entry.repoPath).toBe("/repo");
		});

		it("calls WorktreeService.addWorktree", async () => {
			await service.createAgent("/repo", "test-agent");

			expect(worktreeService.addWorktree).toHaveBeenCalledWith("/repo", "test-agent");
		});

		it("stores initialPrompt when provided", async () => {
			const entry = await service.createAgent("/repo", "test-agent", "Fix the bug");

			expect(entry.initialPrompt).toBe("Fix the bug");
		});

		it("stores undefined initialPrompt when not provided", async () => {
			const entry = await service.createAgent("/repo", "test-agent");

			expect(entry.initialPrompt).toBeUndefined();
		});

		it("sets createdAt to an ISO timestamp", async () => {
			const before = new Date().toISOString();
			const entry = await service.createAgent("/repo", "test-agent");
			const after = new Date().toISOString();

			expect(entry.createdAt).toBeDefined();
			expect(entry.createdAt >= before).toBe(true);
			expect(entry.createdAt <= after).toBe(true);
		});

		it("appends entry to the registry in Memento", async () => {
			await service.createAgent("/repo", "agent-1");
			await service.createAgent("/repo", "agent-2");

			const registry = state.get(AGENT_REGISTRY_KEY, []) as AgentEntry[];
			expect(registry).toHaveLength(2);
			expect(registry[0].agentName).toBe("agent-1");
			expect(registry[1].agentName).toBe("agent-2");
		});
	});

	describe("getAgent", () => {
		it("returns the AgentEntry for a given repoPath+agentName", async () => {
			await service.createAgent("/repo", "test-agent");

			const found = service.getAgent("/repo", "test-agent");
			expect(found).toBeDefined();
			expect(found!.agentName).toBe("test-agent");
			expect(found!.repoPath).toBe("/repo");
		});

		it("returns undefined if not found", () => {
			const found = service.getAgent("/repo", "nonexistent");
			expect(found).toBeUndefined();
		});
	});

	describe("getAll", () => {
		it("returns all agent entries across all repos", async () => {
			await service.createAgent("/repo1", "agent-1");
			worktreeService.addWorktree.mockResolvedValue({
				path: "/repo2/.worktrees/agent-2",
				branch: "agent-2",
				agentName: "agent-2",
				repoPath: "/repo2",
				createdAt: new Date().toISOString(),
			});
			await service.createAgent("/repo2", "agent-2");

			const all = service.getAll();
			expect(all).toHaveLength(2);
		});
	});

	describe("getForRepo", () => {
		it("returns only agents for the given repoPath", async () => {
			await service.createAgent("/repo1", "agent-1");
			worktreeService.addWorktree.mockResolvedValue({
				path: "/repo2/.worktrees/agent-2",
				branch: "agent-2",
				agentName: "agent-2",
				repoPath: "/repo2",
				createdAt: new Date().toISOString(),
			});
			await service.createAgent("/repo2", "agent-2");

			const repo1Agents = service.getForRepo("/repo1");
			expect(repo1Agents).toHaveLength(1);
			expect(repo1Agents[0].agentName).toBe("agent-1");
		});
	});

	describe("deleteAgent", () => {
		it("calls TerminalService.disposeTerminal, WorktreeService.removeWorktree, and removes from registry", async () => {
			await service.createAgent("/repo", "test-agent");

			await service.deleteAgent("/repo", "test-agent");

			expect(terminalService.disposeTerminal).toHaveBeenCalledWith("/repo", "test-agent");
			expect(worktreeService.removeWorktree).toHaveBeenCalledWith("/repo", "test-agent");

			const registry = state.get(AGENT_REGISTRY_KEY, []) as AgentEntry[];
			expect(registry).toHaveLength(0);
		});

		it("calls disposeTerminal before removeWorktree", async () => {
			const callOrder: string[] = [];
			terminalService.disposeTerminal.mockImplementation(() => {
				callOrder.push("disposeTerminal");
			});
			worktreeService.removeWorktree.mockImplementation(async () => {
				callOrder.push("removeWorktree");
			});

			await service.createAgent("/repo", "test-agent");
			await service.deleteAgent("/repo", "test-agent");

			expect(callOrder).toEqual(["disposeTerminal", "removeWorktree"]);
		});

		it("is a no-op if the agent does not exist", async () => {
			await service.deleteAgent("/repo", "nonexistent");

			expect(terminalService.disposeTerminal).not.toHaveBeenCalled();
			expect(worktreeService.removeWorktree).not.toHaveBeenCalled();
		});
	});

	describe("focusAgent", () => {
		it("creates a terminal when agent status is 'created' and updates status to 'running'", async () => {
			await service.createAgent("/repo", "test-agent");

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalledWith(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				undefined,
			);
			const agent = service.getAgent("/repo", "test-agent");
			expect(agent!.status).toBe("running");
		});

		it("creates a terminal when agent status is 'finished'", async () => {
			await service.createAgent("/repo", "test-agent");
			await service.updateStatus("/repo", "test-agent", "finished", 0);

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalled();
			expect(service.getAgent("/repo", "test-agent")!.status).toBe("running");
		});

		it("creates a terminal when agent status is 'error'", async () => {
			await service.createAgent("/repo", "test-agent");
			await service.updateStatus("/repo", "test-agent", "error", 1);

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalled();
			expect(service.getAgent("/repo", "test-agent")!.status).toBe("running");
		});

		it("calls TerminalService.showTerminal when agent status is 'running'", async () => {
			await service.createAgent("/repo", "test-agent");
			await service.updateStatus("/repo", "test-agent", "running");

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.showTerminal).toHaveBeenCalledWith("/repo", "test-agent");
			expect(terminalService.createTerminal).not.toHaveBeenCalled();
		});

		it("looks up worktree path from WorktreeService.getManifest", async () => {
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/test-agent",
					branch: "test-agent",
					agentName: "test-agent",
					repoPath: "/repo",
					createdAt: new Date().toISOString(),
				},
			]);

			await service.createAgent("/repo", "test-agent");
			await service.focusAgent("/repo", "test-agent");

			expect(worktreeService.getManifest).toHaveBeenCalledWith("/repo");
			expect(terminalService.createTerminal).toHaveBeenCalledWith(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				undefined,
			);
		});

		it("returns silently if agent not found", async () => {
			await service.focusAgent("/repo", "nonexistent");

			expect(terminalService.createTerminal).not.toHaveBeenCalled();
			expect(terminalService.showTerminal).not.toHaveBeenCalled();
		});

		it("returns silently if worktree not found in manifest", async () => {
			worktreeService.getManifest.mockReturnValue([]);

			await service.createAgent("/repo", "test-agent");
			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).not.toHaveBeenCalled();
		});

		it("passes initialPrompt when creating terminal", async () => {
			await service.createAgent("/repo", "test-agent", "Fix auth");

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalledWith(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				"Fix auth",
			);
		});
	});

	describe("updateStatus", () => {
		it("updates the agent's status and exitCode in Memento", async () => {
			await service.createAgent("/repo", "test-agent");

			await service.updateStatus("/repo", "test-agent", "finished", 0);

			const agent = service.getAgent("/repo", "test-agent");
			expect(agent!.status).toBe("finished");
			expect(agent!.exitCode).toBe(0);
		});

		it("sets exitCode to undefined when not provided", async () => {
			await service.createAgent("/repo", "test-agent");
			await service.updateStatus("/repo", "test-agent", "error", 1);
			await service.updateStatus("/repo", "test-agent", "running");

			const agent = service.getAgent("/repo", "test-agent");
			expect(agent!.status).toBe("running");
			expect(agent!.exitCode).toBeUndefined();
		});
	});

	describe("reconcileOnActivation", () => {
		it("sets all agents with status 'running' back to 'created'", async () => {
			await service.createAgent("/repo", "agent-1");
			await service.updateStatus("/repo", "agent-1", "running");
			await service.createAgent("/repo", "agent-2");
			await service.updateStatus("/repo", "agent-2", "running");

			await service.reconcileOnActivation();

			expect(service.getAgent("/repo", "agent-1")!.status).toBe("created");
			expect(service.getAgent("/repo", "agent-2")!.status).toBe("created");
		});

		it("does not modify agents with other statuses", async () => {
			await service.createAgent("/repo", "created-agent");
			await service.createAgent("/repo", "finished-agent");
			await service.updateStatus("/repo", "finished-agent", "finished", 0);
			await service.createAgent("/repo", "error-agent");
			await service.updateStatus("/repo", "error-agent", "error", 1);

			await service.reconcileOnActivation();

			expect(service.getAgent("/repo", "created-agent")!.status).toBe("created");
			expect(service.getAgent("/repo", "finished-agent")!.status).toBe("finished");
			expect(service.getAgent("/repo", "error-agent")!.status).toBe("error");
		});

		it("clears exitCode when resetting running agents", async () => {
			await service.createAgent("/repo", "agent-1");
			// Manually set to running with an exitCode (unusual but tests the clear)
			const registry = state.get(AGENT_REGISTRY_KEY, []) as AgentEntry[];
			registry[0].status = "running";
			registry[0].exitCode = 42;
			await state.update(AGENT_REGISTRY_KEY, registry);

			await service.reconcileOnActivation();

			const agent = service.getAgent("/repo", "agent-1");
			expect(agent!.status).toBe("created");
			expect(agent!.exitCode).toBeUndefined();
		});
	});

	describe("setTerminalService", () => {
		it("allows setting terminalService after construction", () => {
			const svc = new AgentService(state, worktreeService as never);
			// Should not throw
			svc.setTerminalService(terminalService as never);
		});
	});
});
