---
phase: 05-refactor-codebase-to-match-claude-md-conventions
plan: 03
subsystem: architecture
tags: [feature-files, vscode-workspace-fs, vscode-uri, terminal-management, command-registration]

# Dependency graph
requires:
  - phase: 05-refactor-codebase-to-match-claude-md-conventions
    provides: AgentsStore and ReposStore thin data stores, VS Code settings
affects: [05-04]
provides:
  - 8 feature files in src/features/ (create-agent, delete-agent, focus-agent, stop-agent, add-repo, remove-repo, root-global, root-repo)
  - Shared terminal state as module functions in src/utils/terminal.ts
  - Migrated gitignore.ts to vscode.workspace.fs
  - Migrated workspace.service.ts to vscode.workspace.fs + vscode.Uri
  - Unit tests for create-agent, delete-agent, and add-repo features

# Tech tracking
tech-stack:
  added: []
  patterns: [feature-file-pattern, module-function-terminal-state, duck-typed-interface-for-migration]

key-files:
  created:
    - src/features/create-agent.ts
    - src/features/delete-agent.ts
    - src/features/focus-agent.ts
    - src/features/stop-agent.ts
    - src/features/add-repo.ts
    - src/features/remove-repo.ts
    - src/features/root-global.ts
    - src/features/root-repo.ts
    - src/utils/terminal.ts
    - test/unit/create-agent.test.ts
    - test/unit/delete-agent.test.ts
    - test/unit/add-repo.test.ts
  modified:
    - src/utils/gitignore.ts
    - src/services/workspace.service.ts
    - test/__mocks__/vscode.ts
    - test/unit/gitignore.test.ts
    - test/unit/workspace.service.test.ts

key-decisions:
  - "Terminal state as module functions (not class) -- shared Map + close handler imported by feature files"
  - "WorkspaceService accepts duck-typed RepoDataSource interface for backwards compat during migration"
  - "basename helper inline instead of node:path import -- simple split('/').pop() pattern"
  - "Feature files call vscode.commands.executeCommand for cross-feature actions (e.g. focusAgent from createAgent collision)"

patterns-established:
  - "Feature file pattern: export function register*(context, ...stores/services) with command registration + handler + business logic"
  - "Module-level terminal state: shared Map<string, Terminal> with initTerminals/createTerminal/disposeTerminal functions"
  - "VS Code API migration: vscode.workspace.fs.readFile/writeFile/createDirectory replacing node:fs"
  - "Path handling: vscode.Uri.joinPath/vscode.Uri.file replacing node:path.join"

requirements-completed: [REFACTOR-04, REFACTOR-06]

# Metrics
duration: 9min
completed: 2026-03-10
---

# Phase 05 Plan 03: Feature-Based Architecture Summary

**8 self-contained feature files absorbing commands+services, vscode.workspace.fs migration for gitignore and workspace service, 27 new unit tests**

## Performance

- **Duration:** 9min
- **Started:** 2026-03-09T18:19:54Z
- **Completed:** 2026-03-09T18:28:39Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- 8 feature files in src/features/ each self-contained with command registration + handler + full business logic
- Shared terminal management as module-level functions in src/utils/terminal.ts (not a class)
- gitignore.ts fully migrated from node:fs/path to vscode.workspace.fs/Uri with configurable worktree dir name
- workspace.service.ts fully migrated from node:fs/path to vscode.workspace.fs/Uri with duck-typed interface
- 27 new unit tests: 10 for create-agent, 7 for delete-agent, 10 for add-repo
- Existing gitignore and workspace.service tests updated for vscode.workspace.fs mocks
- All 302 tests pass, npm run compile succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent feature files + terminal utility** - `3276419` (feat)
2. **Task 2: Repo/workspace features + API migrations + tests** - `652650a` (feat)

## Files Created/Modified
- `src/utils/terminal.ts` - Shared terminal state (Map, close handler) as module functions
- `src/features/create-agent.ts` - Agent creation with worktree limit, mutex, collision handling
- `src/features/delete-agent.ts` - Agent deletion with confirmation, terminal dispose, git cleanup
- `src/features/focus-agent.ts` - Agent focus with lazy terminal creation, Explorer scope switch
- `src/features/stop-agent.ts` - Agent stop with terminal dispose, status update
- `src/features/add-repo.ts` - Repo add with interactive picker, git validation, staging branch loop
- `src/features/remove-repo.ts` - Repo removal with confirmation, workspace sync
- `src/features/root-global.ts` - Reset Explorer to show all configured repos
- `src/features/root-repo.ts` - Set Explorer scope to single repo root
- `src/utils/gitignore.ts` - Migrated from node:fs to vscode.workspace.fs
- `src/services/workspace.service.ts` - Migrated from node:fs/path to vscode.workspace.fs/Uri
- `test/__mocks__/vscode.ts` - Added showOpenDialog and createDirectory mocks
- `test/unit/gitignore.test.ts` - Rewritten for vscode.workspace.fs mocks
- `test/unit/workspace.service.test.ts` - Rewritten for vscode.workspace.fs mocks
- `test/unit/create-agent.test.ts` - 10 tests for create-agent feature
- `test/unit/delete-agent.test.ts` - 7 tests for delete-agent feature
- `test/unit/add-repo.test.ts` - 10 tests for add-repo feature

## Decisions Made
- Terminal state as module functions rather than a class -- simpler, avoids cross-feature import of a service instance
- WorkspaceService accepts a `RepoDataSource` duck-typed interface (just `getAll()`) so both old `RepoConfigService` and new `ReposStore` satisfy it, allowing incremental migration
- Feature files use `vscode.commands.executeCommand` for cross-feature calls (e.g., createAgent collision reuse calls focusAgent) to avoid circular imports
- Inline basename helper (`p.split("/").pop()`) instead of importing node:path -- simple enough to not need a utility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WorkspaceService type mismatch with RepoConfigService**
- **Found during:** Task 2 (workspace.service.ts migration)
- **Issue:** Changing constructor to accept `ReposStore` broke extension.ts which still passes `RepoConfigService`
- **Fix:** Introduced `RepoDataSource` duck-typed interface that both `ReposStore` and `RepoConfigService` satisfy (only needs `getAll()`)
- **Files modified:** src/services/workspace.service.ts
- **Verification:** `npm run compile` succeeds with both old and new callers
- **Committed in:** 652650a (Task 2 commit)

**2. [Rule 3 - Blocking] Missing showOpenDialog mock in vscode test helper**
- **Found during:** Task 2 (add-repo tests)
- **Issue:** `vscode.window.showOpenDialog` not mocked, causing test failure for Browse flow
- **Fix:** Added `showOpenDialog: vi.fn()` to the window mock object
- **Files modified:** test/__mocks__/vscode.ts
- **Verification:** All add-repo tests pass including browse scenario
- **Committed in:** 652650a (Task 2 commit)

**3. [Rule 3 - Blocking] Missing createDirectory mock in vscode workspace.fs**
- **Found during:** Task 2 (workspace.service.ts test update)
- **Issue:** Migrated workspace.service.ts calls `vscode.workspace.fs.createDirectory` which was not in mock
- **Fix:** Added `createDirectory: vi.fn()` to workspace.fs mock
- **Files modified:** test/__mocks__/vscode.ts
- **Verification:** All workspace.service tests pass
- **Committed in:** 652650a (Task 2 commit)

**4. [Rule 3 - Blocking] Existing gitignore.test.ts and workspace.service.test.ts broken by API migration**
- **Found during:** Task 2 (full test suite run)
- **Issue:** Tests mocked node:fs but code now uses vscode.workspace.fs
- **Fix:** Rewrote both test files to mock vscode.workspace.fs instead of node:fs
- **Files modified:** test/unit/gitignore.test.ts, test/unit/workspace.service.test.ts
- **Verification:** All 302 tests pass
- **Committed in:** 652650a (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 blocking)
**Impact on plan:** All auto-fixes necessary for compilation and test correctness. No scope creep.

## Issues Encountered
None beyond the blocking issues documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 feature files ready for Plan 04 cleanup (remove dead code: old command files, absorbed service files)
- Old files (agent.commands.ts, repo.commands.ts, workspace.commands.ts, agent.service.ts, terminal.service.ts, repo-config.service.ts, worktree.service.ts) are now dead code
- extension.ts still wires old services -- Plan 04 will update it to wire feature files instead
- All 302 tests pass, build is green

## Self-Check: PASSED

All 17 files verified (12 created, 5 modified). Both task commits found (3276419, 652650a).

---
*Phase: 05-refactor-codebase-to-match-claude-md-conventions*
*Completed: 2026-03-10*
