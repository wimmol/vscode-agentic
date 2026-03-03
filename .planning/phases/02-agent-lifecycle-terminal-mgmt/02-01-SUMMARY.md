---
phase: 02-agent-lifecycle-terminal-mgmt
plan: 01
subsystem: agent-lifecycle
tags: [terminal, vscode-api, agent-model, branch-validation, tdd]

# Dependency graph
requires:
  - phase: 01-extension-foundation
    provides: WorktreeEntry model, vscode mock infrastructure, Vitest test setup
provides:
  - AgentEntry interface and AgentStatus type for agent registry persistence
  - isValidBranchName utility for git branch name validation
  - TerminalService class for terminal-to-agent lifecycle management
  - Extended vscode mock with terminal API surfaces (createTerminal, onDidCloseTerminal, TerminalExitReason, createMockTerminal)
affects: [02-02-agent-service-commands, 03-sidebar-ui, 05-session-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns: [terminal-to-agent-mapping-via-compound-key, dispose-before-close-race-prevention, tdd-red-green-refactor]

key-files:
  created:
    - src/models/agent.ts
    - src/utils/branch-validation.ts
    - src/services/terminal.service.ts
    - test/unit/branch-validation.test.ts
    - test/unit/terminal.service.test.ts
  modified:
    - test/__mocks__/vscode.ts

key-decisions:
  - "Real VS Code terminals (TerminalOptions, not Pseudoterminal) for Claude Code CLI"
  - "Compound key repoPath::agentName for terminal-to-agent mapping"
  - "Map entry removal before dispose() to prevent close handler race condition"
  - "Four-state agent status: created, running, finished, error"

patterns-established:
  - "Terminal compound key: repoPath::agentName for unique terminal identification"
  - "Dispose-before-close: delete map entry before calling terminal.dispose() to prevent race"
  - "createMockTerminal helper: reusable terminal mock factory for test files"

requirements-completed: [TERM-01, TERM-02, PERF-01]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 2 Plan 1: Agent Model, Branch Validation, and Terminal Service Summary

**AgentEntry/AgentStatus types, git branch name validation, and TerminalService with lifecycle management for Claude Code CLI terminals**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T20:24:20Z
- **Completed:** 2026-03-03T20:27:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- AgentEntry interface and AgentStatus type (created/running/finished/error) exported for agent registry persistence
- isValidBranchName validates all git check-ref-format rules with 24 edge case tests
- TerminalService creates VS Code terminals with shellPath="claude", handles close events with exit code detection, prevents dispose/close race condition
- Extended vscode mock with createTerminal, onDidCloseTerminal, TerminalExitReason enum, and createMockTerminal helper

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent model, branch validation, and vscode mock extensions** - `0ae920e` (feat)
2. **Task 2: TerminalService with lifecycle management** - `fdd5c82` (feat)

_Note: Both tasks used TDD (RED then GREEN phases)_

## Files Created/Modified
- `src/models/agent.ts` - AgentEntry interface, AgentStatus type, AGENT_REGISTRY_KEY constant
- `src/utils/branch-validation.ts` - isValidBranchName function implementing git check-ref-format rules
- `src/services/terminal.service.ts` - TerminalService class with create, dispose, show, close handling
- `test/__mocks__/vscode.ts` - Extended with createTerminal, onDidCloseTerminal, TerminalExitReason, createMockTerminal
- `test/unit/branch-validation.test.ts` - 24 tests covering all git-illegal branch name patterns
- `test/unit/terminal.service.test.ts` - 21 tests covering terminal lifecycle, race conditions, concurrent agents

## Decisions Made
- Used real VS Code terminals (TerminalOptions) instead of Pseudoterminal -- Claude Code CLI is a full interactive TUI that needs a real PTY
- Compound key `repoPath::agentName` for terminal map -- safe because both components are validated (repo paths are git repos, agent names are branch-valid)
- Map entry removal before `terminal.dispose()` to prevent onDidCloseTerminal handler from firing onStatusChange on intentional disposal
- Four-state AgentStatus: "created" (no terminal yet), "running" (terminal open), "finished" (exit code 0 or undefined), "error" (non-zero exit code)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AgentEntry and AgentStatus types ready for AgentService to persist in Memento
- TerminalService ready for AgentService to call createTerminal/disposeTerminal
- isValidBranchName ready for agent creation command input validation
- Extended vscode mock ready for AgentService and agent command tests

## Self-Check: PASSED

All 7 files verified present. Both task commits (0ae920e, fdd5c82) confirmed in git log. 97 total tests pass (24 branch-validation + 21 terminal-service + 52 existing).

---
*Phase: 02-agent-lifecycle-terminal-mgmt*
*Completed: 2026-03-04*
