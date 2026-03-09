---
phase: 05-refactor-codebase-to-match-claude-md-conventions
plan: 01
subsystem: infra
tags: [react, esbuild, tsconfig, vscode-settings, memento, data-store]

# Dependency graph
requires:
  - phase: 04-ui-polish
    provides: existing extension build pipeline and webview sidebar
provides:
  - Dual esbuild build (extension + webview)
  - tsconfig.webview.json for TSX type checking with DOM lib
  - AgentsStore thin Memento CRUD with EventEmitter
  - ReposStore thin Memento CRUD with EventEmitter
  - Three VS Code settings (maxWorktreesPerRepo, defaultStagingBranch, worktreeDirectoryName)
  - Stub webview entry point (src/ui/agenticTab.tsx)
affects: [05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: [react@19, react-dom@19, @types/react, @types/react-dom]
  patterns: [dual-esbuild-context, webview-tsconfig-separation, thin-memento-store]

key-files:
  created:
    - tsconfig.webview.json
    - src/ui/agenticTab.tsx
    - src/services/agents-store.ts
    - src/services/repos-store.ts
    - test/unit/agents-store.test.ts
    - test/unit/repos-store.test.ts
  modified:
    - esbuild.js
    - tsconfig.json
    - package.json
    - vitest.config.ts

key-decisions:
  - "Webview tsconfig overrides exclude to avoid inheriting TSX exclusion from base tsconfig"
  - "esbuild jsx: automatic for React 19 transform (no React import needed in JSX files)"
  - "Both esbuild contexts run in parallel for watch and build modes"

patterns-established:
  - "Dual esbuild context: extensionCtx (CJS/node) + webviewCtx (IIFE/browser) in same build script"
  - "Thin data store: class wrapping Memento with EventEmitter<void> for change notification"
  - "Separate tsconfig for webview TSX (DOM lib + react-jsx) extending base tsconfig"

requirements-completed: [REFACTOR-01, REFACTOR-02, REFACTOR-05]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 05 Plan 01: Build Infrastructure Summary

**Dual esbuild pipeline for React webview, thin Memento data stores, and three VS Code settings**

## Performance

- **Duration:** 4min
- **Started:** 2026-03-09T18:10:55Z
- **Completed:** 2026-03-09T18:15:24Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Dual esbuild build producing both dist/extension.js and dist/webview.js
- AgentsStore and ReposStore as thin CRUD wrappers over VS Code Memento with EventEmitter change notifications
- Three VS Code settings declared in contributes.configuration (maxWorktreesPerRepo, defaultStagingBranch, worktreeDirectoryName)
- tsconfig.webview.json with DOM lib and react-jsx for TSX type checking without polluting extension code
- All 269 tests pass (258 existing + 11 new), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install React deps, dual esbuild, tsconfig.webview.json, vitest TSX support, VS Code settings** - `9908a20` (feat)
2. **Task 2 RED: Failing tests for AgentsStore and ReposStore** - `87c35e7` (test)
3. **Task 2 GREEN: Implement AgentsStore and ReposStore** - `cfe3eb3` (feat)

## Files Created/Modified
- `esbuild.js` - Dual build contexts (extension + webview) running in parallel
- `tsconfig.webview.json` - TSX type checking with DOM lib, extends base tsconfig
- `tsconfig.json` - Added TSX exclusion so main tsc skips webview files
- `package.json` - React deps, updated scripts (check-types, watch:tsc-webview), contributes.configuration with 3 settings
- `vitest.config.ts` - Added .test.tsx include pattern
- `src/ui/agenticTab.tsx` - Stub webview entry point for Plan 02
- `src/services/agents-store.ts` - Thin AgentEntry[] CRUD over Memento with onDidChange
- `src/services/repos-store.ts` - Thin RepoConfig[] CRUD over Memento with onDidChange
- `test/unit/agents-store.test.ts` - 5 tests covering getAll, getForRepo, save, dispose
- `test/unit/repos-store.test.ts` - 6 tests covering getAll, getForRepo, save, dispose

## Decisions Made
- Webview tsconfig needs its own exclude array to override the base tsconfig's TSX exclusion
- esbuild jsx: "automatic" enables React 19 JSX transform without explicit React imports
- Both esbuild contexts (extension + webview) run in parallel for both watch and build modes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig.webview.json inherited TSX exclude from base tsconfig**
- **Found during:** Task 1 (compile verification)
- **Issue:** tsconfig.webview.json extends tsconfig.json which excludes `src/ui/**/*.tsx`, causing TS18003 "no inputs found"
- **Fix:** Added explicit `exclude: ["node_modules", "dist"]` to tsconfig.webview.json to override inherited exclusion
- **Files modified:** tsconfig.webview.json
- **Verification:** `npm run compile` succeeds, tsc --noEmit -p tsconfig.webview.json passes
- **Committed in:** 9908a20 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for tsconfig inheritance behavior. No scope creep.

## Issues Encountered
None beyond the tsconfig exclude inheritance issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- React build pipeline ready for Plan 02 (React component migration)
- Data stores ready for Plan 03 (feature file consolidation)
- VS Code settings ready for Plan 03/04 (settings consumption in features)
- All subsequent plans can build on this foundation

## Self-Check: PASSED

All 6 created files verified. All 4 modified files verified. All 3 commits found in git log.

---
*Phase: 05-refactor-codebase-to-match-claude-md-conventions*
*Completed: 2026-03-10*
