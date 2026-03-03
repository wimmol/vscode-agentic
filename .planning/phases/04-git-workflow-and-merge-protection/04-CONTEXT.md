# Phase 4: Git Workflow and Merge Protection - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Diff review via VS Code's native diff editor, PR creation from agent branch to staging branch via `gh` CLI, and merge protection that blocks deleting agents with unmerged work. Actual git merge operations, CI integration, and GitHub API integration are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Diff review experience
- Trigger: both inline button on agent tile AND context menu "Review Changes" — consistent with existing pattern (trash icon + Delete Agent)
- Diff scope: multi-file changed files list (like VS Code's SCM view) — user clicks individual files for per-file diffs
- Diff detection: auto-detect on agent status change (finished, error, etc.) — merge/review button appears/disappears automatically
- Button appears on ALL agents with diffs vs staging, not just finished ones — user may want to review in-progress work

### PR creation flow
- Shell out to `gh pr create --base staging --head agent-branch` in a terminal
- Leverages user's existing `gh` auth — no OAuth or GitHub API integration needed
- Show confirmation summary before creating: base branch, head branch, number of changed files, confirm button
- Show PR URL on success via VS Code information message

### Merge button behavior
- The merge/review button opens the diff review (changed files list) — NOT direct PR creation
- PR creation is a separate action available after reviewing diffs (separate button or command)
- Two-step workflow: review changes first, then create PR if satisfied
- Button visibility driven by diff detection on status changes

### Deletion protection
- Hard block: user CANNOT delete an agent with unmerged changes — no force-delete option
- Error message: "Agent has unmerged changes vs staging. Review changes or create a PR first."
- Offer actionable buttons: "Review Changes" / "Cancel" — guides user to the right action
- Both `deleteAgent` (command palette) and `deleteAgentFromTile` (sidebar) enforce the same guard

### Claude's Discretion
- Exact git diff commands for change detection (diff --stat, rev-list, merge-base)
- How changed files list is presented (QuickPick, custom webview, or SCM-like panel)
- Diff detection debouncing/caching strategy
- `gh` CLI error handling (not installed, not authenticated)
- PR title/body auto-generation from agent name and prompt

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GitService.exec()`: async git command runner — can run `git diff`, `git log`, `git merge-base` for change detection
- `GitService.branchExists()`: verify staging branch exists before diff operations
- `RepoConfigService.getForRepo()`: get `stagingBranch` name for diff base — `RepoConfig.stagingBranch` field
- `AgentService.deleteAgent()`: current deletion flow to wrap with merge guard
- `AgentService.onDidChangeAgents`: EventEmitter that fires on status changes — can trigger diff detection
- `AgentTreeItem.contextValue = "agentItem"`: used for menu filtering in package.json — can add conditional contextValue for "has diffs"
- `sidebar.commands.ts`: existing pattern for registering tile commands — new review/PR commands follow same pattern
- `package.json menus`: existing `view/item/context` and inline action patterns from Phase 3

### Established Patterns
- Constructor injection: new DiffService or MergeProtectionService wired in `extension.ts activate()`
- Compound key `repoPath::agentName` for mapping (used by TerminalService)
- Confirmation dialogs via `vscode.window.showWarningMessage` with modal option (used in deleteAgentFromTile)
- TreeView auto-refresh via `onDidChangeAgents` event with 150ms debounce

### Integration Points
- `extension.ts activate()`: new services instantiated, new commands registered
- `AgentTreeItem`: needs conditional contextValue to show/hide merge button based on diff status
- `sidebar.commands.ts` or new `merge.commands.ts`: review and PR creation command handlers
- `package.json`: new commands, menu contributions for review button and PR creation
- `vscode.commands.executeCommand("vscode.diff", ...)`: VS Code built-in diff editor command
- `vscode.window.createTerminal()`: for running `gh pr create` (or exec for capture)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-git-workflow-and-merge-protection*
*Context gathered: 2026-03-04*
