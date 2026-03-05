import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockTerminal, window } from "../__mocks__/vscode";
import { TerminalService } from "../../src/services/terminal.service";

describe("TerminalService", () => {
	let service: TerminalService;
	let onStatusChange: ReturnType<typeof vi.fn>;
	let closeListener: ((terminal: ReturnType<typeof createMockTerminal>) => void) | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		closeListener = undefined;

		// Capture the onDidCloseTerminal listener registered in the constructor
		window.onDidCloseTerminal.mockImplementation((listener: unknown) => {
			closeListener = listener as typeof closeListener;
			return { dispose: vi.fn() };
		});

		// createTerminal returns a fresh mock terminal
		window.createTerminal.mockImplementation((opts: { name: string }) => {
			return createMockTerminal(opts.name);
		});

		onStatusChange = vi.fn();
		service = new TerminalService(onStatusChange);
	});

	describe("createTerminal", () => {
		it("creates a VS Code terminal with correct options", () => {
			service.createTerminal("/repo", "agent-1", "/worktree/path");

			expect(window.createTerminal).toHaveBeenCalledWith({
				name: "Agent: agent-1",
				shellPath: "claude",
				shellArgs: [],
				cwd: "/worktree/path",
				isTransient: true,
			});
		});

		it("passes initialPrompt as shellArgs when provided", () => {
			service.createTerminal("/repo", "agent-1", "/worktree/path", "Fix the auth bug");

			expect(window.createTerminal).toHaveBeenCalledWith({
				name: "Agent: agent-1",
				shellPath: "claude",
				shellArgs: ["Fix the auth bug"],
				cwd: "/worktree/path",
				isTransient: true,
			});
		});

		it("passes empty shellArgs when no prompt given", () => {
			service.createTerminal("/repo", "agent-1", "/worktree/path");

			expect(window.createTerminal).toHaveBeenCalledWith(
				expect.objectContaining({ shellArgs: [] }),
			);
		});

		it("returns existing terminal and calls show() if one already exists", () => {
			const terminal1 = service.createTerminal("/repo", "agent-1", "/worktree/path");
			const terminal2 = service.createTerminal("/repo", "agent-1", "/worktree/path");

			expect(terminal1).toBe(terminal2);
			expect(terminal1.show).toHaveBeenCalled();
			// createTerminal should only have been called once on the vscode API
			expect(window.createTerminal).toHaveBeenCalledTimes(1);
		});

		it("stores terminal in map keyed by repoPath::agentName", () => {
			service.createTerminal("/repo", "agent-1", "/worktree/path");

			expect(service.hasTerminal("/repo", "agent-1")).toBe(true);
			expect(service.hasTerminal("/repo", "agent-2")).toBe(false);
			expect(service.hasTerminal("/other", "agent-1")).toBe(false);
		});
	});

	describe("disposeTerminal", () => {
		it("removes map entry BEFORE calling terminal.dispose()", () => {
			const terminal = service.createTerminal("/repo", "agent-1", "/worktree/path");

			// Track the order: when dispose() is called, hasTerminal should already be false
			let hadTerminalDuringDispose: boolean | undefined;
			terminal.dispose.mockImplementation(() => {
				hadTerminalDuringDispose = service.hasTerminal("/repo", "agent-1");
			});

			service.disposeTerminal("/repo", "agent-1");

			expect(terminal.dispose).toHaveBeenCalled();
			expect(hadTerminalDuringDispose).toBe(false);
			expect(service.hasTerminal("/repo", "agent-1")).toBe(false);
		});

		it("is a no-op when no terminal exists for the agent", () => {
			// Should not throw
			service.disposeTerminal("/repo", "nonexistent");
		});

		it("prevents close handler from firing onStatusChange after dispose", () => {
			const terminal = service.createTerminal("/repo", "agent-1", "/worktree/path");
			terminal._setExitStatus(0, 2); // Process exit, code 0

			service.disposeTerminal("/repo", "agent-1");

			// Simulate the close event that fires after dispose()
			expect(closeListener).toBeDefined();
			closeListener!(terminal);

			// onStatusChange should NOT be called because map entry was removed before dispose
			expect(onStatusChange).not.toHaveBeenCalled();
		});
	});

	describe("handleTerminalClose", () => {
		it("identifies correct agent by terminal identity (===)", () => {
			const terminal1 = service.createTerminal("/repo", "agent-1", "/worktree/path1");
			service.createTerminal("/repo", "agent-2", "/worktree/path2");

			terminal1._setExitStatus(0, 2);
			closeListener!(terminal1);

			expect(onStatusChange).toHaveBeenCalledWith("agent-1", "/repo", "finished", 0);
		});

		it("calls onStatusChange with status=finished when exitCode is 0", () => {
			const terminal = service.createTerminal("/repo", "agent-1", "/worktree/path");
			terminal._setExitStatus(0, 2);

			closeListener!(terminal);

			expect(onStatusChange).toHaveBeenCalledWith("agent-1", "/repo", "finished", 0);
		});

		it("calls onStatusChange with status=finished when exitCode is undefined", () => {
			const terminal = service.createTerminal("/repo", "agent-1", "/worktree/path");
			// exitStatus is undefined (user closed via trash icon -- no exit code)

			closeListener!(terminal);

			expect(onStatusChange).toHaveBeenCalledWith("agent-1", "/repo", "finished", undefined);
		});

		it("calls onStatusChange with status=error when exitCode is non-zero", () => {
			const terminal = service.createTerminal("/repo", "agent-1", "/worktree/path");
			terminal._setExitStatus(1, 2);

			closeListener!(terminal);

			expect(onStatusChange).toHaveBeenCalledWith("agent-1", "/repo", "error", 1);
		});

		it("calls onStatusChange with status=error for exit code 127 (command not found)", () => {
			const terminal = service.createTerminal("/repo", "agent-1", "/worktree/path");
			terminal._setExitStatus(127, 2);

			closeListener!(terminal);

			expect(onStatusChange).toHaveBeenCalledWith("agent-1", "/repo", "error", 127);
		});

		it("removes the terminal from the map after close", () => {
			const terminal = service.createTerminal("/repo", "agent-1", "/worktree/path");
			terminal._setExitStatus(0, 2);

			closeListener!(terminal);

			expect(service.hasTerminal("/repo", "agent-1")).toBe(false);
		});

		it("is a no-op for terminals not in the map (non-agent terminals)", () => {
			const nonAgentTerminal = createMockTerminal("Some Other Terminal");

			closeListener!(nonAgentTerminal);

			expect(onStatusChange).not.toHaveBeenCalled();
		});
	});

	describe("multiple concurrent terminals", () => {
		it("supports multiple terminals for different agents", () => {
			const t1 = service.createTerminal("/repo", "agent-1", "/worktree/1");
			const t2 = service.createTerminal("/repo", "agent-2", "/worktree/2");
			const t3 = service.createTerminal("/other-repo", "agent-1", "/worktree/3");

			expect(service.hasTerminal("/repo", "agent-1")).toBe(true);
			expect(service.hasTerminal("/repo", "agent-2")).toBe(true);
			expect(service.hasTerminal("/other-repo", "agent-1")).toBe(true);

			// Closing one doesn't affect others
			t1._setExitStatus(0, 2);
			closeListener!(t1);

			expect(service.hasTerminal("/repo", "agent-1")).toBe(false);
			expect(service.hasTerminal("/repo", "agent-2")).toBe(true);
			expect(service.hasTerminal("/other-repo", "agent-1")).toBe(true);
		});
	});

	describe("showTerminal", () => {
		it("calls show() on an existing terminal", () => {
			const terminal = service.createTerminal("/repo", "agent-1", "/worktree/path");
			terminal.show.mockClear();

			service.showTerminal("/repo", "agent-1");

			expect(terminal.show).toHaveBeenCalled();
		});

		it("is a no-op for unknown agents", () => {
			// Should not throw
			service.showTerminal("/repo", "nonexistent");
		});
	});

	describe("hasTerminal", () => {
		it("returns true when a terminal exists", () => {
			service.createTerminal("/repo", "agent-1", "/worktree/path");
			expect(service.hasTerminal("/repo", "agent-1")).toBe(true);
		});

		it("returns false when no terminal exists", () => {
			expect(service.hasTerminal("/repo", "agent-1")).toBe(false);
		});
	});

	describe("dispose", () => {
		it("cleans up event subscriptions", () => {
			const disposeFn = vi.fn();
			window.onDidCloseTerminal.mockReturnValue({ dispose: disposeFn });

			const svc = new TerminalService(vi.fn());
			svc.dispose();

			expect(disposeFn).toHaveBeenCalled();
		});
	});
});
