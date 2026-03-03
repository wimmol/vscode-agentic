---
phase: 01-extension-foundation-and-git-infrastructure
plan: 02
subsystem: infra
tags: [git-worktree, async-exec, child-process, memento, mutex, reconciliation]

# Dependency graph
requires:
  - phase: 01-01
    provides: "VS Code extension scaffold, WorktreeEntry/WorktreeOnDisk/RepoConfig types, Vitest infrastructure with vscode mock"
provides:
  - "GitService: async git command execution wrapper (never sync)"
  - "WorktreeService: worktree CRUD, per-repo hard limit enforcement via typed WorktreeLimitError, Memento-backed manifest, disk vs manifest reconciliation"
  - "parseWorktreeList: pure function parsing git worktree list --porcelain output"
affects: [01-03, 02-agent-lifecycle, all-subsequent-phases]

# Tech tracking
tech-stack:
  added: ["@types/node@22"]
  patterns: [constructor-injection, per-repo-mutex, typed-error-with-recovery-data, memento-manifest-pattern, porcelain-output-parser]

key-files:
  created:
    - src/services/git.service.ts
    - src/services/worktree.service.ts
    - src/utils/worktree-parser.ts
  modified:
    - test/unit/git.service.test.ts
    - test/unit/worktree.service.test.ts
    - test/unit/worktree-parser.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "WorktreeLimitError carries existingEntries array for interactive cleanup in command layer"
  - "Per-repo mutex via promise chain prevents TOCTOU races on concurrent addWorktree calls"
  - "Reconciliation cleans up both directions: manifest orphans removed from state, disk orphans removed via git worktree remove"
  - "Only .worktrees/ paths flagged as orphanedOnDisk -- main worktree is never touched"

patterns-established:
  - "Constructor injection: WorktreeService(gitService, memento) -- services receive dependencies"
  - "Typed errors with recovery data: WorktreeLimitError includes existingEntries for UI cleanup flow"
  - "Memento manifest pattern: all WorktreeEntry[] stored under single key, filtered by repoPath"
  - "Per-repo mutex: Map<string, Promise<void>> queuing pattern for serialized access"

requirements-completed: [GIT-02, GIT-05, GIT-06, PERF-04]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 1 Plan 02: Git Infrastructure Summary

**Async GitService wrapper, WorktreeService with CRUD/hard-limits/manifest/reconciliation, and parseWorktreeList porcelain parser -- the core worktree isolation infrastructure**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T19:32:21Z
- **Completed:** 2026-03-03T19:36:58Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- GitService wrapping promisify(execFile) with 30s timeout, 10MB maxBuffer, and GitError with args/exitCode
- WorktreeService with full CRUD: addWorktree creates at .worktrees/<agentName>/, removeWorktree with graceful missing-worktree handling
- Per-repo hard limit enforcement via typed WorktreeLimitError carrying existingEntries for interactive cleanup in command layer
- Manifest-vs-disk reconciliation detecting orphans in both directions with automatic cleanup
- Per-repo mutex preventing TOCTOU races on concurrent operations
- parseWorktreeList parsing git's porcelain format into typed WorktreeOnDisk objects
- 32 new unit tests (6 GitService + 9 parser + 17 WorktreeService) all passing

## Task Commits

Each task was committed atomically (TDD: test then implementation):

1. **Task 1: GitService + parseWorktreeList (RED)** - `8eaaad2` (test)
2. **Task 1: GitService + parseWorktreeList (GREEN)** - `903d321` (feat)
3. **Task 2: WorktreeService (RED)** - `9197f87` (test)
4. **Task 2: WorktreeService (GREEN)** - `4e89b1e` (feat)

## Files Created/Modified
- `src/services/git.service.ts` - Async git command execution with GitError, branchExists helper
- `src/services/worktree.service.ts` - Worktree CRUD, limit enforcement, manifest management, reconciliation, per-repo mutex
- `src/utils/worktree-parser.ts` - Pure function parsing git worktree list --porcelain into WorktreeOnDisk[]
- `test/unit/git.service.test.ts` - 6 tests covering exec success/failure, branchExists, PERF-04 static check
- `test/unit/worktree.service.test.ts` - 17 tests covering add/remove/getManifest/reconcile/mutex
- `test/unit/worktree-parser.test.ts` - 9 tests covering single/multi entry, detached HEAD, locked/prunable, empty input
- `package.json` - Added @types/node devDependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- WorktreeLimitError carries existingEntries array so the command layer (Plan 01-03) can present a QuickPick for interactive cleanup per CONTEXT.md decision
- Per-repo mutex uses promise chain pattern (Map<string, Promise<void>>) -- lightweight, no external dependency
- Reconciliation only considers .worktrees/ paths as managed -- main worktree is never flagged as orphan
- removeWorktree handles already-missing worktrees gracefully by catching git errors and still cleaning manifest

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @types/node for Node.js API type declarations**
- **Found during:** Task 1 (TypeScript type check)
- **Issue:** git.service.ts imports node:child_process and node:util but @types/node was not installed, causing TS2307
- **Fix:** Installed @types/node@22 as devDependency
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run check-types` exits 0
- **Committed in:** 903d321 (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Fixed vitest vi.mock hoisting issue in git.service.test.ts**
- **Found during:** Task 1 (Test execution)
- **Issue:** `const mockExecFile = vi.fn()` not available when vi.mock factory runs (hoisted above variable declaration)
- **Fix:** Used `vi.hoisted()` to declare mock function before vi.mock factory
- **Files modified:** test/unit/git.service.test.ts
- **Verification:** All 6 GitService tests pass
- **Committed in:** 903d321 (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 test bug)
**Impact on plan:** Both auto-fixes necessary for correct test execution and compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GitService and WorktreeService ready for command registration in Plan 03
- WorktreeLimitError ready for QuickPick cleanup flow in command layer
- Reconciliation ready to be called on extension activation or user command
- All git operations async (PERF-04 verified via static analysis test)

---
*Phase: 01-extension-foundation-and-git-infrastructure*
*Completed: 2026-03-04*
