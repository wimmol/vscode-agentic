---
phase: 02-agent-lifecycle-terminal-mgmt
verified: 2026-03-05T21:52:00Z
status: passed
score: 16/16 must-haves verified
must_haves:
  truths:
    # Plan 01 truths
    - truth: "Agent status type defines exactly four states: created, running, finished, error"
      status: verified
    - truth: "Branch name validation rejects git-illegal names (spaces, .., ~, ^, :, ?, *, [, \\, control chars, leading dot/dash, trailing .lock)"
      status: verified
    - truth: "TerminalService creates real VS Code terminals with shellPath='claude' and cwd=worktreePath"
      status: verified
    - truth: "TerminalService maps terminals to agents by repoPath::agentName compound key"
      status: verified
    - truth: "When a terminal closes, TerminalService fires a status change callback with the correct exit code and derived status"
      status: verified
    - truth: "Multiple concurrent terminals can exist without interfering with each other"
      status: verified
    - truth: "TerminalService.disposeTerminal removes map entry BEFORE calling terminal.dispose() to avoid race with close handler"
      status: verified
    # Plan 02 truths
    - truth: "User can create an agent by naming it, which creates a git branch+worktree and persists the agent entry with status 'created' (no terminal yet)"
      status: verified
    - truth: "User can delete an agent after confirmation dialog, which disposes the terminal, removes the worktree+branch, and removes the agent entry"
      status: verified
    - truth: "Deleting a running agent shows an extra warning about the running state before confirming"
      status: verified
    - truth: "User can focus an agent, which lazily creates a terminal (or shows existing one) and transitions status to 'running'"
      status: verified
    - truth: "When a terminal exits, the agent status transitions to 'finished' (exit code 0/undefined) or 'error' (non-zero exit code)"
      status: verified
    - truth: "On extension activation, any agent with status 'running' is reset to 'created' (terminals are lost on restart)"
      status: verified
    - truth: "Agent name input validates against git branch name rules and shows validation error inline"
      status: verified
    - truth: "Agent name collision offers to reuse existing agent or pick new name"
      status: verified
    - truth: "All commands are hidden from the Command Palette -- interactions happen exclusively through sidebar UI (toolbar buttons, inline actions, context menus, tree item clicks)"
      status: verified
---

# Phase 2: Agent Lifecycle & Terminal Management Verification Report

**Phase Goal:** Agent lifecycle management with terminal integration -- create/delete/focus agents with git worktree backing and Claude Code CLI terminals.
**Verified:** 2026-03-05T21:52:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent status type defines exactly four states: created, running, finished, error | VERIFIED | `src/models/agent.ts` line 1: `type AgentStatus = "created" \| "running" \| "finished" \| "error"` |
| 2 | Branch name validation rejects git-illegal names | VERIFIED | `src/utils/branch-validation.ts` implements all git-check-ref-format rules; 26 test cases pass in `test/unit/branch-validation.test.ts` |
| 3 | TerminalService creates real VS Code terminals with shellPath='claude' and cwd=worktreePath | VERIFIED | `src/services/terminal.service.ts` line 54-60: `createTerminal({ name, shellPath: "claude", shellArgs, cwd: worktreePath, isTransient: true })` |
| 4 | TerminalService maps terminals to agents by repoPath::agentName compound key | VERIFIED | `src/services/terminal.service.ts` line 31: `terminalKey()` returns `${repoPath}::${agentName}`, used in Map<string, vscode.Terminal> |
| 5 | When a terminal closes, TerminalService fires a status change callback with the correct exit code and derived status | VERIFIED | `src/services/terminal.service.ts` lines 88-103: `handleTerminalClose` derives status from exitCode; 7 tests verify edge cases |
| 6 | Multiple concurrent terminals can exist without interfering with each other | VERIFIED | Test "supports multiple terminals for different agents" at terminal.service.test.ts verifies three concurrent terminals and independent close behavior |
| 7 | TerminalService.disposeTerminal removes map entry BEFORE calling terminal.dispose() to avoid race with close handler | VERIFIED | `src/services/terminal.service.ts` lines 70-74: `this.terminals.delete(key)` before `terminal.dispose()`; dedicated race condition test verifies ordering |
| 8 | User can create an agent by naming it, which creates a git branch+worktree and persists the agent entry with status 'created' | VERIFIED | `agent.service.ts` `createAgent()` calls `worktreeService.addWorktree()`, creates entry with status "created", saves to Memento; 6 tests verify |
| 9 | User can delete an agent after confirmation dialog, which disposes terminal, removes worktree+branch, removes entry | VERIFIED | `agent.commands.ts` `deleteAgent` handler shows modal warning then calls `agentService.deleteAgent()`; service disposes terminal, removes worktree, clears registry |
| 10 | Deleting a running agent shows an extra warning about the running state | VERIFIED | `agent.commands.ts` lines 105-108: checks `agent?.status === "running"` and uses "still running" message text; test verifies with `stringContaining("still running")` |
| 11 | User can focus an agent, which lazily creates a terminal or shows existing one, transitions to 'running' | VERIFIED | `agent.service.ts` `focusAgent()` creates terminal for created/finished/error states (lazy), calls showTerminal for running; updates status to "running" |
| 12 | When a terminal exits, the agent status transitions to finished or error | VERIFIED | `extension.ts` line 18-19 wires TerminalService callback to `agentService.updateStatus()`; TerminalService derives status from exit code |
| 13 | On extension activation, any agent with status 'running' is reset to 'created' | VERIFIED | `agent.service.ts` `reconcileOnActivation()` lines 153-168: iterates registry, resets "running" to "created"; `extension.ts` line 58 calls it |
| 14 | Agent name input validates against git branch name rules and shows validation error inline | VERIFIED | `agent.commands.ts` lines 38-46: `validateInput` calls `isValidBranchName()`, returns error message string on invalid; test verifies rejection/acceptance |
| 15 | Agent name collision offers to reuse existing agent or pick new name | VERIFIED | `agent.commands.ts` lines 54-77: checks `agentService.getAgent()`, shows QuickPick with reuse/rename options, loops on rename; 2 tests verify both paths |
| 16 | All commands hidden from Command Palette | VERIFIED | `package.json` menus.commandPalette: all 4 commands (addRepo, createAgent, deleteAgent, focusAgent) have `"when": "false"` |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/models/agent.ts` | AgentEntry, AgentStatus, AGENT_REGISTRY_KEY | VERIFIED | 12 lines, exports all 3 items, imported by agent.service.ts and terminal.service.ts |
| `src/utils/branch-validation.ts` | isValidBranchName | VERIFIED | 34 lines, complete git-check-ref-format implementation, imported by agent.commands.ts |
| `src/services/terminal.service.ts` | TerminalService class (min 60 lines) | VERIFIED | 112 lines, complete lifecycle management, imported/used in extension.ts |
| `src/services/agent.service.ts` | AgentService class (min 80 lines) | VERIFIED | 169 lines, full lifecycle orchestration, imported/used in extension.ts and agent.commands.ts |
| `src/commands/agent.commands.ts` | registerAgentCommands (min 60 lines) | VERIFIED | 134 lines, three command handlers with interactive UI, imported/called in extension.ts |
| `src/extension.ts` | Updated with AgentService, TerminalService, commands, reconciliation | VERIFIED | 67 lines, creates both services, registers commands, wires status callback, calls reconciliation |
| `package.json` | Three new commands, all hidden from palette | VERIFIED | createAgent, deleteAgent, focusAgent commands registered; all 4 commands have commandPalette when:false |
| `test/__mocks__/vscode.ts` | Extended with terminal API | VERIFIED | 88 lines, includes createTerminal, onDidCloseTerminal, createMockTerminal, TerminalExitReason |
| `test/unit/branch-validation.test.ts` | Branch validation tests (min 30 lines) | VERIFIED | 122 lines, 26 test cases across 5 describe blocks |
| `test/unit/terminal.service.test.ts` | Terminal service tests (min 50 lines) | VERIFIED | 241 lines, 21 test cases covering all lifecycle scenarios |
| `test/unit/agent.service.test.ts` | Agent service tests (min 80 lines) | VERIFIED | 338 lines, 29 test cases for create/delete/focus/status/reconciliation |
| `test/unit/agent.commands.test.ts` | Command handler tests (min 50 lines) | VERIFIED | 290 lines, 17 test cases for all three commands |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| terminal.service.ts | vscode.window.createTerminal | TerminalOptions with shellPath, shellArgs, cwd, isTransient | WIRED | Line 54: `vscode.window.createTerminal({...shellPath: "claude"...})` |
| terminal.service.ts | vscode.window.onDidCloseTerminal | Event subscription in constructor | WIRED | Line 24: constructor subscribes, stores disposable |
| terminal.service.ts | status callback | onStatusChange callback in constructor | WIRED | Line 100: `this.onStatusChange(agentName, repoPath, status, exitCode)` |
| agent.service.ts | worktree.service.ts | addWorktree/removeWorktree | WIRED | Lines 49, 101: `this.worktreeService.addWorktree()`, `this.worktreeService.removeWorktree()` |
| agent.service.ts | terminal.service.ts | createTerminal/disposeTerminal/showTerminal | WIRED | Lines 100, 119, 130: via `ts = requireTerminalService()` local variable |
| agent.service.ts | vscode.Memento | state.get/update with AGENT_REGISTRY_KEY | WIRED | Lines 38, 42: `state.get(AGENT_REGISTRY_KEY, [])` and `state.update(AGENT_REGISTRY_KEY, entries)` |
| agent.commands.ts | agent.service.ts | createAgent/deleteAgent/focusAgent | WIRED | Lines 72, 94, 121, 129: all four call paths verified |
| extension.ts | agent.service.ts | Singleton creation and command registration | WIRED | Line 17: `new AgentService(...)`, line 21: `setTerminalService()`, line 25: `registerAgentCommands()` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AGENT-01 | 02-02 | User can create an agent (name, branch, worktree, Claude CLI) | SATISFIED | AgentService.createAgent + TerminalService.createTerminal with shellPath="claude"; focusAgent creates terminal lazily |
| AGENT-02 | 02-02 | User can delete an agent (kill process, remove worktree, delete branch) | SATISFIED | AgentService.deleteAgent disposes terminal, removes worktree, clears registry; confirmation dialog with running-state warning |
| AGENT-05 | 02-02 | Agent status is tracked and visible (created/running/finished/error) | SATISFIED | AgentStatus type with 4 states; updateStatus persists in Memento; status transitions on focus, terminal close, reconciliation |
| TERM-01 | 02-01 | Each agent runs as a Claude Code CLI session in a VS Code integrated terminal | SATISFIED | TerminalService creates terminals with shellPath="claude", cwd=worktreePath, isTransient=true |
| TERM-02 | 02-01 | User can run 2-5 agent sessions concurrently without conflicts | SATISFIED | Map-based terminal tracking with compound key; concurrent terminal test verifies isolation; no shared state between agents |
| PERF-01 | 02-01, 02-02 | Terminals are created lazily (only when agent is focused) | SATISFIED | createAgent sets status="created" without terminal; focusAgent creates terminal on first focus |
| UI-06 | 02-02 | All interactions via sidebar only -- no Command Palette entries | SATISFIED | All 4 commands have `"when": "false"` in package.json menus.commandPalette |

No orphaned requirements found. REQUIREMENTS.md maps AGENT-01, AGENT-02, AGENT-05, TERM-01, TERM-02, PERF-01 to Phase 2, and UI-06 to Phases 2+3. All are accounted for in the plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | -- | -- | -- | No anti-patterns detected |

No TODOs, FIXMEs, placeholders, empty implementations, or console.log-only handlers found in any phase 02 source files.

### Human Verification Required

### 1. Terminal creation with Claude Code CLI

**Test:** Create an agent, then focus it. Verify a VS Code integrated terminal opens with the Claude Code CLI running.
**Expected:** Terminal tab appears with name "Agent: {name}", Claude Code CLI is active and responsive in the worktree directory.
**Why human:** Requires real Claude Code CLI installed and a real git repository; unit tests mock vscode.window.createTerminal.

### 2. Multiple concurrent agent terminals

**Test:** Create and focus 3 agents in the same repo. Verify all three terminals are active simultaneously.
**Expected:** Three terminal tabs, each in its own worktree directory, no interference between sessions.
**Why human:** Requires real VS Code terminal API and system resources; mocked in tests.

### 3. Terminal close detection and status update

**Test:** Focus an agent (terminal opens), then close the terminal tab manually. Check that agent status changes to "finished".
**Expected:** Agent status in sidebar updates from "running" to "finished" after terminal is closed.
**Why human:** Requires real terminal lifecycle events; close handler is simulated in tests via mock callback.

### Gaps Summary

No gaps found. All 16 observable truths verified. All 12 artifacts exist, are substantive, and are properly wired. All 8 key links confirmed. All 7 requirement IDs satisfied. No anti-patterns detected. Full test suite (141 tests) passes. TypeScript compiles cleanly.

---

_Verified: 2026-03-05T21:52:00Z_
_Verifier: Claude (gsd-verifier)_
