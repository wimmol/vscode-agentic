---
phase: 01-extension-foundation-and-git-infrastructure
plan: 03
subsystem: extension
tags: [vscode, commands, memento, gitignore, quickpick, worktree-limit, service-wiring]

# Dependency graph
requires:
  - phase: 01-extension-foundation-and-git-infrastructure (plan 01)
    provides: TypeScript scaffold, types (RepoConfig, WorktreeEntry), vscode mock, test infrastructure
  - phase: 01-extension-foundation-and-git-infrastructure (plan 02)
    provides: GitService, WorktreeService, WorktreeLimitError, worktree parser
provides:
  - RepoConfigService with interactive repo addition and staging branch configuration
  - ensureGitignoreEntry utility for .worktrees/ gitignore management
  - registerRepoCommands for vscode-agentic.addRepo command
  - handleWorktreeLimitError interactive cleanup via QuickPick
  - Complete extension.ts wiring with service singletons and activation reconciliation
affects: [phase-02, phase-03, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [interactive QuickPick flows, InputBox with retry loop, gitignore file management, fire-and-forget reconciliation]

key-files:
  created:
    - src/services/repo-config.service.ts
    - src/utils/gitignore.ts
    - src/commands/repo.commands.ts
    - src/commands/worktree.commands.ts
    - test/unit/worktree.commands.test.ts
  modified:
    - src/extension.ts
    - test/unit/repo-config.service.test.ts
    - test/unit/gitignore.test.ts

key-decisions:
  - "ensureGitignoreEntry uses node:fs/promises for real filesystem operations, mocked in RepoConfigService tests via vi.mock"
  - "handleWorktreeLimitError lists all entries without status filtering in Phase 1 (status will be added in Phase 2)"
  - "Reconciliation is fire-and-forget on activation with user notification only when orphans are found"
  - "Git health check is non-blocking (extension activates even without git, just warns)"

patterns-established:
  - "Service singletons in activate(): all services created in activate(), not at module level"
  - "Command registration pattern: registerXxxCommands(context, service) pushes disposable to subscriptions"
  - "Interactive QuickPick flow: build items with metadata properties, handle cancel (undefined return)"
  - "vi.mock for module-level dependencies in unit tests (gitignore in repo-config tests)"

requirements-completed: [GIT-01, GIT-02]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 1 Plan 3: Repo Config, Commands, and Extension Wiring Summary

**RepoConfigService with interactive staging branch config, gitignore utility, worktree limit QuickPick handler, and full extension.ts wiring connecting all Phase 1 services**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T04:28:39Z
- **Completed:** 2026-03-05T04:33:35Z
- **Tasks:** 3 (2 auto + 1 auto-approved checkpoint)
- **Files modified:** 8

## Accomplishments
- RepoConfigService implements full interactive addRepo flow: workspace folder picker, staging branch InputBox with "staging" default, existing branch confirmation QuickPick, Memento persistence, and gitignore entry
- ensureGitignoreEntry creates/appends .worktrees/ to .gitignore with proper newline handling and duplicate detection
- handleWorktreeLimitError presents QuickPick of existing worktrees for interactive cleanup when limit is reached
- extension.ts wires GitService, WorktreeService, RepoConfigService singletons with command registration and non-blocking reconciliation
- 48 total tests pass across 6 test files (20 new tests in this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: RepoConfigService + gitignore utility + command handlers** (TDD)
   - `2a523a5` (test) - TDD RED: failing tests for RepoConfigService, gitignore, and worktree limit handler
   - `c81f2c5` (feat) - TDD GREEN: implement all source files with 20 passing tests

2. **Task 2: Wire extension.ts**
   - `381825d` (feat) - Full extension wiring with biome lint fixes

3. **Task 3: Verify Phase 1 end-to-end** - Auto-approved (auto mode active)

## Files Created/Modified
- `src/services/repo-config.service.ts` - Interactive repo registration with staging branch config and Memento persistence
- `src/utils/gitignore.ts` - Ensures .worktrees/ is in .gitignore (creates file if missing)
- `src/commands/repo.commands.ts` - Registers vscode-agentic.addRepo command
- `src/commands/worktree.commands.ts` - handleWorktreeLimitError QuickPick cleanup utility
- `src/extension.ts` - Full activate() wiring with services, commands, health check, and reconciliation
- `test/unit/repo-config.service.test.ts` - 11 tests: getAll, getForRepo, addRepo flows, cancellation, duplicates, removeRepo
- `test/unit/gitignore.test.ts` - 5 tests: create, append, no-duplicate, no-trailing-newline, alternate format
- `test/unit/worktree.commands.test.ts` - 4 tests: QuickPick display, selection, cancellation, info message

## Decisions Made
- ensureGitignoreEntry uses real filesystem (node:fs/promises) and is mocked via vi.mock in RepoConfigService tests to avoid requiring a real repo directory
- handleWorktreeLimitError lists ALL existing worktrees without status filtering in Phase 1; Phase 2 will add running/idle/finished status indicators
- Reconciliation on activation is fire-and-forget (non-blocking) with user notification only when orphans are found and cleaned
- Git health check is non-blocking -- extension activates normally and shows error message if git is unavailable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mocked ensureGitignoreEntry in RepoConfigService tests**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** RepoConfigService.addRepo() calls ensureGitignoreEntry which writes to filesystem; tests use fake paths like "/my-repo" that don't exist, causing ENOENT errors
- **Fix:** Added vi.mock("../../src/utils/gitignore") to repo-config.service.test.ts to prevent filesystem access during unit tests
- **Files modified:** test/unit/repo-config.service.test.ts
- **Verification:** All 11 RepoConfigService tests pass
- **Committed in:** c81f2c5 (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Removed non-null assertions to satisfy biome lint**
- **Found during:** Task 2 (extension wiring + lint pass)
- **Issue:** biome's noNonNullAssertion rule flagged `picked._path!` and `stagingBranch!` in repo-config.service.ts
- **Fix:** Changed RepoPickItem._path from optional to required (with empty string for Browse), refactored stagingBranch to initialize as empty string with separate input variable
- **Files modified:** src/services/repo-config.service.ts
- **Verification:** biome check passes (0 errors in new files), TypeScript compiles
- **Committed in:** 381825d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for test correctness and lint compliance. No scope creep.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 1 is complete: working VS Code extension with repo addition, staging branch config, worktree management with hard limits, orphan reconciliation, and interactive cleanup
- handleWorktreeLimitError is exported and ready for Phase 2 agent creation commands to catch WorktreeLimitError and offer cleanup
- All git operations are async (PERF-04 maintained)
- Extension activates cleanly, dist/extension.js is built successfully
- 48 tests across 6 test files provide regression safety for Phase 2 work

## Self-Check: PASSED

All 8 created/modified files verified on disk. All 3 commit hashes (2a523a5, c81f2c5, 381825d) verified in git log.

---
*Phase: 01-extension-foundation-and-git-infrastructure*
*Completed: 2026-03-05*
