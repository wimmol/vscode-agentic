---
phase: 04-git-workflow-and-merge-protection
plan: 01
subsystem: git
tags: [git-diff, three-dot-notation, TextDocumentContentProvider, vscode-uri, content-provider]

# Dependency graph
requires:
  - phase: 01-foundation-and-git-infrastructure
    provides: GitService.exec() for running git commands, RepoConfigService.getForRepo() for staging branch lookup
provides:
  - DiffService with hasUnmergedChanges and getChangedFiles methods
  - GitContentProvider with agentic-git URI scheme for VS Code diff editor
affects: [04-02-PLAN, merge-protection, diff-review, PR-creation, agent-deletion-guard]

# Tech tracking
tech-stack:
  added: []
  patterns: [TextDocumentContentProvider for virtual document URIs, three-dot git diff notation for merge-base-relative comparison, graceful degradation returning safe defaults on git errors]

key-files:
  created:
    - src/services/diff.service.ts
    - src/providers/git-content.provider.ts
    - test/unit/diff.service.test.ts
    - test/unit/git-content.provider.test.ts
  modified:
    - test/__mocks__/vscode.ts

key-decisions:
  - "Enhanced vscode mock Uri.parse to properly parse URI strings with scheme, query, path -- needed for GitContentProvider roundtrip tests"
  - "GitContentProvider uses URLSearchParams for query parsing and encodeURIComponent for building -- handles special chars in paths"

patterns-established:
  - "TextDocumentContentProvider pattern: custom URI scheme (agentic-git) with query params for repo/ref/path"
  - "DiffService pattern: graceful degradation returning false/[] on any error (missing config, missing branch, git failure)"
  - "Three-dot diff notation: staging...agentBranch for merge-base-relative comparison"

requirements-completed: [GIT-03, AGENT-04, UI-05]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 4 Plan 1: Diff Infrastructure Summary

**DiffService for git three-dot diff detection and GitContentProvider for serving file content at arbitrary git refs via agentic-git URI scheme**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T07:34:44Z
- **Completed:** 2026-03-04T07:37:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- DiffService detects unmerged changes and lists changed files between staging and agent branches using three-dot diff notation
- GitContentProvider serves file content at specific git refs via custom agentic-git URI scheme for VS Code's native diff editor
- Full test coverage with 17 new unit tests (11 DiffService + 6 GitContentProvider), full suite 217 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: DiffService with git diff detection and changed file listing** - `6dd5e53` (feat)
2. **Task 2: GitContentProvider for serving file content at git refs** - `3fa3914` (feat)

_Note: TDD tasks combined RED+GREEN into single commits since both were created new_

## Files Created/Modified
- `src/services/diff.service.ts` - DiffService with hasUnmergedChanges and getChangedFiles methods
- `src/providers/git-content.provider.ts` - TextDocumentContentProvider for file content at git refs via agentic-git scheme
- `test/unit/diff.service.test.ts` - 11 unit tests covering no config, no staging, empty diff, non-empty diff, error cases
- `test/unit/git-content.provider.test.ts` - 6 unit tests covering git show, URI parsing, error handling, buildUri roundtrip
- `test/__mocks__/vscode.ts` - Enhanced Uri.parse mock to properly parse URI strings

## Decisions Made
- Enhanced vscode mock Uri.parse to properly parse URI strings with scheme/query/path fields, needed for GitContentProvider buildUri/roundtrip tests
- GitContentProvider uses URLSearchParams for query parsing and encodeURIComponent for building, handling paths with spaces and special characters per research pitfall #6

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enhanced vscode mock Uri.parse for proper URI parsing**
- **Found during:** Task 2 (GitContentProvider tests)
- **Issue:** Existing Uri.parse mock returned `{ fsPath: str, scheme: "file" }` which broke buildUri tests needing proper scheme, query, and path extraction
- **Fix:** Replaced naive mock with URL-based parser that extracts scheme, authority, path, query, and fragment from URI strings
- **Files modified:** test/__mocks__/vscode.ts
- **Verification:** All 217 tests pass including 6 new GitContentProvider tests
- **Committed in:** 3fa3914 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Mock enhancement necessary for testing. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DiffService and GitContentProvider are ready for Plan 02 consumption
- Plan 02 can wire these into commands (reviewChanges, createPR), merge guard on delete, and conditional contextValue on AgentTreeItem
- All tests green, no type errors

## Self-Check: PASSED

- All 4 created files verified on disk
- Both task commits (6dd5e53, 3fa3914) verified in git log
- Test line counts: diff.service.test.ts=168 (min 60), git-content.provider.test.ts=105 (min 30)
- Full test suite: 217 tests passing across 16 files
- Type check: clean (npx tsc --noEmit)

---
*Phase: 04-git-workflow-and-merge-protection*
*Completed: 2026-03-04*
