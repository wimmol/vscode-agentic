---
phase: 06-suspend-restore-and-notifications
plan: 02
subsystem: agent-lifecycle
tags: [suspend, restore, notification, commands, context-menu, extension-wiring]

# Dependency graph
requires:
  - phase: 06-suspend-restore-and-notifications
    plan: 01
    provides: "suspendAgent/suspendAllIdle methods, onBackgroundExit callback, contextValue variants"
provides:
  - "Suspend Agent and Suspend All Idle Agents command palette commands"
  - "Suspend/Restore context menu commands on agent tiles"
  - "Background agent exit notification with Show Agent action button"
  - "Full extension wiring of onBackgroundExit callback"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "QuickPick filter pattern for status-based agent selection (suspendable agents)"
    - "Context menu when clause regex for conditional suspend/restore visibility"

key-files:
  created: []
  modified:
    - src/commands/agent.commands.ts
    - src/commands/sidebar.commands.ts
    - src/extension.ts
    - package.json
    - test/unit/agent.commands.test.ts
    - test/unit/sidebar.commands.test.ts

key-decisions:
  - "Suspend QuickPick filters to status !== running && status !== suspended for suspendable agent list"
  - "Restore from tile reuses switchToAgent + reveal pattern (same as focusAgentFromTile) for consistent UX"
  - "reviewChanges/createPR when clauses updated to /WithDiffs$/ to match all status variants"

patterns-established:
  - "Status-filtered QuickPick pattern for command palette commands"
  - "lifecycle group in context menus for suspend/restore actions"

requirements-completed: [TERM-04, TERM-05, TERM-06]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 6 Plan 2: Suspend/Restore Commands and Notifications Summary

**Suspend/restore command palette and context menu commands with background agent exit notifications and Show Agent action button**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T09:19:48Z
- **Completed:** 2026-03-04T09:23:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added suspendAgent (QuickPick) and suspendAllIdle command palette commands with status filtering
- Added suspendAgentFromTile and restoreAgentFromTile context menu commands with correct when clauses
- Wired onBackgroundExit notification callback into TerminalService in extension.ts
- Updated reviewChanges/createPR menu when clauses to match all WithDiffs variants (suspended, running, base)
- All 286 tests pass, TypeScript compiles clean, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Suspend/restore commands, context menus, and package.json wiring** - `c552478` (feat)
2. **Task 2: Extension wiring -- notification callback and command registration** - `d4f19a1` (feat)

## Files Created/Modified
- `src/commands/agent.commands.ts` - Added suspendAgent and suspendAllIdle command registrations
- `src/commands/sidebar.commands.ts` - Added suspendAgentFromTile and restoreAgentFromTile command registrations
- `src/extension.ts` - Wired onBackgroundExit callback into TerminalService constructor
- `package.json` - Added 4 command definitions, 2 context menu entries, updated WithDiffs when clauses
- `test/unit/agent.commands.test.ts` - Added tests for suspend/suspendAll commands (29 total tests)
- `test/unit/sidebar.commands.test.ts` - Added tests for suspend/restore tile commands (8 total tests)

## Decisions Made
- Suspend QuickPick filters agents to status !== "running" && status !== "suspended" -- only idle agents shown
- Restore from tile uses same switchToAgent + reveal pattern as focusAgentFromTile for consistent UX
- Updated reviewChanges and createPR when clauses from exact match to `/WithDiffs$/` regex to support agentItemWithDiffs, agentItemSuspendedWithDiffs, and agentItemRunningWithDiffs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 (Suspend/Restore and Notifications) is fully complete
- All TERM-04, TERM-05, TERM-06 requirements implemented
- Ready for Phase 7 or final verification

---
*Phase: 06-suspend-restore-and-notifications*
*Completed: 2026-03-04*
