import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento, createMockTerminal, window } from "../__mocks__/vscode.js";
import { TerminalService } from "../../src/services/terminal.service.js";
import { PID_REGISTRY_KEY } from "../../src/models/agent.js";

describe("TerminalService", () => {
	let service: TerminalService;
	let onStatusChange: ReturnType<typeof vi.fn>;
	let mockState: ReturnType<typeof createMockMemento>;
	let closeListener: (terminal: ReturnType<typeof createMockTerminal>) => void;

	beforeEach(() => {
		vi.clearAllMocks();

		// Capture the onDidCloseTerminal listener so we can simulate terminal close events
		window.onDidCloseTerminal.mockImplementation(
			(listener: (terminal: ReturnType<typeof createMockTerminal>) => void) => {
				closeListener = listener;
				return { dispose: vi.fn() };
			},
		);

		onStatusChange = vi.fn();
		mockState = createMockMemento();
		service = new TerminalService(onStatusChange, mockState);
	});

	describe("createTerminal", () => {
		it("creates a VS Code terminal with correct options", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			expect(window.createTerminal).toHaveBeenCalledWith({
				name: "Agent: test-agent",
				shellPath: "claude",
				shellArgs: [],
				cwd: "/repo/.worktrees/test-agent",
				isTransient: true,
			});
		});

		it("passes initialPrompt as shellArgs[0] when provided", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
				"Fix the auth bug",
			);

			expect(window.createTerminal).toHaveBeenCalledWith(
				expect.objectContaining({
					shellArgs: ["Fix the auth bug"],
				}),
			);
		});

		it("passes empty shellArgs when no prompt provided", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			expect(window.createTerminal).toHaveBeenCalledWith(
				expect.objectContaining({
					shellArgs: [],
				}),
			);
		});

		it("returns existing terminal and calls show() if one already exists", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			const first = service.createTerminal(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
			);
			const second = service.createTerminal(
				"/repo",
				"test-agent",
				"/repo/.worktrees/test-agent",
			);

			expect(second).toBe(first);
			expect(mockTerminal.show).toHaveBeenCalled();
			expect(window.createTerminal).toHaveBeenCalledTimes(1);
		});

		it("stores the terminal in the map keyed by repoPath::agentName", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			expect(service.hasTerminal("/repo", "test-agent")).toBe(true);
		});
	});

	describe("disposeTerminal", () => {
		it("removes map entry BEFORE calling terminal.dispose()", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			// Verify terminal.dispose() callback can see map is already cleared
			mockTerminal.dispose.mockImplementation(() => {
				// At the point dispose() is called, the map entry should already be gone
				expect(service.hasTerminal("/repo", "test-agent")).toBe(false);
			});

			service.disposeTerminal("/repo", "test-agent");
			expect(mockTerminal.dispose).toHaveBeenCalled();
		});

		it("is a no-op when no terminal exists for the agent", () => {
			// Should not throw
			service.disposeTerminal("/repo", "nonexistent");
		});

		it("prevents close handler from firing onStatusChange after dispose", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			// Dispose removes from map first
			service.disposeTerminal("/repo", "test-agent");

			// Simulate the close event that would fire after dispose()
			mockTerminal._setExitStatus(0, 4); // Extension exit reason
			closeListener(mockTerminal);

			// onStatusChange should NOT be called because map entry was removed before dispose
			expect(onStatusChange).not.toHaveBeenCalled();
		});
	});

	describe("handleTerminalClose", () => {
		it("identifies the correct agent by terminal identity (===)", () => {
			const terminal1 = createMockTerminal("Agent: agent-1");
			const terminal2 = createMockTerminal("Agent: agent-2");
			window.createTerminal
				.mockReturnValueOnce(terminal1)
				.mockReturnValueOnce(terminal2);

			service.createTerminal("/repo", "agent-1", "/repo/.worktrees/agent-1");
			service.createTerminal("/repo", "agent-2", "/repo/.worktrees/agent-2");

			terminal1._setExitStatus(0, 2);
			closeListener(terminal1);

			expect(onStatusChange).toHaveBeenCalledWith("agent-1", "/repo", "finished", 0);
			// agent-2 should still exist
			expect(service.hasTerminal("/repo", "agent-2")).toBe(true);
		});

		it('calls onStatusChange with status="finished" when exitCode is 0', () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			mockTerminal._setExitStatus(0, 2);
			closeListener(mockTerminal);

			expect(onStatusChange).toHaveBeenCalledWith("test-agent", "/repo", "finished", 0);
		});

		it('calls onStatusChange with status="finished" when exitCode is undefined', () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			// exitStatus exists but code is undefined (e.g., user closed terminal)
			mockTerminal._setExitStatus(undefined, 3);
			closeListener(mockTerminal);

			expect(onStatusChange).toHaveBeenCalledWith(
				"test-agent",
				"/repo",
				"finished",
				undefined,
			);
		});

		it('calls onStatusChange with status="error" when exitCode is non-zero', () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			mockTerminal._setExitStatus(1, 2);
			closeListener(mockTerminal);

			expect(onStatusChange).toHaveBeenCalledWith("test-agent", "/repo", "error", 1);
		});

		it('calls onStatusChange with status="error" for exit code 127 (command not found)', () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			mockTerminal._setExitStatus(127, 2);
			closeListener(mockTerminal);

			expect(onStatusChange).toHaveBeenCalledWith("test-agent", "/repo", "error", 127);
		});

		it("removes the terminal from the map after close", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			mockTerminal._setExitStatus(0, 2);
			closeListener(mockTerminal);

			expect(service.hasTerminal("/repo", "test-agent")).toBe(false);
		});

		it("is a no-op for terminals not in the map (non-agent terminals)", () => {
			const externalTerminal = createMockTerminal("bash");
			externalTerminal._setExitStatus(0, 2);

			closeListener(externalTerminal);

			expect(onStatusChange).not.toHaveBeenCalled();
		});
	});

	describe("multiple concurrent terminals", () => {
		it("maintains separate entries for different agents", () => {
			const terminal1 = createMockTerminal("Agent: agent-1");
			const terminal2 = createMockTerminal("Agent: agent-2");
			const terminal3 = createMockTerminal("Agent: agent-3");
			window.createTerminal
				.mockReturnValueOnce(terminal1)
				.mockReturnValueOnce(terminal2)
				.mockReturnValueOnce(terminal3);

			service.createTerminal("/repo", "agent-1", "/repo/.worktrees/agent-1");
			service.createTerminal("/repo", "agent-2", "/repo/.worktrees/agent-2");
			service.createTerminal("/other", "agent-3", "/other/.worktrees/agent-3");

			expect(service.hasTerminal("/repo", "agent-1")).toBe(true);
			expect(service.hasTerminal("/repo", "agent-2")).toBe(true);
			expect(service.hasTerminal("/other", "agent-3")).toBe(true);
		});
	});

	describe("showTerminal", () => {
		it("calls show() on an existing terminal", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");
			mockTerminal.show.mockClear();

			service.showTerminal("/repo", "test-agent");

			expect(mockTerminal.show).toHaveBeenCalled();
		});

		it("is a no-op for unknown agents", () => {
			// Should not throw
			service.showTerminal("/repo", "nonexistent");
		});
	});

	describe("hasTerminal", () => {
		it("returns true when terminal exists", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			expect(service.hasTerminal("/repo", "test-agent")).toBe(true);
		});

		it("returns false when no terminal exists", () => {
			expect(service.hasTerminal("/repo", "unknown")).toBe(false);
		});
	});

	describe("continueSession flag", () => {
		it("passes shellArgs=['--continue'] when continueSession is true", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent", undefined, true);

			expect(window.createTerminal).toHaveBeenCalledWith(
				expect.objectContaining({
					shellArgs: ["--continue"],
				}),
			);
		});

		it("passes initialPrompt as shellArgs when continueSession is false", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent", "Fix the bug", false);

			expect(window.createTerminal).toHaveBeenCalledWith(
				expect.objectContaining({
					shellArgs: ["Fix the bug"],
				}),
			);
		});

		it("passes empty shellArgs when continueSession is false and no initialPrompt", () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent", undefined, false);

			expect(window.createTerminal).toHaveBeenCalledWith(
				expect.objectContaining({
					shellArgs: [],
				}),
			);
		});
	});

	describe("PID tracking", () => {
		it("stores terminal PID in Memento after createTerminal", async () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			// Wait for fire-and-forget PID tracking to complete
			await vi.waitFor(() => {
				const pidMap = mockState.get(PID_REGISTRY_KEY, {}) as Record<string, number>;
				expect(pidMap["/repo::test-agent"]).toBe(12345);
			});
		});

		it("skips PID storage when processId resolves to undefined", async () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			mockTerminal._setPid(undefined);
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			// Give the fire-and-forget async a tick to complete
			await new Promise((r) => setTimeout(r, 10));

			const pidMap = mockState.get(PID_REGISTRY_KEY, {}) as Record<string, number>;
			expect(pidMap["/repo::test-agent"]).toBeUndefined();
		});

		it("clears PID from Memento on disposeTerminal", async () => {
			const mockTerminal = createMockTerminal("Agent: test-agent");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "test-agent", "/repo/.worktrees/test-agent");

			// Wait for PID to be stored
			await vi.waitFor(() => {
				const pidMap = mockState.get(PID_REGISTRY_KEY, {}) as Record<string, number>;
				expect(pidMap["/repo::test-agent"]).toBe(12345);
			});

			service.disposeTerminal("/repo", "test-agent");

			const pidMap = mockState.get(PID_REGISTRY_KEY, {}) as Record<string, number>;
			expect(pidMap["/repo::test-agent"]).toBeUndefined();
		});

		it("getAllPids returns stored PID map from Memento", async () => {
			const mockTerminal = createMockTerminal("Agent: agent-1");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "agent-1", "/repo/.worktrees/agent-1");

			await vi.waitFor(() => {
				const pids = service.getAllPids();
				expect(pids).toEqual({ "/repo::agent-1": 12345 });
			});
		});

		it("clearAllPids empties the PID registry", async () => {
			const mockTerminal = createMockTerminal("Agent: agent-1");
			window.createTerminal.mockReturnValue(mockTerminal);

			service.createTerminal("/repo", "agent-1", "/repo/.worktrees/agent-1");

			await vi.waitFor(() => {
				expect(service.getAllPids()).toEqual({ "/repo::agent-1": 12345 });
			});

			await service.clearAllPids();

			expect(service.getAllPids()).toEqual({});
		});
	});

	describe("dispose", () => {
		it("cleans up event subscriptions", () => {
			const disposeFn = vi.fn();
			window.onDidCloseTerminal.mockImplementation(
				(listener: (terminal: ReturnType<typeof createMockTerminal>) => void) => {
					closeListener = listener;
					return { dispose: disposeFn };
				},
			);

			const svc = new TerminalService(onStatusChange, mockState);
			svc.dispose();

			expect(disposeFn).toHaveBeenCalled();
		});
	});
});
