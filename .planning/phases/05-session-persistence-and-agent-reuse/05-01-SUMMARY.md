---
phase: 05-session-persistence-and-agent-reuse
plan: 01
subsystem: agent-lifecycle
tags: [terminal, memento, pid-tracking, session-continuation, claude-cli]

# Dependency graph
requires:
  - phase: 02-agent-lifecycle-terminal-mgmt
    provides: "TerminalService, AgentService, focusAgent, terminal lifecycle"
provides:
  - "AgentEntry.hasBeenRun boolean for restart detection"
  - "TerminalService continueSession parameter with --continue shellArgs"
  - "PID tracking via Memento (PID_REGISTRY_KEY) for orphan detection"
  - "Last-focused agent key storage (LAST_FOCUSED_KEY) in Memento"
  - "setLastFocused/getLastFocused on AgentService"
affects: [05-02-activation-reconciliation, 06-suspend-restore]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget PID tracking, restart detection via hasBeenRun flag, single registry read-modify-write in focusAgent]

key-files:
  created: []
  modified:
    - src/models/agent.ts
    - src/services/terminal.service.ts
    - src/services/agent.service.ts
    - src/extension.ts
    - test/__mocks__/vscode.ts
    - test/unit/terminal.service.test.ts
    - test/unit/agent.service.test.ts

key-decisions:
  - "claude --continue flag for agent restart instead of bare claude or --resume"
  - "hasBeenRun boolean on AgentEntry drives restart vs first-run detection in focusAgent"
  - "Single registry read-modify-write in focusAgent combines status and hasBeenRun update"
  - "Fire-and-forget PID tracking via terminal.processId with best-effort error handling"

patterns-established:
  - "Restart detection: hasBeenRun flag differentiates first focus from restart"
  - "PID registry: Memento-backed Record<string, number> for terminal process tracking"
  - "Last-focused Memento key: compound repoPath::agentName for sidebar highlighting"

requirements-completed: [TERM-03, AGENT-03]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 5 Plan 01: Session Persistence Foundation Summary

**Agent restart detection via hasBeenRun flag, --continue CLI flag for session resumption, and PID tracking for orphan detection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T08:34:39Z
- **Completed:** 2026-03-04T08:39:19Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- AgentEntry model extended with `hasBeenRun` boolean, `PID_REGISTRY_KEY`, and `LAST_FOCUSED_KEY` constants
- TerminalService accepts `continueSession` parameter -- passes `--continue` shellArgs for session resumption, tracks terminal PIDs in Memento
- AgentService focusAgent detects restart via `hasBeenRun` and passes correct args to createTerminal; stores last-focused agent key after every focus
- 9 new tests added (247 total, all passing), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: AgentEntry model update and TerminalService --continue and PID tracking** - `d226394` (feat)
2. **Task 2: AgentService restart detection, last-focused storage, and focusAgent enhancement** - `2d9f254` (feat)

_Note: TDD tasks combined RED+GREEN into single commits per task for atomicity_

## Files Created/Modified
- `src/models/agent.ts` - Added hasBeenRun field, PID_REGISTRY_KEY, LAST_FOCUSED_KEY constants
- `src/services/terminal.service.ts` - Added Memento state param, continueSession flag, PID tracking (trackPid, getAllPids, clearAllPids, removePid)
- `src/services/agent.service.ts` - Enhanced focusAgent with restart detection, added setLastFocused/getLastFocused
- `src/extension.ts` - Passes workspaceState to TerminalService constructor
- `test/__mocks__/vscode.ts` - Added processId and _setPid to mock terminal factory
- `test/unit/terminal.service.test.ts` - Added continueSession and PID tracking tests (5 new tests)
- `test/unit/agent.service.test.ts` - Added restart detection, lastFocused, hasBeenRun tests (4 new tests + updated existing)

## Decisions Made
- Used `claude --continue` flag for agent restart (directory-scoped, resumes latest session in worktree cwd)
- `hasBeenRun` boolean on AgentEntry drives restart vs first-run detection -- simple, persisted via Memento
- Single registry read-modify-write in focusAgent to avoid separate updateStatus call that would re-read registry
- Fire-and-forget PID tracking -- processId Thenable awaited without blocking createTerminal return

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 05-02 can now wire PID-based orphan cleanup and enhanced reconciliation into the activation sequence
- Last-focused agent key ready for sidebar highlighting in Plan 05-02
- `getAllPids()` and `clearAllPids()` ready for orphan process detection

## Self-Check: PASSED

All files exist, all commits verified, all 247 tests pass.

---
*Phase: 05-session-persistence-and-agent-reuse*
*Completed: 2026-03-04*
