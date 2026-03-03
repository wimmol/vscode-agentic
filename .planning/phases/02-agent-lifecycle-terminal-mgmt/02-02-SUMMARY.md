---
phase: 02-agent-lifecycle-terminal-mgmt
plan: 02
subsystem: agent-lifecycle
tags: [agent-service, vscode-commands, memento-persistence, lifecycle-orchestration, tdd]

# Dependency graph
requires:
  - phase: 01-extension-foundation
    provides: WorktreeService, RepoConfigService, GitService, extension.ts wiring pattern
  - phase: 02-agent-lifecycle-terminal-mgmt (plan 01)
    provides: AgentEntry model, TerminalService, isValidBranchName, vscode mock infrastructure
provides:
  - AgentService class for full agent lifecycle orchestration (create, delete, focus, status, reconciliation)
  - registerAgentCommands function with three interactive VS Code commands (createAgent, deleteAgent, focusAgent)
  - Updated extension.ts with AgentService+TerminalService wiring and agent reconciliation
  - Three new commands registered in package.json (createAgent, deleteAgent, focusAgent)
affects: [03-sidebar-ui, 04-agent-detail-view, 05-session-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns: [setter-injection-for-circular-deps, recursive-name-collision-resolution, lazy-terminal-creation]

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
  - "setTerminalService setter pattern to break circular dependency between AgentService and TerminalService status callback"
  - "Recursive promptForAgentName for name collision resolution with reuse or rename options"
  - "Lazy terminal creation on focusAgent -- agents start with status 'created', terminal only on focus"
  - "Empty string prompt normalized to undefined -- distinguishes 'no prompt' from 'user cancelled'"

patterns-established:
  - "Setter injection: when two services have circular callback dependencies, construct both then wire via setter"
  - "Agent picker pattern: QuickPick items carry _repoPath/_agentName/_status metadata for handler use"
  - "Repo auto-skip: single-repo shortcut pattern for all agent commands"

requirements-completed: [AGENT-01, AGENT-02, AGENT-05, PERF-01]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 2 Plan 2: AgentService Lifecycle and Agent Commands Summary

**AgentService orchestrating WorktreeService+TerminalService with Memento persistence, plus three interactive VS Code commands for create/delete/focus agent workflows**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T20:30:29Z
- **Completed:** 2026-03-03T20:34:56Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- AgentService with full lifecycle management: create (worktree+registry), delete (terminal+worktree+registry), focus (lazy terminal creation), status updates, and activation reconciliation
- Three interactive commands: createAgent (repo picker, name input with validation, collision handling, optional prompt), deleteAgent (agent picker, modal confirmation, running agent warning), focusAgent (agent picker, lazy terminal)
- Extension.ts wired with AgentService+TerminalService using setter injection pattern to break circular dependency
- 148 total tests pass (27 AgentService + 24 agent commands + 97 existing), TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: AgentService with lifecycle management** - `4aab1cc` (feat)
2. **Task 2: Agent commands, extension wiring, and package.json registration** - `209e4c6` (feat)

_Note: Both tasks used TDD (RED then GREEN phases) with separate test commits_

- RED test commit for Task 1: `ba48c45` (test)
- RED test commit for Task 2: `e2e3a49` (test)

## Files Created/Modified
- `src/services/agent.service.ts` - AgentService class: create, delete, focus, updateStatus, reconcileOnActivation, setTerminalService
- `src/commands/agent.commands.ts` - registerAgentCommands with createAgent, deleteAgent, focusAgent handlers
- `test/unit/agent.service.test.ts` - 27 tests covering all AgentService behaviors
- `test/unit/agent.commands.test.ts` - 24 tests covering all command handler flows
- `src/extension.ts` - Added AgentService, TerminalService, agent commands, terminal disposal, agent reconciliation
- `package.json` - Three new commands: createAgent, deleteAgent, focusAgent in Agentic category

## Decisions Made
- Used `setTerminalService()` setter pattern instead of constructor injection to break circular dependency between AgentService (needs TerminalService for focus/delete) and TerminalService (needs AgentService.updateStatus callback)
- Recursive `promptForAgentName` function for name collision -- user can choose "Reuse existing" (focus) or "Pick a different name" (re-prompt), with graceful handling of cancel at any step
- Lazy terminal creation: agents start with status "created" and get a terminal only when focused. This aligns with the design that terminals are ephemeral and lost on restart
- Empty string initial prompt normalized to `undefined` to cleanly distinguish "no prompt provided" from "user cancelled the prompt dialog"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mock using expect.stringContaining as real value**
- **Found during:** Task 2 (agent command tests)
- **Issue:** Test for name collision reuse used `expect.stringContaining("Reuse")` as the mock return value label, but this returns a Vitest matcher object, not a real string, causing `startsWith` to fail
- **Fix:** Changed mock to return a real string label `"Reuse existing agent 'existing-agent'"`
- **Files modified:** test/unit/agent.commands.test.ts
- **Verification:** Test passes after fix
- **Committed in:** 209e4c6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor test mock fix. No scope creep.

## Issues Encountered
None beyond the test mock fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AgentService and agent commands provide complete lifecycle for Phase 3 sidebar UI (TreeDataProvider can call agentService.getAll/getForRepo)
- Agent status model (created/running/finished/error) ready for status icons and color coding in sidebar
- Command IDs registered and ready for TreeItem command binding
- Extension.ts activation pattern established for adding more services in future phases

## Self-Check: PASSED

All 7 files verified present. All 4 task commits (ba48c45, 4aab1cc, e2e3a49, 209e4c6) confirmed in git log. 148 total tests pass across 10 test files. TypeScript compiles clean.

---
*Phase: 02-agent-lifecycle-terminal-mgmt*
*Completed: 2026-03-04*
