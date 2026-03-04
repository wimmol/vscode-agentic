---
phase: 04-git-workflow-and-merge-protection
plan: 02
subsystem: git
tags: [diff-review, merge-guard, QuickPick, vscode-diff, gh-cli, PR-creation, contextValue, TreeView-conditional-UI]

# Dependency graph
requires:
  - phase: 04-git-workflow-and-merge-protection
    provides: DiffService.hasUnmergedChanges and getChangedFiles, GitContentProvider.buildUri for agentic-git URIs
  - phase: 01-foundation-and-git-infrastructure
    provides: GitService.exec, RepoConfigService for staging branch lookup
  - phase: 02-agent-lifecycle-and-terminal-management
    provides: AgentService for agent CRUD, TerminalService for terminal lifecycle
  - phase: 03-sidebar-tree-view-and-workspace-switching
    provides: AgentTreeProvider, AgentTreeItem, sidebar commands for delete/copy/focus
provides:
  - Review Changes command showing changed files in QuickPick and opening VS Code diff editor
  - Create PR command running gh CLI with confirmation and PR URL display
  - Merge guard blocking agent deletion when unmerged changes exist (both command palette and sidebar)
  - Conditional contextValue on AgentTreeItem (agentItem vs agentItemWithDiffs) for conditional menu visibility
  - Async diff status cache in AgentTreeProvider with debounced updates
  - Full package.json command and menu contributions for review/PR workflow
affects: [phase-05-agent-status-detection, phase-06-suspend-restore, merge-protection-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: [execFile promisified for gh CLI subprocess, regex viewItem matching for multi-variant contextValue menus, async diff cache with debounced refresh to avoid blocking getChildren]

key-files:
  created:
    - src/commands/diff.commands.ts
    - test/unit/diff.commands.test.ts
  modified:
    - src/commands/agent.commands.ts
    - src/commands/sidebar.commands.ts
    - src/views/agent-tree-items.ts
    - src/views/agent-tree-provider.ts
    - src/extension.ts
    - package.json
    - test/unit/agent-tree-items.test.ts

key-decisions:
  - "Regex viewItem matching (/^agentItem/) for delete and copy menus to support both agentItem and agentItemWithDiffs without duplication"
  - "Async diff status cache in AgentTreeProvider avoids blocking getChildren; separate debounced update triggers refresh when results arrive"
  - "DiffService parameter made optional in registerAgentCommands and registerSidebarCommands for backward compatibility with existing tests"

patterns-established:
  - "Merge guard pattern: check diffService.hasUnmergedChanges before deletion, show warning with Review Changes / Cancel actions"
  - "Conditional contextValue pattern: TreeItem.contextValue varies by runtime state, menus use viewItem == or =~ regex to show/hide"
  - "gh CLI integration pattern: promisified execFile with ENOENT detection for missing CLI, stderr parsing for auth errors"

requirements-completed: [GIT-03, GIT-04, AGENT-04, UI-05]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 4 Plan 2: Diff Review, PR Creation, and Merge Protection Summary

**Review Changes QuickPick with vscode.diff, gh CLI PR creation with confirmation, and merge guard blocking agent deletion on both command palette and sidebar paths**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T07:39:42Z
- **Completed:** 2026-03-04T07:45:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Review Changes command shows changed files in QuickPick and opens VS Code native diff editor with GitContentProvider URIs
- Create PR command runs `gh pr create` with confirmation dialog showing base/head/file count, displays PR URL on success
- Merge guard on both deleteAgent (command palette) and deleteAgentFromTile (sidebar) hard-blocks deletion with Review Changes and Cancel actions
- AgentTreeItem contextValue switches between "agentItem" and "agentItemWithDiffs" based on async diff status
- AgentTreeProvider caches diff status separately from tree refresh to avoid blocking getChildren
- package.json contributions: reviewChanges inline button on agents with diffs, createPR in context menu, regex matching for delete/copy on both variants

## Task Commits

Each task was committed atomically:

1. **Task 1: Diff commands, merge guard, and AgentTreeItem conditional contextValue** - `634b71f` (feat)
2. **Task 2: Extension wiring and package.json command/menu contributions** - `cf9c39e` (feat)

## Files Created/Modified
- `src/commands/diff.commands.ts` - reviewChanges and createPR command handlers with QuickPick, vscode.diff, and gh CLI
- `src/commands/agent.commands.ts` - Added DiffService param and merge guard before deleteAgent confirmation
- `src/commands/sidebar.commands.ts` - Added DiffService param and merge guard before deleteAgentFromTile confirmation
- `src/views/agent-tree-items.ts` - AgentTreeItem accepts hasDiffs param, sets contextValue conditionally
- `src/views/agent-tree-provider.ts` - Added DiffService, diffStatusCache, updateDiffStatus, debouncedDiffUpdate
- `src/extension.ts` - Creates DiffService, registers GitContentProvider, wires diff commands and diffService to all command registrations
- `package.json` - Added reviewChanges and createPR commands, menu contributions with regex viewItem matching
- `test/unit/diff.commands.test.ts` - 10 tests for reviewChanges (QuickPick, diff, no-changes) and createPR (confirmation, success, error)
- `test/unit/agent-tree-items.test.ts` - 3 new tests for hasDiffs contextValue switching

## Decisions Made
- Used regex viewItem matching (`/^agentItem/`) in package.json menus so delete and copy branch buttons work on both agentItem and agentItemWithDiffs without duplicating menu entries
- Made DiffService optional parameter in registerAgentCommands and registerSidebarCommands signatures to maintain backward compatibility with existing tests (no need to update 80+ test setups)
- Async diff status cache in AgentTreeProvider reads from Map in getChildren (synchronous), updates asynchronously via separate debounced timer (300ms) to avoid blocking tree rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 4 requirements complete (GIT-03, GIT-04, AGENT-04, UI-05)
- Full diff review workflow functional: Review Changes button on agent tiles with diffs, QuickPick file selection, native diff editor
- PR creation available via context menu on agents with diffs
- Merge protection enforced on both deletion paths
- 230 tests passing across 17 test files, types clean, esbuild compiles

## Self-Check: PASSED

- All 9 created/modified files verified on disk
- Both task commits (634b71f, cf9c39e) verified in git log
- Test line counts: diff.commands.test.ts=160 (min 80), agent-tree-items.test.ts=140
- Full test suite: 230 tests passing across 17 files
- Type check: clean (npx tsc --noEmit)
- Build: esbuild compiles successfully

---
*Phase: 04-git-workflow-and-merge-protection*
*Completed: 2026-03-04*
