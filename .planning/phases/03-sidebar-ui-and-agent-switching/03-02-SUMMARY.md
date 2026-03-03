---
phase: 03-sidebar-ui-and-agent-switching
plan: 02
subsystem: ui
tags: [treeview, workspace-switching, context-menus, inline-actions, toolbar, welcome-content, clipboard]

requires:
  - phase: 03-sidebar-ui-and-agent-switching
    provides: AgentTreeProvider with two-level hierarchy, AgentTreeItem/RepoGroupItem with contextValue targeting
  - phase: 02-agent-lifecycle-and-terminal-management
    provides: AgentService with focusAgent/deleteAgent, TerminalService, WorktreeService with getManifest
provides:
  - WorkspaceSwitchService for same-repo and cross-repo agent switching with editor context
  - Sidebar commands (focusAgentFromTile, deleteAgentFromTile, copyBranchName, createAgentInRepo)
  - TreeView registration via createTreeView with full menu contributions
  - package.json menus (view/title toolbar, view/item/context, inline actions) and viewsWelcome
affects: [04-status-bar, 05-suspend-restore, cross-repo-workflow]

tech-stack:
  added: []
  patterns: [WorkspaceSwitchService for cross-repo context switching with updateWorkspaceFolders/revealInExplorer/showTextDocument, sidebar command separation from command palette commands via focusAgentFromTile vs focusAgent]

key-files:
  created:
    - src/services/workspace-switch.service.ts
    - src/commands/sidebar.commands.ts
    - test/unit/workspace-switch.service.test.ts
    - test/unit/sidebar.commands.test.ts
  modified:
    - src/extension.ts
    - src/commands/agent.commands.ts
    - src/views/agent-tree-items.ts
    - package.json
    - test/__mocks__/vscode.ts
    - test/unit/agent-tree-items.test.ts

key-decisions:
  - "Separate focusAgentFromTile (sidebar click with workspace switch) from focusAgent (command palette with picker) to avoid argument confusion"
  - "Cross-repo switch opens README.md in preview tab with preserveFocus to avoid stealing focus from sidebar"
  - "createAgentInRepo delegates to existing createAgent command with preSelectedRepoPath to avoid code duplication"

patterns-established:
  - "Sidebar command separation: TreeItem.command uses tile-specific handler, command palette uses picker-based handler"
  - "WorkspaceSwitchService pattern: same-repo = terminal only, cross-repo = workspace folder + explorer reveal + editor file + terminal"

requirements-completed: [UI-01, UI-03, UI-04]

duration: 4min
completed: 2026-03-04
---

# Phase 3 Plan 2: Sidebar Wiring, Commands, and Cross-Repo Switching Summary

**Full sidebar UI with TreeView registration, context menus, inline actions, toolbar buttons, cross-repo workspace switching with editor context, and welcome content**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T21:29:07Z
- **Completed:** 2026-03-03T21:33:43Z
- **Tasks:** 3 (2 auto + 1 auto-approved checkpoint)
- **Files modified:** 10

## Accomplishments
- WorkspaceSwitchService handles same-repo (terminal only) and cross-repo (workspace folder + explorer + editor + terminal) agent switching
- Four new sidebar commands registered: focusAgentFromTile, deleteAgentFromTile, copyBranchName, createAgentInRepo
- package.json declares toolbar buttons (Create Agent, Add Repo), inline actions (trash on agent, + on repo group), context menus (Delete, Copy Branch Name), and welcome content
- extension.ts wires TreeView via createTreeView, connects WorkspaceSwitchService, registers all sidebar commands

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkspaceSwitchService, sidebar commands, and agent click handling** - `e25f895` (feat, TDD)
2. **Task 2: Extension wiring, TreeView registration, and package.json menus** - `a498e72` (feat)
3. **Task 3: Visual verification of sidebar UI** - Auto-approved (auto mode active)

_Note: TDD task -- tests written first (RED), then implementation (GREEN), committed together._

## Files Created/Modified
- `src/services/workspace-switch.service.ts` - Cross-repo workspace switching with updateWorkspaceFolders, revealInExplorer, showTextDocument
- `src/commands/sidebar.commands.ts` - focusAgentFromTile, deleteAgentFromTile, copyBranchName, createAgentInRepo
- `src/extension.ts` - TreeView creation, WorkspaceSwitchService instantiation, sidebar command registration, disposables
- `src/commands/agent.commands.ts` - createAgent accepts optional preSelectedRepoPath, focusAgent accepts optional programmatic args
- `src/views/agent-tree-items.ts` - AgentTreeItem.command changed to focusAgentFromTile
- `package.json` - 4 new commands, icons, menus (view/title, view/item/context), viewsWelcome
- `test/__mocks__/vscode.ts` - Added env.clipboard, openTextDocument, showTextDocument, Uri.joinPath mocks
- `test/unit/workspace-switch.service.test.ts` - 8 tests for same-repo/cross-repo switching, active agent tracking
- `test/unit/sidebar.commands.test.ts` - 6 tests for all sidebar command handlers
- `test/unit/agent-tree-items.test.ts` - Updated command assertion from focusAgent to focusAgentFromTile

## Decisions Made
- Separate focusAgentFromTile (sidebar click with workspace switch) from focusAgent (command palette with picker) -- avoids argument confusion and allows different behavior paths
- Cross-repo switch opens README.md in preview tab with preserveFocus: true -- user sees file content without losing sidebar focus
- createAgentInRepo delegates to existing createAgent command with preSelectedRepoPath rather than duplicating creation logic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing test assertion for command rename**
- **Found during:** Task 2
- **Issue:** agent-tree-items.test.ts expected `vscode-agentic.focusAgent` but AgentTreeItem.command was intentionally changed to `focusAgentFromTile`
- **Fix:** Updated test assertion to match new command ID
- **Files modified:** test/unit/agent-tree-items.test.ts
- **Committed in:** a498e72 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Expected consequence of the command rename. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sidebar fully functional: agent tiles, click-to-switch, context menus, inline actions, toolbar, welcome content
- WorkspaceSwitchService available for future cross-repo operations
- Phase 3 complete -- ready for Phase 4 (status bar and notifications)

---
*Phase: 03-sidebar-ui-and-agent-switching*
*Completed: 2026-03-04*
