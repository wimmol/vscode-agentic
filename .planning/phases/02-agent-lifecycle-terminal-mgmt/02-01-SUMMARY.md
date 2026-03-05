---
phase: 02-agent-lifecycle-terminal-mgmt
plan: 01
subsystem: agent-lifecycle
tags: [vscode-terminal, agent-model, branch-validation, claude-code-cli]

# Dependency graph
requires:
  - phase: 01-foundation-git-infra
    provides: "WorktreeEntry, vscode mock, test infrastructure, project conventions"
provides:
  - "AgentEntry interface and AgentStatus type (created/running/finished/error)"
  - "AGENT_REGISTRY_KEY constant for Memento persistence"
  - "isValidBranchName utility for git-check-ref-format validation"
  - "TerminalService class for terminal lifecycle management"
  - "Extended vscode mock with terminal API surfaces"
affects: [02-agent-lifecycle-terminal-mgmt, 03-sidebar-ui, 05-session-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terminal-to-agent mapping via compound key (repoPath::agentName)"
    - "Dispose-before-close race condition prevention pattern"
    - "TDD RED-GREEN for both utility and service code"

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
  - "AgentStatus uses 4-state union type: created, running, finished, error"
  - "TerminalService uses compound key separator :: which is safe for validated repo paths and branch names"
  - "Close handler uses identity comparison (===) to match terminals, not name matching"
  - "Map entry removed before terminal.dispose() to prevent race with close handler"

patterns-established:
  - "Terminal-to-agent mapping: Map<string, vscode.Terminal> with compound key"
  - "Status derivation from exit codes: 0/undefined=finished, non-zero=error"
  - "Mock terminal factory: createMockTerminal helper for test setup"

requirements-completed: [TERM-01, TERM-02, PERF-01]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 2 Plan 1: Agent Model, Branch Validation, and Terminal Service Summary

**AgentEntry/AgentStatus types, git branch name validation with 26 edge case tests, and TerminalService with terminal-to-agent mapping and close handler race condition prevention**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T14:37:45Z
- **Completed:** 2026-03-05T14:40:53Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- AgentEntry interface and AgentStatus type define the agent data model for all subsequent phases
- isValidBranchName implements full git-check-ref-format rules with 26 test cases covering every edge case
- TerminalService manages VS Code terminal lifecycle: create, show, dispose, close detection with 21 tests
- Race condition between dispose and close handler prevented by map-entry removal ordering
- Extended vscode mock with createTerminal, onDidCloseTerminal, createMockTerminal helper, and TerminalExitReason enum

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent model, branch validation, and vscode mock extensions**
   - `bd5bc27` (test: add failing tests for branch validation)
   - `205a0dd` (feat: agent model, branch validation, vscode mock extensions)
2. **Task 2: TerminalService with lifecycle management**
   - `4b905a3` (test: add failing tests for TerminalService lifecycle)
   - `51cbf56` (feat: implement TerminalService with lifecycle management)

_Note: TDD tasks have two commits each (test then feat)_

## Files Created/Modified
- `src/models/agent.ts` - AgentEntry interface, AgentStatus type, AGENT_REGISTRY_KEY constant
- `src/utils/branch-validation.ts` - isValidBranchName utility per git-check-ref-format rules
- `src/services/terminal.service.ts` - TerminalService class with terminal-to-agent mapping and lifecycle management
- `test/__mocks__/vscode.ts` - Extended with createTerminal, onDidCloseTerminal, createMockTerminal, TerminalExitReason
- `test/unit/branch-validation.test.ts` - 26 test cases for branch name validation
- `test/unit/terminal.service.test.ts` - 21 test cases for terminal service lifecycle

## Decisions Made
- AgentStatus uses a 4-state string union type (not enum) for consistency with TypeScript conventions
- TerminalService compound key uses `::` separator (safe because repo paths and agent names are validated)
- Terminal close handler uses strict identity comparison (`===`) rather than name matching for reliability
- Map entry is removed BEFORE `terminal.dispose()` to prevent race with the asynchronous close handler

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AgentEntry and AgentStatus types ready for AgentService (Plan 02) to use
- TerminalService ready for AgentService to inject as dependency
- isValidBranchName ready for agent creation input validation
- Extended vscode mock ready for agent command and service tests

## Self-Check: PASSED

All 7 files verified present. All 4 commit hashes verified in git log. 95/95 tests pass across full suite.

---
*Phase: 02-agent-lifecycle-terminal-mgmt*
*Completed: 2026-03-05*
