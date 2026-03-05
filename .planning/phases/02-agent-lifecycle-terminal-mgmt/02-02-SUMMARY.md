---
phase: 02-agent-lifecycle-terminal-mgmt
plan: 02
subsystem: agent-lifecycle
tags: [vscode-commands, agent-service, lifecycle-management, memento-persistence, tdd]

# Dependency graph
requires:
  - phase: 01-foundation-git-infra
    provides: "WorktreeService, RepoConfigService, vscode mock, test infrastructure"
  - phase: 02-agent-lifecycle-terminal-mgmt (plan 01)
    provides: "AgentEntry, AgentStatus, TerminalService, isValidBranchName"
provides:
  - "AgentService class for agent lifecycle orchestration (create, delete, focus, status, reconciliation)"
  - "registerAgentCommands function for createAgent, deleteAgent, focusAgent command handlers"
  - "Updated extension.ts with AgentService, TerminalService, agent commands, and reconciliation"
  - "Three new commands registered in package.json, all hidden from Command Palette"
affects: [03-sidebar-ui, 04-merge-protection, 05-session-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "setTerminalService pattern to break circular dependency between AgentService and TerminalService status callback"
    - "Command handlers receive context args from sidebar UI (no interactive picker for selection)"
    - "Agent name collision loop with QuickPick reuse-or-rename flow"
    - "Modal confirmation with running-state-aware warning text"

key-files:
  created:
    - src/services/agent.service.ts
    - src/commands/agent.commands.ts
    - test/unit/agent.service.test.ts
    - test/unit/agent.commands.test.ts
  modified:
    - src/extension.ts
    - package.json

key-decisions:
  - "AgentService uses setTerminalService setter (not constructor injection) to break circular dependency with TerminalService's status callback"
  - "Commands receive repoPath/agentName as arguments from sidebar UI -- no QuickPick pickers for repo/agent selection"
  - "createAgent falls back to first configured repo when repoPath not provided (for toolbar buttons)"
  - "deleteAgent uses modal confirmation with differentiated text for running vs non-running agents"
  - "All 4 commands hidden from Command Palette via menus.commandPalette when:false"

patterns-established:
  - "Setter-based dependency injection for circular service dependencies"
  - "Command handler argument pattern: sidebar passes context, commands just act"
  - "Name collision loop: validate -> check collision -> QuickPick -> retry or reuse"

requirements-completed: [AGENT-01, AGENT-02, AGENT-05, PERF-01, UI-06]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 2 Plan 2: AgentService Lifecycle Management and Command Handlers Summary

**AgentService orchestrating WorktreeService+TerminalService for create/delete/focus lifecycle, with three sidebar-only commands featuring name validation, collision handling, and modal confirmations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T14:43:49Z
- **Completed:** 2026-03-05T14:48:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- AgentService orchestrates full agent lifecycle: create with worktree, delete with cleanup, focus with lazy terminal creation, status tracking, and activation reconciliation
- Three command handlers (createAgent, deleteAgent, focusAgent) with interactive UI flows: InputBox with branch validation, QuickPick for name collision, modal confirmation for deletion
- Extension.ts wires AgentService and TerminalService with status callback, registers all commands, adds reconciliation on activation
- All commands hidden from Command Palette -- sidebar-only interactions via menus.commandPalette when:false

## Task Commits

Each task was committed atomically:

1. **Task 1: AgentService with lifecycle management**
   - `c18a93b` (test: add failing tests for AgentService lifecycle)
   - `93fec71` (feat: implement AgentService with lifecycle management)
2. **Task 2: Agent commands, extension wiring, and package.json registration**
   - `d1e3280` (test: add failing tests for agent command handlers)
   - `a9a4780` (feat: agent commands, extension wiring, and package.json registration)

_Note: TDD tasks have two commits each (test then feat)_

## Files Created/Modified
- `src/services/agent.service.ts` - AgentService class: create, delete, focus, updateStatus, reconcileOnActivation, setTerminalService
- `src/commands/agent.commands.ts` - registerAgentCommands: createAgent, deleteAgent, focusAgent command handlers
- `src/extension.ts` - Updated activation with AgentService, TerminalService, agent commands, and agent reconciliation
- `package.json` - Three new commands registered, all hidden from Command Palette via menus.commandPalette
- `test/unit/agent.service.test.ts` - 29 test cases for AgentService lifecycle
- `test/unit/agent.commands.test.ts` - 17 test cases for command handlers

## Decisions Made
- AgentService uses `setTerminalService()` setter instead of constructor injection to break circular dependency (AgentService needs TerminalService, but TerminalService's callback needs AgentService.updateStatus)
- Commands receive repoPath/agentName as arguments from sidebar UI -- no interactive picker for repo/agent selection needed
- createAgent falls back to first configured repo when no repoPath argument provided (for view title toolbar button)
- deleteAgent shows differentiated modal warning: "still running" text for running agents, standard text for others
- All 4 commands (addRepo, createAgent, deleteAgent, focusAgent) hidden from Command Palette

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AgentService ready for sidebar UI (Phase 3) to call create/delete/focus commands
- Command handlers receive arguments from sidebar -- TreeView inline buttons and context menus can pass repoPath/agentName
- Agent registry persistence via Memento ready for TreeDataProvider to read
- All 141 tests pass, build compiles successfully

## Self-Check: PASSED

All 6 files verified present. All 4 commit hashes verified in git log. 141/141 tests pass across full suite.

---
*Phase: 02-agent-lifecycle-terminal-mgmt*
*Completed: 2026-03-05*
