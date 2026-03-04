---
phase: 06-suspend-restore-and-notifications
plan: 01
subsystem: agent-lifecycle
tags: [suspend, restore, notification, terminal, treeview, status]

# Dependency graph
requires:
  - phase: 05-session-persistence-and-agent-reuse
    provides: "--continue flag support, hasBeenRun tracking, PID registry, reconciliation"
provides:
  - "AgentStatus 'suspended' union value"
  - "suspendAgent and suspendAllIdle methods on AgentService"
  - "onBackgroundExit callback on TerminalService for notification on unfocused terminal close"
  - "Suspended icon (debug-pause), sort priority (2), and contextValue variants in TreeView"
affects: [06-suspend-restore-and-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-based contextValue encoding (agentItemSuspended, agentItemRunning) for conditional menus"
    - "Optional callback parameter on TerminalService constructor for background exit notification"

key-files:
  created: []
  modified:
    - src/models/agent.ts
    - src/services/agent.service.ts
    - src/services/terminal.service.ts
    - src/views/agent-tree-items.ts
    - src/views/agent-tree-provider.ts
    - test/__mocks__/vscode.ts
    - test/unit/agent.service.test.ts
    - test/unit/terminal.service.test.ts
    - test/unit/agent-tree-items.test.ts
    - test/unit/agent-tree-provider.test.ts

key-decisions:
  - "Status-based contextValue encoding enables conditional context menus without regex complexity"
  - "onBackgroundExit as optional third constructor parameter preserves backward compatibility"
  - "Suspended icon uses debug-pause with disabledForeground -- distinct from created (circle-outline) while sharing muted color"

patterns-established:
  - "contextValue variants: agentItemSuspended/agentItemRunning/agentItem with WithDiffs suffix for conditional menus"
  - "Optional callback on service constructor for cross-cutting notification concerns"

requirements-completed: [TERM-04, TERM-05, TERM-06]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 6 Plan 1: Suspend/Restore Core Summary

**AgentStatus "suspended" with suspend/restore methods, background exit notification callback, and TreeView icon/sort/contextValue variants**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T09:12:11Z
- **Completed:** 2026-03-04T09:16:58Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added "suspended" to AgentStatus union type with full exhaustiveness across all switch statements
- Implemented suspendAgent (with running/suspended guards) and suspendAllIdle (batch suspend with count) on AgentService
- Added onBackgroundExit callback to TerminalService that fires when a non-focused terminal closes
- Updated TreeView with debug-pause icon, suspended sort priority (2), and status-based contextValue variants
- All 279 tests pass, TypeScript compiles clean, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: AgentStatus "suspended" type, suspendAgent/suspendAllIdle methods, and onBackgroundExit callback** - `f074a96` (feat)
2. **Task 2: Suspended icon, sort priority, and contextValue variants in TreeView** - `d03b994` (feat)

## Files Created/Modified
- `src/models/agent.ts` - Added "suspended" to AgentStatus union type
- `src/services/agent.service.ts` - Added suspendAgent and suspendAllIdle methods with status guards
- `src/services/terminal.service.ts` - Added optional onBackgroundExit callback, fires on unfocused terminal close
- `src/views/agent-tree-items.ts` - Added suspended icon case, status-based contextValue encoding
- `src/views/agent-tree-provider.ts` - Updated STATUS_PRIORITY with suspended: 2
- `test/__mocks__/vscode.ts` - Added activeTerminal to window mock
- `test/unit/agent.service.test.ts` - Added tests for suspend, suspendAllIdle, focusAgent on suspended, reconciliation
- `test/unit/terminal.service.test.ts` - Added tests for background exit notification fire/suppress
- `test/unit/agent-tree-items.test.ts` - Added tests for suspended icon and contextValue variants
- `test/unit/agent-tree-provider.test.ts` - Added sort test with suspended agents

## Decisions Made
- Status-based contextValue encoding (agentItemSuspended, agentItemRunning) enables Plan 02 to wire conditional menus via `viewItem =~` patterns without regex complexity
- onBackgroundExit as optional third constructor parameter preserves backward compatibility with existing TerminalService instantiations
- Suspended icon uses debug-pause with disabledForeground color -- visually distinct from created (circle-outline) while sharing the muted color palette to signal "inactive"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added suspended case to getStatusIcon in Task 1**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** Adding "suspended" to AgentStatus broke TypeScript exhaustiveness check in getStatusIcon switch (no return for suspended case)
- **Fix:** Added suspended case with debug-pause icon in Task 1 to satisfy TypeScript, ahead of Task 2 which tests it
- **Files modified:** src/views/agent-tree-items.ts
- **Verification:** npx tsc --noEmit passes clean
- **Committed in:** f074a96 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential to keep TypeScript compiling. Task 2 verified the icon via tests as planned.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core suspend/restore mechanics ready for Plan 02 to wire into commands and extension activation
- contextValue variants ready for conditional menu items in package.json
- onBackgroundExit callback ready for notification UI wiring in extension.ts

---
*Phase: 06-suspend-restore-and-notifications*
*Completed: 2026-03-04*
