---
phase: 07-remote-support-and-performance-at-scale
plan: 02
subsystem: ui
tags: [diff-cache, ttl, auto-suspend, agent-limit, worktree-limit, performance]

# Dependency graph
requires:
  - phase: 07-remote-support-and-performance-at-scale
    plan: 01
    provides: AgentLimitError class, resource limit settings, agent lifecycle with suspend
provides:
  - Targeted per-agent diff status updates with 30s TTL cache in AgentTreeProvider
  - Auto-suspend offer when AgentLimitError caught in createAgent command
  - Suspend option alongside delete in worktree limit handler
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [TTL timestamp cache alongside boolean cache for skip-on-recent-check, try/catch with typed error + retry pattern for limit errors]

key-files:
  created: []
  modified:
    - src/views/agent-tree-provider.ts
    - src/commands/agent.commands.ts
    - src/commands/worktree.commands.ts
    - test/unit/agent-tree-provider.test.ts
    - test/unit/agent.commands.test.ts
    - test/unit/worktree.commands.test.ts

key-decisions:
  - "TTL cache uses Map<string, number> timestamps alongside existing Map<string, boolean> diff cache for O(1) freshness check"
  - "handleAgentLimitError is a private helper (not exported) since it is tightly coupled to createAgent command flow"
  - "handleWorktreeLimitError accepts optional agentService third parameter for backward compatibility"
  - "Oldest idle agent selected by sorting on createdAt string comparison (ISO format sorts lexicographically)"

patterns-established:
  - "TTL cache pattern: parallel Maps (value + timestamp), skip when Date.now() - lastChecked < TTL_MS"
  - "Typed error catch-and-retry: catch specific Error subclass, offer user action, retry on success"

requirements-completed: [PERF-02, REMOTE-02]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 7 Plan 2: Diff TTL Cache and Auto-Suspend UX Summary

**Targeted per-agent diff status updates with 30s TTL cache, plus auto-suspend UX when agent/worktree limits are reached**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T09:57:23Z
- **Completed:** 2026-03-04T10:01:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Refactored AgentTreeProvider diff updates from full-sweep to targeted per-agent with 30s TTL cache
- Added auto-suspend offer in createAgent command when AgentLimitError is caught (suspend oldest idle, then retry)
- Enhanced handleWorktreeLimitError with optional suspend option alongside existing delete picker
- Added 12 new tests (6 TTL cache + 3 agent limit + 3 worktree suspend)

## Task Commits

Each task was committed atomically:

1. **Task 1: Targeted per-agent diff status updates with TTL cache** - `7f74378` (feat)
2. **Task 2: Auto-suspend UX on agent and worktree limit errors** - `169900d` (feat)

_Note: TDD tasks with RED+GREEN phases committed as single feat commits after GREEN passes_

## Files Created/Modified
- `src/views/agent-tree-provider.ts` - Added updateDiffStatusForAgent with TTL, invalidateDiffCache, diffTimestamps map
- `src/commands/agent.commands.ts` - Added AgentLimitError catch with handleAgentLimitError helper and retry logic
- `src/commands/worktree.commands.ts` - Added optional agentService param with suspend-before-delete option
- `test/unit/agent-tree-provider.test.ts` - Added 6 tests for targeted diff updates, TTL skipping, and cache invalidation
- `test/unit/agent.commands.test.ts` - Added 3 tests for agent limit error handling (suspend, no-idle, cancel)
- `test/unit/worktree.commands.test.ts` - Added 3 tests for worktree suspend option (suspend, fallthrough, backward compat)

## Decisions Made
- TTL cache uses parallel Map<string, number> for timestamps alongside existing Map<string, boolean> for diff values
- handleAgentLimitError kept as private helper (not exported) since it's specific to createAgent flow
- handleWorktreeLimitError uses optional third parameter for agentService to maintain backward compatibility
- Oldest idle agent selection uses createdAt string sort (ISO format sorts lexicographically)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 complete: all resource limits, CLI health check, TTL diff cache, and auto-suspend UX implemented
- Extension ready for scale with 5+ concurrent agents (targeted diff checks, debounce + TTL prevents thundering herd)
- Auto-suspend UX provides smooth resource management on remote/constrained environments

## Self-Check: PASSED

All 6 modified files verified on disk. Both task commits (7f74378, 169900d) verified in git log.

---
*Phase: 07-remote-support-and-performance-at-scale*
*Completed: 2026-03-04*
