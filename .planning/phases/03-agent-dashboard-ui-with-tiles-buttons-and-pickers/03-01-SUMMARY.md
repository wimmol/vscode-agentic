---
phase: 03-agent-dashboard-ui-with-tiles-buttons-and-pickers
plan: 01
subsystem: ui
tags: [eventemitter, webview-csp, nonce, workspace-folders, agent-lifecycle]

# Dependency graph
requires:
  - phase: 02-agent-lifecycle-terminal-mgmt
    provides: AgentService, TerminalService, agent commands, extension wiring
provides:
  - AgentService.onDidChange EventEmitter for webview data-change notifications
  - AgentEntry.finishedAt field for terminal status transitions
  - getNonce utility for webview Content Security Policy
  - stopAgent command for killing running agent terminals
  - removeRepo command with modal confirmation
  - focusAgent workspace folder switching (UI-03/UI-04)
  - Extended vscode mock with EventEmitter, Uri.joinPath, registerWebviewViewProvider, updateWorkspaceFolders
affects: [03-02-webview-sidebar, extension-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns: [vscode-eventemitter-for-data-change-notification, workspace-folder-switching, nonce-csp-pattern]

key-files:
  created:
    - src/utils/nonce.ts
    - test/unit/nonce.test.ts
    - test/unit/repo.commands.test.ts
  modified:
    - src/models/agent.ts
    - src/services/agent.service.ts
    - src/commands/agent.commands.ts
    - src/commands/repo.commands.ts
    - package.json
    - test/__mocks__/vscode.ts
    - test/unit/agent.service.test.ts
    - test/unit/agent.commands.test.ts

key-decisions:
  - "EventEmitter fires void (no payload) -- subscribers re-fetch data via getAll/getForRepo"
  - "focusAgent replaces all workspace folders (index 0, remove all) with agent worktree URI"
  - "stopAgent is a no-op for non-running agents (no error, no warning)"
  - "removeRepo uses path.basename for display name in confirmation dialog"
  - "Expected TS error in extension.ts (missing worktreeService arg) deferred to Plan 02 wiring"

patterns-established:
  - "EventEmitter pattern: private _onDidChange + public readonly onDidChange + dispose()"
  - "Nonce generation: 32-char alphanumeric random string for webview CSP"
  - "Workspace switching: updateWorkspaceFolders(0, existingCount, { uri }) replaces all folders"

requirements-completed: [UI-03, UI-04, UI-06]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 03 Plan 01: Backend Contracts and Commands Summary

**AgentService EventEmitter for webview data-change notifications, stopAgent/removeRepo commands, and focusAgent workspace folder switching**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T14:00:09Z
- **Completed:** 2026-03-06T14:06:05Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- AgentService fires onDidChange event on every mutation (create, delete, updateStatus, reconcile) for webview provider subscription
- AgentEntry gains finishedAt field, set on finished/error transitions and cleared on running/created
- stopAgent command disposes terminal and sets status to finished for running agents
- removeRepo command shows modal confirmation before removing repo config
- focusAgent switches workspace folders to the agent's worktree directory (UI-03/UI-04)
- getNonce utility produces 32-character random strings for webview CSP
- Extended vscode mock with EventEmitter, Uri.joinPath, registerWebviewViewProvider, updateWorkspaceFolders
- Both new commands hidden from Command Palette via when:false (UI-06)

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: AgentService EventEmitter, finishedAt field, and nonce utility**
   - `61fab81` (test: failing tests)
   - `529c9b1` (feat: implementation)
2. **Task 2: stopAgent command, removeRepo command, focusAgent workspace switching**
   - `019acb7` (test: failing tests)
   - `d99e6ac` (feat: implementation)

_TDD flow: RED (failing tests) then GREEN (implementation) for each task_

## Files Created/Modified
- `src/models/agent.ts` - Added optional finishedAt field to AgentEntry
- `src/services/agent.service.ts` - Added EventEmitter, onDidChange event, finishedAt logic, dispose method
- `src/utils/nonce.ts` - Nonce generation utility for webview CSP
- `src/commands/agent.commands.ts` - Added stopAgent command, worktreeService parameter, workspace folder switching in focusAgent
- `src/commands/repo.commands.ts` - Added removeRepo command with modal confirmation
- `package.json` - Added stopAgent and removeRepo commands with icons and commandPalette hiding
- `test/__mocks__/vscode.ts` - Added EventEmitter class, Uri.joinPath, registerWebviewViewProvider, updateWorkspaceFolders
- `test/unit/agent.service.test.ts` - Added onDidChange event tests and finishedAt field tests
- `test/unit/agent.commands.test.ts` - Added stopAgent tests, focusAgent workspace switching tests
- `test/unit/repo.commands.test.ts` - New file with removeRepo command tests
- `test/unit/nonce.test.ts` - New file with getNonce tests

## Decisions Made
- EventEmitter fires void (no payload) -- subscribers re-fetch data via getAll/getForRepo
- focusAgent replaces all workspace folders (index 0, remove all) with agent worktree URI
- stopAgent is a no-op for non-running agents (no error, no warning)
- removeRepo uses path.basename for display name in confirmation dialog
- Expected TS error in extension.ts (missing worktreeService arg) deferred to Plan 02 wiring

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AgentService.onDidChange ready for webview provider subscription (Plan 02)
- getNonce utility ready for webview HTML generation (Plan 02)
- stopAgent and removeRepo commands ready for sidebar UI buttons (Plan 02)
- extension.ts needs worktreeService argument passed to registerAgentCommands (Plan 02 wiring)
- All 163 tests pass across 12 test files

## Self-Check: PASSED

All 7 key files verified present. All 4 task commits verified in git log.

---
*Phase: 03-agent-dashboard-ui-with-tiles-buttons-and-pickers*
*Completed: 2026-03-06*
