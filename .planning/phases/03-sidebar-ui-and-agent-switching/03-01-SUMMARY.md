---
phase: 03-sidebar-ui-and-agent-switching
plan: 01
subsystem: ui
tags: [treeview, treedataprovider, treeitem, themeicon, sidebar, eventemitter]

requires:
  - phase: 02-agent-lifecycle-and-terminal-management
    provides: AgentService with getAll/getForRepo/updateStatus and AgentEntry model
provides:
  - AgentTreeProvider with two-level repo-group/agent hierarchy
  - AgentTreeItem and RepoGroupItem TreeItem subclasses with status icons
  - onDidChangeAgents event on AgentService for reactive UI updates
  - getStatusIcon mapping for all 4 agent statuses
affects: [03-02, sidebar-registration, context-menus, cross-repo-switching]

tech-stack:
  added: []
  patterns: [TreeDataProvider with debounced auto-refresh, TreeItem subclasses with contextValue for menu targeting]

key-files:
  created:
    - src/views/agent-tree-provider.ts
    - src/views/agent-tree-items.ts
    - test/unit/agent-tree-provider.test.ts
    - test/unit/agent-tree-items.test.ts
  modified:
    - src/services/agent.service.ts
    - test/__mocks__/vscode.ts
    - test/unit/agent.service.test.ts

key-decisions:
  - "Repo groups derived from agentService.getAll() grouping, not RepoConfigService -- only repos with agents appear"
  - "150ms debounce on auto-refresh to avoid flickering during rapid state changes"
  - "Status priority sorting: running(0) > created(1) > finished(2) > error(3)"

patterns-established:
  - "TreeItem subclass pattern: extend vscode.TreeItem, set contextValue for menu targeting, store domain properties"
  - "EventEmitter-based change notification: service fires event, TreeDataProvider subscribes with debounced refresh"

requirements-completed: [UI-01, UI-02]

duration: 4min
completed: 2026-03-04
---

# Phase 3 Plan 1: TreeDataProvider Core and TreeItems Summary

**Two-level sidebar TreeView with repo-grouped agent tiles, status icons, and auto-refresh via AgentService change events**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T21:22:06Z
- **Completed:** 2026-03-03T21:26:14Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- AgentService now fires onDidChangeAgents event on all state mutations (create, delete, updateStatus, reconcile)
- AgentTreeProvider renders two-level hierarchy: repo groups at root, sorted agent items as children
- AgentTreeItem displays agent name, truncated prompt description, status-colored ThemeIcon, and focusAgent click command
- Extended vscode mocks with ThemeIcon, ThemeColor, createTreeView, updateWorkspaceFolders for test coverage

## Task Commits

Each task was committed atomically:

1. **Task 1: AgentService change event and vscode mock extensions** - `708ade8` (feat)
2. **Task 2: AgentTreeProvider and TreeItem classes** - `b143b41` (feat)

_Note: TDD tasks -- tests written first (RED), then implementation (GREEN), committed together per task._

## Files Created/Modified
- `src/views/agent-tree-provider.ts` - TreeDataProvider with repo-group/agent hierarchy, debounced auto-refresh
- `src/views/agent-tree-items.ts` - AgentTreeItem, RepoGroupItem subclasses, getStatusIcon utility
- `src/services/agent.service.ts` - Added onDidChangeAgents EventEmitter, dispose() method
- `test/__mocks__/vscode.ts` - Added ThemeIcon, ThemeColor, createTreeView, updateWorkspaceFolders mocks
- `test/unit/agent-tree-provider.test.ts` - 12 tests for hierarchy, sorting, refresh, dispose
- `test/unit/agent-tree-items.test.ts` - 20 tests for icons, properties, truncation
- `test/unit/agent.service.test.ts` - 6 new tests for change event lifecycle

## Decisions Made
- Repo groups derived from agentService.getAll() grouping rather than RepoConfigService -- only repos with agents appear in sidebar (empty state handled by welcome content)
- 150ms debounce on TreeDataProvider auto-refresh to prevent flickering during rapid state changes (e.g., reconcile updating multiple agents)
- Status priority map: running=0, created=1, finished=2, error=3 -- running agents always appear first

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Test assertion mismatch on truncated prompt: 40-char slice includes trailing space before "...", corrected expected string in test

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- TreeDataProvider and TreeItems ready for registration in extension.ts (Plan 03-02)
- contextValue set on both item types, ready for context menu contributions in package.json
- onDidChangeAgents event available for any future subscribers

## Self-Check: PASSED

All created files verified on disk. All commit hashes (708ade8, b143b41) verified in git log. 186 tests passing, TypeScript compiles clean.

---
*Phase: 03-sidebar-ui-and-agent-switching*
*Completed: 2026-03-04*
