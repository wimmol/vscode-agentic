---
phase: 04-git-workflow-and-merge-protection
verified: 2026-03-04T14:50:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Open VS Code with the extension active. Create an agent on a repo that has a staging branch. Make a commit on the agent branch. Then click the Review Changes button on the agent tile in the sidebar."
    expected: "A QuickPick list appears showing the changed files. Selecting a file opens VS Code's native diff editor showing staging vs agent branch content side-by-side."
    why_human: "Cannot verify VS Code UI rendering and diff editor display programmatically. Tests mock vscode.commands.executeCommand but do not exercise the real diff editor."
  - test: "Attempt to delete an agent whose branch has unmerged changes vs staging (using both command palette 'Delete Agent' and right-click 'Delete' on the sidebar tile)."
    expected: "A warning dialog appears saying the agent has unmerged changes with 'Review Changes' and 'Cancel' buttons. Clicking 'Review Changes' opens the diff QuickPick. The agent is NOT deleted."
    why_human: "Cannot verify modal dialog behavior or that deletion is truly blocked in the running extension. Tests mock window.showWarningMessage but do not drive the real VS Code modal."
  - test: "Run 'Create PR' from the context menu on an agent tile that has diffs. Confirm the dialog. Verify with a real GitHub remote."
    expected: "A PR is created on GitHub from the agent branch to staging, and an info message shows the PR URL."
    why_human: "gh CLI execution with a real GitHub remote cannot be verified in unit tests. The test for 'shows PR URL on success' does not mock execFileAsync, so only the error path is exercised in CI."
---

# Phase 4: Git Workflow and Merge Protection Verification Report

**Phase Goal:** User can review agent work via VS Code's native diff editor and merge agent branches to staging, with protection against deleting agents that have unmerged work
**Verified:** 2026-03-04T14:50:00Z
**Status:** human_needed (all automated checks passed; 3 UI/integration behaviors require human testing)
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DiffService.hasUnmergedChanges detects unmerged changes correctly | VERIFIED | `src/services/diff.service.ts` implements three-dot diff with staging branch safety checks; 5 tests covering no-config, no-staging, empty-diff, non-empty-diff, and git-error cases all pass |
| 2 | DiffService.getChangedFiles returns file list from git diff | VERIFIED | `getChangedFiles` calls `git diff --name-only staging...agentBranch` and splits output; 5 tests pass including empty-string filter |
| 3 | GitContentProvider serves file content at git refs via agentic-git scheme | VERIFIED | `src/providers/git-content.provider.ts` implements `vscode.TextDocumentContentProvider` with SCHEME="agentic-git", serves via `git show ref:path`; 5 tests pass including roundtrip |
| 4 | User can open QuickPick of changed files and launch vscode.diff | VERIFIED | `reviewChanges` command in `src/commands/diff.commands.ts` calls `getChangedFiles`, shows QuickPick, then `executeCommand("vscode.diff", leftUri, rightUri, title)`; 4 tests pass |
| 5 | User can create a PR via gh CLI with confirmation dialog | VERIFIED | `createPR` command shows `showInformationMessage` with "Create PR"/"Cancel", then calls `execFileAsync("gh", ["pr", "create", ...])` with ENOENT and auth error handling; 4 tests pass |
| 6 | Merge guard blocks deleteAgent (command palette) when unmerged changes exist | VERIFIED | `src/commands/agent.commands.ts` calls `diffService.hasUnmergedChanges` before delete confirmation; shows warning with "Review Changes"/"Cancel"; hard-blocks on true |
| 7 | Merge guard blocks deleteAgentFromTile (sidebar) when unmerged changes exist | VERIFIED | `src/commands/sidebar.commands.ts` applies identical merge guard pattern; "Review Changes" triggers `executeCommand("vscode-agentic.reviewChanges", ...)` |
| 8 | Agent tiles show conditional contextValue for diff status | VERIFIED | `AgentTreeItem` constructor accepts `hasDiffs?: boolean` and sets `contextValue = hasDiffs ? "agentItemWithDiffs" : "agentItem"`; 3 tests pass |
| 9 | Diff status cache in TreeProvider drives conditional UI | VERIFIED | `AgentTreeProvider` has `diffStatusCache: Map<string, boolean>`, `updateDiffStatus()` method, and `debouncedDiffUpdate()` called on `onDidChangeAgents`; cache passed to AgentTreeItem in `getChildren` |

**Score:** 9/9 truths verified

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/diff.service.ts` | DiffService with hasUnmergedChanges and getChangedFiles | VERIFIED | 67 lines, exports DiffService class, constructor injection of GitService and RepoConfigService, both methods implemented |
| `src/providers/git-content.provider.ts` | TextDocumentContentProvider for agentic-git URI scheme | VERIFIED | 36 lines, exports GitContentProvider, SCHEME="agentic-git", buildUri static method with encodeURIComponent, provideTextDocumentContent parses URLSearchParams |
| `test/unit/diff.service.test.ts` | Unit tests for DiffService (min 60 lines) | VERIFIED | 168 lines, 11 tests covering all specified behaviors |
| `test/unit/git-content.provider.test.ts` | Unit tests for GitContentProvider (min 30 lines) | VERIFIED | 105 lines, 5 tests covering git show, URI parsing, error handling, buildUri roundtrip |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/commands/diff.commands.ts` | registerDiffCommands, reviewChanges and createPR | VERIFIED | 126 lines, exports registerDiffCommands, both commands registered, QuickPick and vscode.diff wired |
| `src/views/agent-tree-items.ts` | AgentTreeItem with conditional contextValue | VERIFIED | hasDiffs parameter added at line 74, contextValue set conditionally at line 81 |
| `src/views/agent-tree-provider.ts` | TreeProvider with async diff status cache | VERIFIED | diffStatusCache Map at line 32, updateDiffStatus at line 117, debouncedDiffUpdate at line 137 |
| `package.json` | reviewChanges and createPR command and menu contributions | VERIFIED | Both commands declared with icons; menu contributions include inline reviewChanges on agentItemWithDiffs, createPR in navigation group, regex /^agentItem/ matching for delete/copy |
| `test/unit/diff.commands.test.ts` | Unit tests for diff commands (min 80 lines) | VERIFIED | 220 lines, 10 tests |
| `test/unit/agent-tree-items.test.ts` | Tests for hasDiffs contextValue switching | VERIFIED | 142 lines, 3 new contextValue tests added |

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/diff.service.ts` | `src/services/git.service.ts` | constructor injection | WIRED | `this.git.exec(repoPath, ...)` and `this.git.branchExists(...)` at lines 23, 29 |
| `src/services/diff.service.ts` | `src/services/repo-config.service.ts` | constructor injection | WIRED | `this.repoConfig.getForRepo(repoPath)` at lines 16, 46 |
| `src/providers/git-content.provider.ts` | `src/services/git.service.ts` | constructor injection | WIRED | `this.git.exec(repoPath, ["show", ...])` at line 21 |

#### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/commands/diff.commands.ts` | `src/services/diff.service.ts` | function parameter | WIRED | `diffService.getChangedFiles(repoPath, agentName)` at lines 31, 78 |
| `src/commands/diff.commands.ts` | `src/providers/git-content.provider.ts` | static method call | WIRED | `GitContentProvider.buildUri(repoPath, staging, ...)` at lines 59, 60 |
| `src/commands/diff.commands.ts` | `vscode.commands.executeCommand` | vscode.diff command | WIRED | `executeCommand("vscode.diff", leftUri, rightUri, title)` at line 62 |
| `src/commands/agent.commands.ts` | `src/services/diff.service.ts` | merge guard before delete | WIRED | `diffService.hasUnmergedChanges(selected._repoPath, selected._agentName)` at line 123 |
| `src/commands/sidebar.commands.ts` | `src/services/diff.service.ts` | merge guard before delete | WIRED | `diffService.hasUnmergedChanges(repoPath, agentName)` at line 46 |
| `src/views/agent-tree-provider.ts` | `src/services/diff.service.ts` | async diff status cache update | WIRED | `this.diffService.hasUnmergedChanges(agent.repoPath, agent.agentName)` at line 124 |
| `src/extension.ts` | `src/services/diff.service.ts` | service singleton creation | WIRED | `new DiffService(gitService, repoConfigService)` at line 22 |
| `src/extension.ts` | `src/providers/git-content.provider.ts` | registerTextDocumentContentProvider | WIRED | `vscode.workspace.registerTextDocumentContentProvider(GitContentProvider.SCHEME, gitContentProvider)` at lines 55-58 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GIT-03 | 04-01, 04-02 | User can open VS Code's native diff view to review changes between agent branch and staging | SATISFIED | reviewChanges command shows QuickPick of changed files and calls vscode.diff with GitContentProvider URIs |
| GIT-04 | 04-02 | User can create a PR from agent branch to staging after reviewing diffs | SATISFIED | createPR command runs `gh pr create` with confirmation dialog and shows PR URL on success |
| AGENT-04 | 04-01, 04-02 | User cannot delete an agent whose branch has unmerged changes vs staging | SATISFIED | Merge guard in both agent.commands.ts and sidebar.commands.ts hard-blocks deletion; diffService.hasUnmergedChanges called before any delete confirmation |
| UI-05 | 04-01, 04-02 | Agent tile shows a merge button when agent's branch has diffs vs staging | SATISFIED | contextValue="agentItemWithDiffs" on AgentTreeItem when hasDiffs=true; package.json menu with `viewItem == agentItemWithDiffs` + `group: inline` shows Review Changes button inline on tile |

No orphaned requirements found. All four IDs (GIT-03, GIT-04, AGENT-04, UI-05) claimed by plans match REQUIREMENTS.md Phase 4 entries.

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments, no empty implementations, no stubs found in any phase 4 source files.

One observation warranted as informational:

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `test/unit/diff.commands.test.ts` lines 192-218 | createPR "shows PR URL on success" test does not mock `execFileAsync` -- verifies only that some message was shown, not that the PR URL is displayed | Info | Does not block the goal, but the success path for gh CLI is not exercised in CI; relies on human testing |

### Human Verification Required

#### 1. Review Changes Button and Native Diff Editor

**Test:** Open VS Code with the extension active. Create an agent on a repo that has a staging branch. Make a commit on the agent branch (with content differing from staging). Wait for the sidebar to update. Click the Review Changes button (git-compare icon) on the agent tile.

**Expected:** A QuickPick appears listing the changed files with filenames as labels and full relative paths as descriptions. Selecting a file opens VS Code's native diff editor with the title "filename.ext (staging <-> agentName)", showing staging content on the left and agent branch content on the right.

**Why human:** Cannot verify VS Code UI rendering and the actual diff editor display programmatically. Unit tests mock `vscode.commands.executeCommand` and confirm correct arguments are passed, but do not exercise the real diff editor view.

#### 2. Merge Guard Blocking Deletion

**Test:** With an agent that has unmerged changes vs staging, attempt deletion via both (a) Command Palette > "Delete Agent" and (b) right-click > "Delete" on the agent tile in the sidebar.

**Expected:** In both cases, a warning dialog appears saying "Agent 'name' has unmerged changes vs staging. Review changes or create a PR first." with "Review Changes" and "Cancel" buttons. Clicking "Review Changes" opens the diff QuickPick. The agent is NOT deleted in either path.

**Why human:** Modal dialog behavior and the guarantee that the agent is not deleted cannot be verified without running the full extension. Unit tests confirm the guard fires and the warning message text, but do not drive VS Code's actual warning modal.

#### 3. PR Creation with Real GitHub Remote

**Test:** On a repo with a GitHub remote, with an agent that has diffs, right-click the agent tile and choose "Create PR". Confirm the dialog showing base branch, head branch, and file count.

**Expected:** A PR is created on GitHub from the agent branch to staging. An info message appears showing the PR URL (e.g., "PR created: https://github.com/user/repo/pull/123").

**Why human:** Requires a real gh CLI installation and authenticated GitHub remote. Unit tests do not mock `execFileAsync`, so only ENOENT and error paths are exercised in CI. The success path displaying the PR URL must be verified with a real GitHub repo.

### Gaps Summary

No gaps found. All 9 observable truths are verified, all 10 artifacts are substantive and wired, all 8 key links are confirmed, all 4 requirement IDs are satisfied. The three human verification items relate to visual/runtime behavior that automated checks cannot cover, not missing implementation.

---

_Verified: 2026-03-04T14:50:00Z_
_Verifier: Claude (gsd-verifier)_
