---
phase: 07-remote-support-and-performance-at-scale
plan: 01
subsystem: infra
tags: [vscode-settings, resource-limits, cli-health-check, remote-support]

# Dependency graph
requires:
  - phase: 06-suspend-restore-and-notifications
    provides: Agent lifecycle with suspend/restore states
provides:
  - VS Code configuration settings for resource limits (maxAgentsPerRepo, maxWorktreesPerRepo, maxConcurrentAgents)
  - AgentLimitError class for per-repo and global agent limit enforcement
  - Claude CLI health check on activation with command disablement
  - Settings-based worktree limit (replacing Memento-based worktreeLimit)
affects: [07-02-remote-support-and-performance-at-scale]

# Tech tracking
tech-stack:
  added: [node:child_process execFile for CLI health check]
  patterns: [VS Code getConfiguration with resource scope for per-remote overrides, context key gating for menu when clauses]

key-files:
  created: []
  modified:
    - package.json
    - src/models/repo.ts
    - src/services/repo-config.service.ts
    - src/services/worktree.service.ts
    - src/services/agent.service.ts
    - src/extension.ts
    - test/__mocks__/vscode.ts
    - test/unit/repo-config.service.test.ts
    - test/unit/worktree.service.test.ts
    - test/unit/agent.service.test.ts
    - test/unit/agent.commands.test.ts
    - test/unit/diff.commands.test.ts
    - test/unit/diff.service.test.ts

key-decisions:
  - "Resource scope for all three settings enables per-remote-host overrides via VS Code's native settings infrastructure"
  - "Dynamic import replaced with regular import for vscode in WorktreeService (runtime access needed for getConfiguration)"
  - "AgentLimitError carries limitType (per-repo/global) and existingAgents for command layer error messaging"
  - "Claude CLI health check uses != false in when clauses so buttons are visible before check completes (undefined != false)"

patterns-established:
  - "Settings-based limits: vscode.workspace.getConfiguration('vscode-agentic', Uri.file(repoPath)).get('settingName', default)"
  - "Configurable test mock: _setConfigValue/_clearConfig pattern for VS Code settings in unit tests"
  - "CLI health check pattern: fire-and-forget execFile with context key for menu gating"

requirements-completed: [REMOTE-01, REMOTE-02]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 7 Plan 1: Resource Limits and CLI Health Check Summary

**Three VS Code resource-scoped settings replacing Memento-based worktreeLimit, with per-repo/global agent limit enforcement and Claude CLI availability check**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T09:49:00Z
- **Completed:** 2026-03-04T09:54:24Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Migrated resource limits from Memento to VS Code configuration settings with resource scope for per-remote overrides
- Added AgentLimitError with per-repo and global limit checks in AgentService.createAgent
- Added Claude CLI health check on activation with context-key-based menu disablement
- Enhanced vscode test mock with configurable settings store (_setConfigValue/_clearConfig)

## Task Commits

Each task was committed atomically:

1. **Task 1: VS Code settings, model migration, and WorktreeService settings integration** - `03d9410` (feat)
2. **Task 2: Agent limit checks in createAgent and Claude CLI health check on activation** - `83ceb73` (feat)

_Note: TDD tasks with RED+GREEN phases committed as single feat commits after GREEN passes_

## Files Created/Modified
- `package.json` - Added contributes.configuration with three resource-scoped settings; added claudeAvailable when clauses
- `src/models/repo.ts` - Removed worktreeLimit field and DEFAULT_WORKTREE_LIMIT constant
- `src/services/repo-config.service.ts` - Removed DEFAULT_WORKTREE_LIMIT import and usage in addRepo
- `src/services/worktree.service.ts` - Changed import from type-only to regular; reads limit from getConfiguration
- `src/services/agent.service.ts` - Added AgentLimitError class and per-repo/global limit checks in createAgent
- `src/extension.ts` - Added Claude CLI health check with execFile and context key setting
- `test/__mocks__/vscode.ts` - Added _setConfigValue/_clearConfig and configurable getConfiguration mock; added env.remoteName
- `test/unit/repo-config.service.test.ts` - Removed worktreeLimit from all test fixtures
- `test/unit/worktree.service.test.ts` - Migrated to settings-based limit tests
- `test/unit/agent.service.test.ts` - Added 4 agent limit enforcement tests
- `test/unit/agent.commands.test.ts` - Removed worktreeLimit from mock configs
- `test/unit/diff.commands.test.ts` - Removed worktreeLimit from mock config
- `test/unit/diff.service.test.ts` - Removed worktreeLimit from mock config

## Decisions Made
- Used resource scope for all three settings (enables per-remote-host overrides via VS Code settings sync)
- Changed vscode import in WorktreeService from type-only to regular import for runtime getConfiguration access
- AgentLimitError carries limitType discriminant and existingAgents array for command layer error messaging
- Used `!= false` (not `== true`) in when clauses so Create Agent buttons remain visible before health check completes

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VS Code settings infrastructure ready for remote host configuration overrides
- Claude CLI health check ensures graceful degradation on remote machines without claude CLI
- AgentLimitError ready for command layer to catch and display user-friendly messages
- Ready for Plan 07-02 (connection-aware features, performance at scale)

---
*Phase: 07-remote-support-and-performance-at-scale*
*Completed: 2026-03-04*
