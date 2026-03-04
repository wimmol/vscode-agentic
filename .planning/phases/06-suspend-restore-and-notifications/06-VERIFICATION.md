---
phase: 06-suspend-restore-and-notifications
verified: 2026-03-04T09:27:34Z
status: passed
score: 18/18 must-haves verified
---

# Phase 6: Suspend/Restore and Notifications Verification Report

**Phase Goal:** User can suspend idle agents to reclaim RAM and get notified when background agents need attention
**Verified:** 2026-03-04T09:27:34Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AgentStatus type includes 'suspended' and all switch/record exhaustiveness is maintained | VERIFIED | `src/models/agent.ts:7` union includes "suspended"; `getStatusIcon` switch has `case "suspended"` at `agent-tree-items.ts:17`; `STATUS_PRIORITY` record has `suspended: 2`; TypeScript compiles clean |
| 2 | suspendAgent disposes terminal and sets status to 'suspended' for non-running agents | VERIFIED | `agent.service.ts:127-137`: guards on "running"/"suspended", calls `disposeTerminal`, then `updateStatus("suspended")`; 5 tests in `suspendAgent` describe block |
| 3 | suspendAllIdle suspends all created/finished/error agents in one call | VERIFIED | `agent.service.ts:144-172`: filters eligible, disposes each terminal, single registry save; returns count; tests at line 738 |
| 4 | focusAgent on a suspended agent creates terminal with --continue (same path as finished/error) | VERIFIED | `agent.service.ts:192-195`: only "running" is handled separately; suspended falls to else branch; `hasBeenRun=true` yields `continueSession=true`; test at line 779 |
| 5 | Suspended agents show debug-pause icon with disabledForeground color | VERIFIED | `agent-tree-items.ts:17-18`: `case "suspended": return new vscode.ThemeIcon("debug-pause", new vscode.ThemeColor("disabledForeground"))` |
| 6 | Suspended agents sort between created and finished (priority 2) | VERIFIED | `agent-tree-provider.ts:11`: `suspended: 2` in STATUS_PRIORITY; sort tests in `agent-tree-provider.test.ts` |
| 7 | contextValue encodes suspended/running/default variants for conditional menus | VERIFIED | `agent-tree-items.ts:71-77`: if/else sets agentItemSuspended[WithDiffs], agentItemRunning[WithDiffs], agentItem[WithDiffs]; 6 test cases covering all variants |
| 8 | handleTerminalClose fires onBackgroundExit callback when closed terminal is not activeTerminal | VERIFIED | `terminal.service.ts:192-194`: `if (this.onBackgroundExit && vscode.window.activeTerminal !== terminal)`; test at line 418 |
| 9 | Notification is suppressed when agent terminal was the active terminal | VERIFIED | Same guard: `vscode.window.activeTerminal !== terminal` prevents callback; test at line 434 explicitly checks `not.toHaveBeenCalled()` |
| 10 | Suspended agents survive reconcileOnActivation unchanged (worktree exists) | VERIFIED | `agent.service.ts:294`: only `"running"` is reset; suspended is not touched; test at line 805 |
| 11 | User can suspend an agent via context menu on a non-running agent tile | VERIFIED | `sidebar.commands.ts:103-111`: `suspendAgentFromTile` registered; `package.json` menu `when: view == vscode-agentic.agents && viewItem =~ /^agentItem(WithDiffs)?$/` matches non-running non-suspended |
| 12 | User can restore a suspended agent by clicking its tile | VERIFIED | `sidebar.commands.ts:114-130`: `restoreAgentFromTile` calls `workspaceSwitchService.switchToAgent` which calls `agentService.focusAgent`; `package.json` menu `when: viewItem =~ /^agentItemSuspended/` |
| 13 | User can suspend all idle agents via command palette ('Suspend All Idle Agents') | VERIFIED | `agent.commands.ts:239-249`: `vscode-agentic.suspendAllIdle` registered; calls `agentService.suspendAllIdle()`; shows count message |
| 14 | User receives a VS Code notification when a background agent's terminal exits | VERIFIED | `extension.ts:37-50`: `onBackgroundExit` callback passed as 3rd arg to TerminalService; calls `vscode.window.showInformationMessage` with agent name and status label |
| 15 | Notification includes a 'Show Agent' button that focuses the agent | VERIFIED | `extension.ts:39-49`: `showInformationMessage(..., "Show Agent")`; on `action === "Show Agent"` executes `vscode-agentic.focusAgent` with repoPath/agentName |
| 16 | Notification is not shown when user is watching the agent's terminal | VERIFIED | `terminal.service.ts:192`: `vscode.window.activeTerminal !== terminal` guard prevents callback from firing; test at line 434 |
| 17 | Suspend/restore context menu items appear conditionally based on agent status | VERIFIED | `package.json` menus: suspend uses `/^agentItem(WithDiffs)?$/` (created/finished/error only), restore uses `/^agentItemSuspended/` (suspended only); running matches neither |
| 18 | Running agents show neither suspend nor restore in context menu | VERIFIED | contextValue for running = "agentItemRunning[WithDiffs]"; suspend `when` regex does not match "agentItemRunning"; restore `when` does not match "agentItemRunning" |

**Score:** 18/18 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/models/agent.ts` | AgentStatus with 'suspended' value | VERIFIED | Line 7: `"created" \| "running" \| "finished" \| "error" \| "suspended"` |
| `src/services/agent.service.ts` | suspendAgent and suspendAllIdle methods | VERIFIED | Lines 127-172; exported via AgentService class |
| `src/services/terminal.service.ts` | onBackgroundExit callback on terminal close | VERIFIED | Constructor param at line 28; fires at line 192-194 |
| `src/views/agent-tree-items.ts` | Suspended icon case and contextValue variants | VERIFIED | Lines 17-18 (icon), 71-77 (contextValue); "debug-pause" present |
| `src/views/agent-tree-provider.ts` | Updated STATUS_PRIORITY with suspended: 2 | VERIFIED | Line 11: `suspended: 2` |
| `src/commands/agent.commands.ts` | suspendAgent and suspendAllIdle command palette commands | VERIFIED | Lines 203-257; both registered in context.subscriptions |
| `src/commands/sidebar.commands.ts` | suspendAgentFromTile and restoreAgentFromTile context menu commands | VERIFIED | Lines 103-139; both registered in context.subscriptions |
| `src/extension.ts` | Notification callback wired to TerminalService, new commands registered | VERIFIED | Lines 31-51: onBackgroundExit passed to TerminalService constructor |
| `package.json` | Command definitions and context menu entries for suspend/restore | VERIFIED | 4 commands defined; 2 context menu entries with correct when clauses |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/agent.service.ts` | `src/services/terminal.service.ts` | suspendAgent calls disposeTerminal | WIRED | Lines 135, 156: `this.requireTerminalService().disposeTerminal(repoPath, agentName)` |
| `src/services/terminal.service.ts` | `vscode.window.activeTerminal` | focus detection in handleTerminalClose | WIRED | Line 192: `vscode.window.activeTerminal !== terminal` |
| `src/views/agent-tree-items.ts` | `src/models/agent.ts` | getStatusIcon switch handles suspended | WIRED | Line 17: `case "suspended":` in exhaustive switch |
| `package.json` | `src/commands/agent.commands.ts` | command ID registration | WIRED | `vscode-agentic.suspendAgent` and `vscode-agentic.suspendAllIdle` in package.json commands array and registered in agent.commands.ts |
| `package.json` | `src/commands/sidebar.commands.ts` | command ID registration | WIRED | `vscode-agentic.suspendAgentFromTile` and `vscode-agentic.restoreAgentFromTile` in package.json and registered in sidebar.commands.ts |
| `src/extension.ts` | `src/services/terminal.service.ts` | onBackgroundExit callback passed to constructor | WIRED | Lines 36-50: async callback passed as 3rd argument |
| `src/extension.ts` | `vscode.window.showInformationMessage` | notification with Show Agent action button | WIRED | Line 39: `showInformationMessage(\`Agent '${agentName}' ${statusLabel}.\`, "Show Agent")` |
| `src/commands/sidebar.commands.ts` | `src/services/workspace-switch.service.ts` | restoreAgentFromTile calls switchToAgent which calls focusAgent | WIRED | Line 117: `workspaceSwitchService.switchToAgent(repoPath, agentName)`; WorkspaceSwitchService.switchToAgent calls `agentService.focusAgent` at line 45 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| TERM-04 | 06-01, 06-02 | User can suspend an idle/finished agent to free RAM -- terminal state is saved and process is killed | SATISFIED | suspendAgent disposes terminal (kills process) + sets status "suspended"; suspendAgentFromTile command wired via context menu; suspendAllIdle batch command in palette |
| TERM-05 | 06-01, 06-02 | User can restore a suspended agent -- process relaunches in the same worktree context | SATISFIED | focusAgent handles "suspended" via else branch; passes `continueSession=true` when `hasBeenRun=true`; restoreAgentFromTile context menu command wired |
| TERM-06 | 06-01, 06-02 | User receives OS notification when a background agent finishes work or needs input | SATISFIED | onBackgroundExit callback wired in extension.ts; fires `showInformationMessage` with "Show Agent" button; suppressed when user is watching the terminal |

No orphaned requirements found. All three TERM-04/05/06 are claimed by both plans and implemented.

---

## Anti-Patterns Found

No blockers or warnings found. Anti-pattern scan of all phase-modified files produced:

- `return []` hits in diff.service.ts and worktree-parser.ts are legitimate empty-result returns from error guards (pre-existing, not phase artifacts)
- `return null` in agent.commands.ts line 308 is intentional signal for "user chose reuse" (pre-existing logic)
- `return [];` in agent-tree-provider.ts line 78 is a correct leaf-node guard (pre-existing)
- No TODO/FIXME/placeholder comments in any phase-modified files
- No stub implementations (all handlers perform real work, not just console.log or preventDefault)

---

## Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| `test/unit/agent.service.test.ts` | 64 tests (includes suspend, suspendAllIdle, focusAgent on suspended, reconciliation with suspended) | All pass |
| `test/unit/terminal.service.test.ts` | 33 tests (includes 4 background exit notification tests) | All pass |
| `test/unit/agent-tree-items.test.ts` | 28 tests (includes suspended icon, contextValue variants) | All pass |
| `test/unit/agent-tree-provider.test.ts` | 13 tests (includes sort with suspended agents) | All pass |
| `test/unit/agent.commands.test.ts` | 29 tests (includes suspendAgent QuickPick, suspendAllIdle count) | All pass |
| `test/unit/sidebar.commands.test.ts` | 8 tests (includes suspendAgentFromTile, restoreAgentFromTile) | All pass |
| **Total** | **286 tests** | **All pass** |

TypeScript: `npx tsc --noEmit` exits 0 (clean, no missing switch cases).

---

## Human Verification Required

### 1. Context Menu Visibility

**Test:** Right-click an agent tile in the sidebar with each status (created, running, finished, error, suspended)
**Expected:** Suspend appears for created/finished/error; Restore appears for suspended; neither appears for running
**Why human:** VS Code `when` clause evaluation against `viewItem` contextValue patterns requires live extension host to test

### 2. Background Notification Appearance

**Test:** Launch an agent terminal, switch focus to the editor, wait for the Claude process to exit
**Expected:** VS Code notification toast appears: "Agent 'X' finished." with "Show Agent" button
**Why human:** Requires real terminal process exit event and VS Code notification system

### 3. Show Agent Button Flow

**Test:** Click "Show Agent" in the background exit notification
**Expected:** The agent's terminal is shown and/or created; user is taken to the agent context
**Why human:** Requires live extension, real terminal state, and VS Code focus behavior

### 4. Suspend Frees RAM

**Test:** Suspend an agent that has an active terminal; check Activity Monitor / htop
**Expected:** The claude process for that agent is no longer present (terminal disposed = process killed)
**Why human:** Requires OS-level process inspection alongside VS Code extension interaction

---

## Summary

Phase 6 goal is fully achieved. All 18 observable truths are verified against the actual codebase with substantive implementations (not stubs). Every key link from service to service, command to package.json, and extension wiring is confirmed present and connected.

Key implementation highlights:
- `"suspended"` is a complete first-class AgentStatus with exhaustive coverage across switch statements and priority records
- `suspendAgent`/`suspendAllIdle` have correct guards preventing double-suspension or suspension of running agents
- `onBackgroundExit` callback fires only on genuinely background exits (user not watching terminal) — the suppression logic is correct and tested
- The restore flow correctly chains `restoreAgentFromTile` -> `switchToAgent` -> `agentService.focusAgent` -> terminal creation with `--continue`
- Context menu `when` clauses are non-overlapping for suspend/restore based on contextValue regex patterns
- All 286 tests pass; TypeScript compiles clean

---

_Verified: 2026-03-04T09:27:34Z_
_Verifier: Claude (gsd-verifier)_
