---
phase: 05-session-persistence-and-agent-reuse
plan: 02
subsystem: agent-lifecycle
tags: [reconciliation, orphan-cleanup, pid-tracking, activation-sequence, sidebar-highlight]

# Dependency graph
requires:
  - phase: 05-session-persistence-and-agent-reuse
    plan: 01
    provides: "PID tracking (getAllPids/clearAllPids), last-focused key, hasBeenRun flag, --continue flag"
provides:
  - "reconcileOnActivation with agent-worktree cross-reference and orphan removal"
  - "cleanupOrphanProcesses for killing alive orphan PIDs"
  - "Ordered activation reconciliation sequence (worktree -> agent -> process -> diff -> last-focused)"
  - "Last-focused agent sidebar highlighting on activation"
  - "Diff status cache recompute on activation"
affects: [06-suspend-restore]

# Tech tracking
tech-stack:
  added: []
  patterns: [ordered async IIFE for non-blocking activation, process.kill signal 0 for liveness check, cross-reference registry reconciliation]

key-files:
  created: []
  modified:
    - src/services/agent.service.ts
    - src/extension.ts
    - test/unit/agent.service.test.ts

key-decisions:
  - "isProcessAlive uses process.kill(pid, 0) for cross-platform liveness check"
  - "EPERM on SIGTERM counts as not-killed (process owned by another user)"
  - "Orphan removal runs before running->created reset to avoid resetting agents that will be deleted"
  - "Single combined notification for agent + process orphan cleanup"

patterns-established:
  - "Cross-reference reconciliation: compare registry entries against worktree manifests per repo"
  - "Ordered activation IIFE: sequential async steps in fire-and-forget wrapper with error boundary"
  - "Process liveness: signal 0 check before SIGTERM with EPERM/ESRCH handling"

requirements-completed: [TERM-03, PERF-03]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 5 Plan 02: Activation Reconciliation Summary

**Ordered activation sequence with agent-worktree cross-reference, orphan PID cleanup, diff cache recompute, and last-focused sidebar highlighting**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T08:42:18Z
- **Completed:** 2026-03-04T08:45:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- reconcileOnActivation cross-references agent registry with worktree manifests, removing orphaned agent entries and resetting running agents to created
- cleanupOrphanProcesses detects alive orphan PIDs via signal 0 and kills with SIGTERM, clearing the PID registry
- Extension activation runs ordered reconciliation sequence: worktree cleanup -> agent cross-reference -> orphan process kill -> diff recompute -> reveal last-focused
- Last-focused agent highlighted (selected) in sidebar on activation without launching terminal
- 11 new tests added (258 total, all passing), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhanced reconciliation with agent-worktree cross-reference and orphan process cleanup** - `e91b072` (feat)
2. **Task 2: Extension activation wiring, last-focused highlighting, and diff cache recompute** - `e0cd989` (feat)

_Note: TDD tasks combined RED+GREEN into single commits per task for atomicity_

## Files Created/Modified
- `src/services/agent.service.ts` - Added isProcessAlive helper, enhanced reconcileOnActivation with cross-reference and return type, added cleanupOrphanProcesses method
- `src/extension.ts` - Replaced fire-and-forget steps 6+7 with ordered async IIFE, added AgentTreeItem import for last-focused reveal
- `test/unit/agent.service.test.ts` - Added cross-reference and orphan cleanup test suites, updated existing reconcile tests with manifest mocks

## Decisions Made
- isProcessAlive uses `process.kill(pid, 0)` -- cross-platform signal 0 check (works on macOS, Linux, Windows)
- EPERM on SIGTERM attempt counts as 0 killed -- process exists but owned by another user, cannot kill
- Orphan agent removal runs before running->created reset -- avoids resetting agents that are about to be deleted
- Single combined notification for agent + process orphan cleanup -- avoids notification spam

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing reconcileOnActivation tests with manifest mocks**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Existing tests did not set up worktree manifest mocks, so agents were incorrectly treated as orphans by the new cross-reference logic
- **Fix:** Added appropriate `worktreeService.getManifest` mock return values to all existing reconcileOnActivation tests and the onDidChangeAgents event test
- **Files modified:** test/unit/agent.service.test.ts
- **Verification:** All 258 tests pass
- **Committed in:** e91b072 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in test setup)
**Impact on plan:** Necessary to maintain test correctness with new cross-reference behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Session persistence and agent reuse complete (Phase 5 done)
- All agent lifecycle states survive VS Code restarts
- Phase 6 (Suspend/Restore) can build on PID tracking and reconciliation infrastructure

## Self-Check: PASSED

All files exist, all commits verified, all 258 tests pass.

---
*Phase: 05-session-persistence-and-agent-reuse*
*Completed: 2026-03-04*
