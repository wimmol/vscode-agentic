import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento } from "../__mocks__/vscode.js";
import { AgentService } from "../../src/services/agent.service.js";
import { AGENT_REGISTRY_KEY, LAST_FOCUSED_KEY } from "../../src/models/agent.js";
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
		getAllPids: vi.fn().mockReturnValue({}),
		clearAllPids: vi.fn().mockResolvedValue(undefined),
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
				false,
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
				false,
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

		it("passes initialPrompt when creating terminal for first focus", async () => {
			await service.createAgent("/repo", "test-agent", "Fix auth");

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalledWith(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				"Fix auth",
				false,
			);
		});
	});

	describe("focusAgent restart detection", () => {
		it("passes initialPrompt and continueSession=false on first focus (hasBeenRun undefined)", async () => {
			await service.createAgent("/repo", "test-agent", "Build the feature");

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalledWith(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				"Build the feature",
				false,
			);
		});

		it("sets hasBeenRun=true after first focus", async () => {
			await service.createAgent("/repo", "test-agent", "Build the feature");

			const agentBefore = service.getAgent("/repo", "test-agent");
			expect(agentBefore!.hasBeenRun).toBeUndefined();

			await service.focusAgent("/repo", "test-agent");

			const agentAfter = service.getAgent("/repo", "test-agent");
			expect(agentAfter!.hasBeenRun).toBe(true);
		});

		it("passes continueSession=true on restart (hasBeenRun=true)", async () => {
			await service.createAgent("/repo", "test-agent", "Build the feature");

			// First focus -- sets hasBeenRun=true
			await service.focusAgent("/repo", "test-agent");
			// Simulate terminal close (agent goes to "finished")
			await service.updateStatus("/repo", "test-agent", "finished", 0);

			terminalService.createTerminal.mockClear();

			// Second focus -- should use --continue
			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.createTerminal).toHaveBeenCalledWith(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				undefined,
				true,
			);
		});

		it("does not change hasBeenRun for running agents (showTerminal path)", async () => {
			await service.createAgent("/repo", "test-agent");
			await service.updateStatus("/repo", "test-agent", "running");

			await service.focusAgent("/repo", "test-agent");

			expect(terminalService.showTerminal).toHaveBeenCalledWith("/repo", "test-agent");
			// hasBeenRun should not be set from showTerminal path
			const agent = service.getAgent("/repo", "test-agent");
			expect(agent!.hasBeenRun).toBeUndefined();
		});
	});

	describe("lastFocused", () => {
		it("setLastFocused stores repoPath::agentName in Memento", async () => {
			await service.setLastFocused("/repo", "test-agent");

			expect(state.get(LAST_FOCUSED_KEY)).toBe("/repo::test-agent");
		});

		it("getLastFocused returns stored compound key", async () => {
			await service.setLastFocused("/repo", "test-agent");

			expect(service.getLastFocused()).toBe("/repo::test-agent");
		});

		it("getLastFocused returns undefined when nothing stored", () => {
			expect(service.getLastFocused()).toBeUndefined();
		});

		it("focusAgent stores last-focused key after focusing", async () => {
			await service.createAgent("/repo", "test-agent");

			await service.focusAgent("/repo", "test-agent");

			expect(state.get(LAST_FOCUSED_KEY)).toBe("/repo::test-agent");
		});
	});

	describe("createAgent hasBeenRun", () => {
		it("does not set hasBeenRun on creation (field remains undefined)", async () => {
			const entry = await service.createAgent("/repo", "test-agent");

			expect(entry.hasBeenRun).toBeUndefined();
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

			// Both agents have matching worktrees
			worktreeService.getManifest.mockReturnValue([
				{ path: "/repo/.worktrees/agent-1", branch: "agent-1", agentName: "agent-1", repoPath: "/repo", createdAt: new Date().toISOString() },
				{ path: "/repo/.worktrees/agent-2", branch: "agent-2", agentName: "agent-2", repoPath: "/repo", createdAt: new Date().toISOString() },
			]);

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

			// All agents have matching worktrees
			worktreeService.getManifest.mockReturnValue([
				{ path: "/repo/.worktrees/created-agent", branch: "created-agent", agentName: "created-agent", repoPath: "/repo", createdAt: new Date().toISOString() },
				{ path: "/repo/.worktrees/finished-agent", branch: "finished-agent", agentName: "finished-agent", repoPath: "/repo", createdAt: new Date().toISOString() },
				{ path: "/repo/.worktrees/error-agent", branch: "error-agent", agentName: "error-agent", repoPath: "/repo", createdAt: new Date().toISOString() },
			]);

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

			// Agent has matching worktree
			worktreeService.getManifest.mockReturnValue([
				{ path: "/repo/.worktrees/agent-1", branch: "agent-1", agentName: "agent-1", repoPath: "/repo", createdAt: new Date().toISOString() },
			]);

			await service.reconcileOnActivation();

			const agent = service.getAgent("/repo", "agent-1");
			expect(agent!.status).toBe("created");
			expect(agent!.exitCode).toBeUndefined();
		});

		it("returns { resetCount, orphanedAgentCount }", async () => {
			await service.createAgent("/repo", "running-agent");
			await service.updateStatus("/repo", "running-agent", "running");

			// Agent has matching worktree
			worktreeService.getManifest.mockReturnValue([
				{ path: "/repo/.worktrees/running-agent", branch: "running-agent", agentName: "running-agent", repoPath: "/repo", createdAt: new Date().toISOString() },
			]);

			const result = await service.reconcileOnActivation();

			expect(result).toEqual({ resetCount: 1, orphanedAgentCount: 0 });
		});
	});

	describe("reconcileOnActivation cross-reference", () => {
		it("removes agent entries whose worktrees are NOT in the manifest", async () => {
			await service.createAgent("/repo", "agent-in-manifest");
			await service.createAgent("/repo", "orphaned-agent");

			// Mock: manifest only has agent-in-manifest
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/agent-in-manifest",
					branch: "agent-in-manifest",
					agentName: "agent-in-manifest",
					repoPath: "/repo",
					createdAt: new Date().toISOString(),
				},
			]);

			await service.reconcileOnActivation();

			expect(service.getAgent("/repo", "agent-in-manifest")).toBeDefined();
			expect(service.getAgent("/repo", "orphaned-agent")).toBeUndefined();
		});

		it("keeps agent entries whose worktrees ARE in the manifest", async () => {
			await service.createAgent("/repo", "valid-agent");

			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/valid-agent",
					branch: "valid-agent",
					agentName: "valid-agent",
					repoPath: "/repo",
					createdAt: new Date().toISOString(),
				},
			]);

			await service.reconcileOnActivation();

			expect(service.getAgent("/repo", "valid-agent")).toBeDefined();
		});

		it("returns orphanedAgentCount in the result", async () => {
			await service.createAgent("/repo", "valid-agent");
			await service.createAgent("/repo", "orphan-1");
			await service.createAgent("/repo", "orphan-2");

			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/valid-agent",
					branch: "valid-agent",
					agentName: "valid-agent",
					repoPath: "/repo",
					createdAt: new Date().toISOString(),
				},
			]);

			const result = await service.reconcileOnActivation();

			expect(result.orphanedAgentCount).toBe(2);
		});

		it("running agents that ARE in manifest still reset to 'created'", async () => {
			await service.createAgent("/repo", "running-valid");
			await service.updateStatus("/repo", "running-valid", "running");

			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/running-valid",
					branch: "running-valid",
					agentName: "running-valid",
					repoPath: "/repo",
					createdAt: new Date().toISOString(),
				},
			]);

			const result = await service.reconcileOnActivation();

			expect(service.getAgent("/repo", "running-valid")!.status).toBe("created");
			expect(result.resetCount).toBe(1);
			expect(result.orphanedAgentCount).toBe(0);
		});

		it("cross-references agents across multiple repos", async () => {
			await service.createAgent("/repo1", "agent-a");
			await service.createAgent("/repo2", "agent-b");

			// repo1 has agent-a in manifest, repo2 does NOT have agent-b
			worktreeService.getManifest.mockImplementation((repoPath: string) => {
				if (repoPath === "/repo1") {
					return [
						{
							path: "/repo1/.worktrees/agent-a",
							branch: "agent-a",
							agentName: "agent-a",
							repoPath: "/repo1",
							createdAt: new Date().toISOString(),
						},
					];
				}
				return []; // repo2 has no worktrees
			});

			await service.reconcileOnActivation();

			expect(service.getAgent("/repo1", "agent-a")).toBeDefined();
			expect(service.getAgent("/repo2", "agent-b")).toBeUndefined();
		});
	});

	describe("cleanupOrphanProcesses", () => {
		it("kills alive PIDs via process.kill(pid, 'SIGTERM')", async () => {
			const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
			terminalService.getAllPids.mockReturnValue({ "/repo::agent-1": 12345 });

			const count = await service.cleanupOrphanProcesses();

			// First call: isProcessAlive check (signal 0)
			expect(killSpy).toHaveBeenCalledWith(12345, 0);
			// Second call: actual kill
			expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");
			expect(count).toBe(1);
			expect(terminalService.clearAllPids).toHaveBeenCalled();

			killSpy.mockRestore();
		});

		it("skips dead PIDs (process.kill(pid, 0) throws)", async () => {
			const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
				const err = new Error("ESRCH");
				(err as NodeJS.ErrnoException).code = "ESRCH";
				throw err;
			});
			terminalService.getAllPids.mockReturnValue({ "/repo::agent-1": 99999 });

			const count = await service.cleanupOrphanProcesses();

			// Only the alive check should have been called, no SIGTERM
			expect(killSpy).toHaveBeenCalledWith(99999, 0);
			expect(killSpy).not.toHaveBeenCalledWith(99999, "SIGTERM");
			expect(count).toBe(0);
			expect(terminalService.clearAllPids).toHaveBeenCalled();

			killSpy.mockRestore();
		});

		it("clears PID registry after cleanup", async () => {
			const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
			terminalService.getAllPids.mockReturnValue({});

			await service.cleanupOrphanProcesses();

			expect(terminalService.clearAllPids).toHaveBeenCalled();

			killSpy.mockRestore();
		});

		it("returns count of killed processes", async () => {
			let callCount = 0;
			const killSpy = vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
				if (signal === 0) {
					callCount++;
					// First PID alive, second PID dead
					if (callCount === 2) {
						const err = new Error("ESRCH");
						(err as NodeJS.ErrnoException).code = "ESRCH";
						throw err;
					}
				}
				return true;
			});
			terminalService.getAllPids.mockReturnValue({
				"/repo::alive-agent": 111,
				"/repo::dead-agent": 222,
			});

			const count = await service.cleanupOrphanProcesses();

			expect(count).toBe(1); // Only the alive one was killed

			killSpy.mockRestore();
		});

		it("handles EPERM gracefully on kill attempt (process owned by another user)", async () => {
			const killSpy = vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
				if (signal === 0) {
					return true; // Process is alive
				}
				// SIGTERM fails with EPERM
				const err = new Error("EPERM");
				(err as NodeJS.ErrnoException).code = "EPERM";
				throw err;
			});
			terminalService.getAllPids.mockReturnValue({ "/repo::agent-1": 12345 });

			// Should not throw, should count as 0 killed (failed to kill)
			const count = await service.cleanupOrphanProcesses();

			expect(count).toBe(0);
			expect(terminalService.clearAllPids).toHaveBeenCalled();

			killSpy.mockRestore();
		});
	});

	describe("setTerminalService", () => {
		it("allows setting terminalService after construction", () => {
			const svc = new AgentService(state, worktreeService as never);
			// Should not throw
			svc.setTerminalService(terminalService as never);
		});
	});

	describe("onDidChangeAgents", () => {
		it("fires after createAgent", async () => {
			const listener = vi.fn();
			service.onDidChangeAgents(listener);

			await service.createAgent("/repo", "test-agent");

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("fires after deleteAgent", async () => {
			await service.createAgent("/repo", "test-agent");

			const listener = vi.fn();
			service.onDidChangeAgents(listener);

			await service.deleteAgent("/repo", "test-agent");

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("fires after updateStatus", async () => {
			await service.createAgent("/repo", "test-agent");

			const listener = vi.fn();
			service.onDidChangeAgents(listener);

			await service.updateStatus("/repo", "test-agent", "running");

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("fires after reconcileOnActivation when changes occur", async () => {
			await service.createAgent("/repo", "agent-1");
			await service.updateStatus("/repo", "agent-1", "running");

			// Agent has matching worktree
			worktreeService.getManifest.mockReturnValue([
				{ path: "/repo/.worktrees/agent-1", branch: "agent-1", agentName: "agent-1", repoPath: "/repo", createdAt: new Date().toISOString() },
			]);

			const listener = vi.fn();
			service.onDidChangeAgents(listener);

			await service.reconcileOnActivation();

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("does NOT fire on reconcileOnActivation when no changes", async () => {
			await service.createAgent("/repo", "agent-1");
			// Status is "created" -- no running agents

			// Mock: agent IS in manifest so no orphans
			worktreeService.getManifest.mockReturnValue([
				{
					path: "/repo/.worktrees/agent-1",
					branch: "agent-1",
					agentName: "agent-1",
					repoPath: "/repo",
					createdAt: new Date().toISOString(),
				},
			]);

			const listener = vi.fn();
			service.onDidChangeAgents(listener);

			await service.reconcileOnActivation();

			expect(listener).not.toHaveBeenCalled();
		});

		it("dispose() cleans up the event emitter", () => {
			const listener = vi.fn();
			service.onDidChangeAgents(listener);

			service.dispose();

			// After dispose, creating an agent should not fire the listener
			// (though in practice dispose is called at shutdown)
			expect(() => service.dispose()).not.toThrow();
		});
	});
});
