# Codebase Concerns

**Analysis Date:** 2026-03-04

## Tech Debt

**Empty activationEvents array:**
- Issue: `package.json` has `"activationEvents": []` which causes VS Code to activate the extension on startup (implicit `*` behavior in modern VS Code), blocking the editor launch with reconciliation work.
- Files: `package.json` (line 12)
- Impact: Reconciliation work (worktree scanning, orphan process cleanup, PID registry cleanup) runs synchronously-adjacent to startup before VS Code fully loads. Could add perceivable latency on workspaces with many agents or repos.
- Fix approach: Add `"onStartupFinished"` to `activationEvents` to defer activation until VS Code UI is fully loaded, or use `onView:vscode-agentic.agents` to only activate when the sidebar is first opened.

**Circular dependency resolved via post-construction setter:**
- Issue: `AgentService` and `TerminalService` have a circular dependency; `TerminalService` is set after construction via `setTerminalService()`. This is a temporal coupling -- calling `focusAgent()` or `deleteAgent()` before `setTerminalService()` throws a runtime error.
- Files: `src/services/agent.service.ts` (lines 44–60, 391–398), `src/extension.ts` (line 54)
- Impact: If construction order is ever changed, the extension crashes at runtime. The `requireTerminalService()` guard throws a descriptive error, but this is a runtime check, not a compile-time guarantee.
- Fix approach: Introduce a factory function or builder pattern in `extension.ts` that enforces construction order, or refactor to inject the callback directly into `AgentService` instead of the full `TerminalService` reference.

**Compound key `repoPath::agentName` used as bare string:**
- Issue: Agent and terminal keys are formatted as `${repoPath}::${agentName}` and then parsed by splitting on `::`. If a `repoPath` ever contained `::` (uncommon but not impossible, e.g., mounted WSL paths), the split would produce incorrect results.
- Files: `src/services/terminal.service.ts` (lines 42–44, 185), `src/services/agent.service.ts` (line 374), `src/extension.ts` (line 145)
- Impact: Silent data corruption -- the `repoPath` parsed on terminal close would be wrong, causing the status update to be lost (agent stays "running" forever). Low probability, but no validation exists.
- Fix approach: Use a structured object or a Map keyed by `{repoPath, agentName}` tuple, or encode/validate that neither segment contains `::`.

**`eslint-disable-next-line no-constant-condition` suppressing a lint warning in production code:**
- Issue: The `while (true)` loop for staging branch prompts in `promptForStagingBranch` has a lint suppression comment indicating the code trips the linter.
- Files: `src/services/repo-config.service.ts` (line 137)
- Impact: Minor -- the loop logic is correct but the suppression indicates a smell. The loop could be refactored to avoid needing the suppression.
- Fix approach: Replace `while (true)` with a labeled loop or a recursive helper matching the pattern used in `promptForAgentName` in `src/commands/agent.commands.ts`.

**`DiffService` has no dedicated TTL cache -- per-call git execution is unbounded:**
- Issue: `DiffService.hasUnmergedChanges()` and `getChangedFiles()` each execute a full `git diff` subprocess on every call. The TTL cache exists only in `AgentTreeProvider`, not at the `DiffService` level. Callers outside the tree provider (e.g., `deleteAgent` in commands) receive no caching benefit and incur full git round-trips.
- Files: `src/services/diff.service.ts`, `src/commands/agent.commands.ts` (line 138), `src/commands/sidebar.commands.ts` (line 46)
- Impact: Each "Delete Agent" or "Delete Agent From Tile" command executes two separate `git diff` calls (one for unmerged check, one that gets unchanged result). On slow disks or remote SSH, this adds 100–500ms latency per delete operation.
- Fix approach: Move the TTL cache into `DiffService` itself so all callers benefit, or at minimum batch the calls into one.

## Known Bugs

**`WorkspaceSwitchService.switchToAgent` always treats same-repo as different-repo on first call:**
- Symptoms: On the very first agent tile click after extension activation, `this.activeAgent` is `undefined`, so `isSameRepo` is `false` regardless of which agent is clicked. This causes unnecessary `updateWorkspaceFolders()` and `revealInExplorer` calls even when the user clicks an agent from the same repo as their current workspace.
- Files: `src/services/workspace-switch.service.ts` (lines 41–44)
- Trigger: First click on any agent tile after extension activation.
- Workaround: None -- subsequent clicks work correctly once `activeAgent` is populated.

**`AgentTreeProvider.getParent()` creates a new `RepoGroupItem` instance instead of returning a cached reference:**
- Symptoms: `treeView.reveal()` requires `getParent()` to return a tree item that satisfies `===` equality with the item in the current tree. Returning `new RepoGroupItem(element.repoPath)` creates a new instance on every call, which may cause reveal operations to fail silently or behave unexpectedly.
- Files: `src/views/agent-tree-provider.ts` (lines 97–102), `src/commands/sidebar.commands.ts` (line 31–36), `src/extension.ts` (line 148–155)
- Trigger: Any `treeView.reveal()` call (focusing agent from tile, revealing last-focused on activation).
- Workaround: The `id` property on `RepoGroupItem` is set (`repo:${repoPath}`), which VS Code uses for matching instead of reference equality in most reveal scenarios, so in practice it often works. But it is fragile.

**`handleAgentLimitError` in `agent.commands.ts` retries creation without checking if the suspended agent freed per-repo vs global capacity:**
- Symptoms: If the global limit is reached but agents span multiple repos, suspending the oldest idle agent (which may be in the target repo) may free a per-repo slot but not a global slot if the global count still exceeds the limit. The retry call to `createAgent` will throw again with no further recovery handler.
- Files: `src/commands/agent.commands.ts` (lines 280–313, 94–95)
- Trigger: User hits global agent limit with all agents from different repos, then tries to create another agent and accepts the suspend offer.
- Workaround: None -- the error propagates uncaught out of the command handler and VS Code may show a generic error or swallow it silently.

## Security Considerations

**`createPR` command passes user-supplied `agentName` directly as a `gh` CLI argument:**
- Risk: The `agentName` value originates from user input (validated as a valid git branch name by `isValidBranchName`) but is passed directly as `--head agentName` to `execFileAsync("gh", [...])`. Git branch name validation is stricter than shell injection, but the `gh` CLI processes the arguments, and edge cases around special characters (`$`, backticks) that are valid in branch names could be exploited in unusual environments.
- Files: `src/commands/diff.commands.ts` (lines 98–99)
- Current mitigation: `execFileAsync` uses an args array (not a shell string), so no shell interpolation occurs. The risk is low with `execFileAsync`, but if this ever changes to `exec()` with template strings, it becomes critical.
- Recommendations: Document that `execFileAsync` is used intentionally for security; add a code comment. Consider validating `agentName` against the stricter requirements of branch names before the `gh` call.

**`GitContentProvider` passes `ref` and `filePath` query parameters directly to `git show`:**
- Risk: The `ref` and `filePath` params in the `agentic-git:` URI scheme are deserialized from the URI query string and passed to `git.exec(repoPath, ["show", "${ref}:${filePath}"])`. If a malformed URI is somehow constructed with a `ref` like `HEAD; rm -rf /`, it becomes an argument to `execFileAsync('git', ...)`. Since it is in an args array, shell injection is not possible, but unexpected `ref` values could cause git to execute unintended refs.
- Files: `src/providers/git-content.provider.ts` (line 21), `src/commands/diff.commands.ts` (lines 59–60)
- Current mitigation: URIs are built internally by `GitContentProvider.buildUri()` with `encodeURIComponent`, not from external input. Risk is low.
- Recommendations: Add a validation step in `provideTextDocumentContent` to ensure `ref` matches a simple branch/SHA pattern before passing to git.

## Performance Bottlenecks

**Full tree refresh triggered on every agent status change:**
- Problem: `AgentService.onDidChangeAgents` fires after every `updateStatus()`, `createAgent()`, `deleteAgent()`, `suspendAgent()`, `focusAgent()`, and `reconcileOnActivation()` call. Every fire triggers `AgentTreeProvider.debouncedRefresh()` (150ms debounce) AND `AgentTreeProvider.debouncedDiffUpdate()` (300ms debounce) which iterates all agents and runs git diff for each.
- Files: `src/views/agent-tree-provider.ts` (lines 40–43, 141–149), `src/services/agent.service.ts` (lines 111, 154, 204, 259, 284, 339)
- Cause: Every status change fires a full-tree `onDidChangeTreeData` fire and triggers batch diff update for all agents. With 10 agents, activation reconciliation fires the diff update 10 times (once per agent per `updateDiffStatusForAgent`), each spawning a `git diff` subprocess.
- Improvement path: Pass the specific changed agent key into the event payload (`onDidChangeAgents` fires `void`; change to fire `string` key or `AgentEntry`). Use targeted `_onDidChangeTreeData.fire(specificItem)` instead of `fire()` for single-agent updates. The TTL cache mitigates repeat calls but the initial burst on activation is not throttled.

**`updateDiffStatus()` sequentially awaits each agent's diff check:**
- Problem: `AgentTreeProvider.updateDiffStatus()` iterates all agents with `for...of` and `await`s each `updateDiffStatusForAgent()` call sequentially.
- Files: `src/views/agent-tree-provider.ts` (lines 124–130)
- Cause: Sequential git subprocess spawning means N agents = N sequential 30ms-500ms git calls. With 10 agents and 100ms git round-trip each, the initial activation diff update takes ~1 second and blocks sidebar rendering.
- Improvement path: Use `Promise.all()` to run diff checks in parallel (all agents diff checks can run concurrently since they use different branches). Cap concurrency with a semaphore if needed.

**`reconcileOnActivation` calls `worktreeService.getManifest()` once per agent in a loop:**
- Problem: `getManifest()` reads from `state.get()` and filters the full manifest array on every invocation. With N agents, this is O(N²) in manifest read + filter operations.
- Files: `src/services/agent.service.ts` (lines 305–313)
- Cause: No caching of manifest per repo during the reconcile loop. Each iteration reads the full persisted manifest array and filters it.
- Improvement path: Cache manifest per `repoPath` in a local Map before the loop. This is a micro-optimization at current scale (< 20 agents) but worth fixing before the 10-agent default limit is commonly reached.

## Fragile Areas

**`TerminalService.handleTerminalClose` depends on the order of Map deletion vs dispose:**
- Files: `src/services/terminal.service.ts` (lines 100–108, 180–197)
- Why fragile: The `disposeTerminal()` method deliberately deletes the map entry BEFORE calling `terminal.dispose()` to prevent the close handler from firing a spurious status change. This ordering is load-bearing -- reversing it causes a race where the close event fires before the map entry is removed, triggering a double status update. This is documented in a comment but is not enforced by any mechanism.
- Safe modification: Never reorder the `this.terminals.delete(key)` and `terminal.dispose()` calls. Any refactoring that extracts cleanup logic must preserve this ordering.
- Test coverage: Covered by `test/unit/terminal.service.test.ts` ("prevents close handler from firing onStatusChange after dispose").

**`WorktreeService.withLock` resolve! non-null assertion on uninitialized variable:**
- Files: `src/services/worktree.service.ts` (lines 42–59)
- Why fragile: The per-repo mutex uses `let resolve!: () => void` with a TypeScript non-null assertion on a variable that is assigned inside a `new Promise()` constructor callback. This pattern is safe as long as the Promise constructor calls the executor synchronously (it does), but it relies on implicit execution ordering. If a linting rule or TS upgrade flags this, the fix could introduce a bug if done incorrectly.
- Safe modification: The pattern is correct as-is; do not "fix" the `!` assertion by initializing `resolve` to a noop — that would break the mutex entirely.
- Test coverage: Covered by concurrent operation tests in `test/unit/worktree.service.test.ts`.

**`AgentService.reconcileOnActivation` uses splice with decreasing indices to remove orphans:**
- Files: `src/services/agent.service.ts` (lines 318–324)
- Why fragile: Orphaned registry entries are removed by collecting their indices into a Set, sorting descending, then splicing. If the Set-to-array sorting is ever accidentally changed to ascending, splicing from the front invalidates subsequent indices, silently deleting the wrong agents.
- Safe modification: The sort `(a, b) => b - a` (descending) is critical. Add a comment documenting why descending order is required.
- Test coverage: Covered by reconcile tests in `test/unit/agent.service.test.ts`.

**`DiffService.getChangedFiles()` and `hasUnmergedChanges()` duplicate the same git diff invocation pattern:**
- Files: `src/services/diff.service.ts` (lines 15–37, 45–66)
- Why fragile: Both methods independently fetch staging branch config, check branch existence, and run `git diff --name-only`. If the diff strategy changes (e.g., switching from three-dot to two-dot diff), both methods must be updated in sync. A divergence would cause the sidebar diff badge and the delete merge guard to show inconsistent results.
- Safe modification: Extract a private `_getDiffOutput(repoPath, agentBranch)` helper that both methods delegate to.
- Test coverage: Both are independently tested in `test/unit/diff.service.test.ts`.

## Scaling Limits

**Agent registry stored as a flat array in a single Memento key:**
- Current capacity: All agents across all repos stored in one `workspaceState` key as a JSON array.
- Limit: VS Code Memento does not document a size limit, but `workspaceState` is stored in SQLite. In practice, 50+ agents with large `initialPrompt` strings could push the serialized JSON to several KB, causing perceptible lag on every registry read/write.
- Scaling path: Shard the registry per-repo, or store only agent metadata references and keep large fields (like `initialPrompt`) in separate keys.

**PID registry grows unbounded until explicit cleanup:**
- Current capacity: PID map is a flat `Record<string, number>` in a single Memento key. PIDs are added on terminal creation and removed on terminal dispose or agent delete.
- Limit: If terminals are created and VS Code crashes (skipping disposal), PID entries accumulate indefinitely until `cleanupOrphanProcesses` is called on the next activation. With many agents over time, this map grows.
- Scaling path: `cleanupOrphanProcesses` already clears the full map after cleanup. This is handled correctly; the concern is low-priority.

**No limit on `updateWorkspaceFolders` calls across agent switches:**
- Current capacity: `WorkspaceSwitchService.switchToAgent()` calls `updateWorkspaceFolders()` whenever the new agent's `repoPath` differs from `activeAgent.repoPath`.
- Limit: Calling `updateWorkspaceFolders()` repeatedly (on rapid cross-repo switches) can cause VS Code to restart the extension host, losing in-memory state. The `activeAgent` guard prevents same-repo redundant calls but cross-repo rapid switching has no debounce.
- Scaling path: Add a debounce or guard to prevent `updateWorkspaceFolders` from being called more than once per second.

## Dependencies at Risk

**`gh` CLI dependency is implicit and untested at startup:**
- Risk: The `createPR` command depends on `gh` (GitHub CLI) being installed and authenticated. There is no health check at activation (unlike the `claude` and `git` health checks in `extension.ts`). The `createPR` command only fails when invoked with an `ENOENT` error message shown to the user.
- Impact: Poor UX -- the Create PR button in the sidebar context menu is always visible, but fails at use time if `gh` is not available.
- Migration plan: Add a `gh --version` health check at activation (similar to the `claude --version` check in `src/extension.ts` lines 95–105), and set a `vscode-agentic.ghAvailable` context variable to conditionally show the Create PR menu item.

## Missing Critical Features

**No mechanism to detect if `claude` CLI is still running inside a "running" terminal:**
- Problem: Once a terminal is marked `running`, there is no polling or process-level check to detect if Claude Code has exited without firing a clean terminal close event (e.g., terminal crash, OOM kill on the Claude process). The agent stays in `running` status indefinitely until the terminal close event fires normally.
- Blocks: Reliable status display; users see agents as "running" when Claude has died.
- Note: This is a fundamental VS Code terminal API limitation (terminal output cannot be read; see `PITFALLS.md` Pitfall 1). The current architecture with `isTransient: true` and close-event-based status is the correct approach given the constraint, but the limitation should be documented.

**No cleanup command for workspace folders added by `switchToAgent`:**
- Problem: `WorkspaceSwitchService.switchToAgent()` adds worktree paths to the VS Code workspace via `updateWorkspaceFolders()` but never removes them. Over time, deleted agents leave stale workspace folders that cause VS Code to show "folder not found" errors or empty explorer entries.
- Blocks: Clean UX after agent deletion.
- Fix approach: On `deleteAgent`, call `updateWorkspaceFolders` to remove any workspace folder matching the deleted agent's worktree path.

## Test Coverage Gaps

**Integration test suite is essentially empty:**
- What's not tested: The `test/integration/extension.test.ts` file contains a single placeholder test that only checks the extension activates. No end-to-end flows (create agent, focus, delete, reconcile on activation) are exercised against a real VS Code instance.
- Files: `test/integration/extension.test.ts`
- Risk: Wiring bugs in `extension.ts` (service construction order, subscription registration, reconciliation flow) would not be caught by tests. The 303 unit tests mock all VS Code APIs and do not test the real activation path.
- Priority: Medium -- unit tests cover all service logic thoroughly. Integration gap only affects activation wiring and real VS Code API interactions.

**`WorkspaceSwitchService` tests do not cover the `updateWorkspaceFolders` path:**
- What's not tested: `switchToAgent()` cross-repo path that calls `vscode.workspace.updateWorkspaceFolders()`, `workbench.view.explorer`, and `revealInExplorer`. All 8 tests in `test/unit/workspace-switch.service.test.ts` mock these calls but only verify `focusAgent` and `switchToAgent` happy paths.
- Files: `test/unit/workspace-switch.service.test.ts`, `src/services/workspace-switch.service.ts`
- Risk: Regressions in workspace folder manipulation (e.g., double-add, incorrect index to `updateWorkspaceFolders`) would not be caught.
- Priority: Low -- the logic is simple and the VS Code API behavior is well-tested by the platform itself.

**No test coverage for the `extension.ts` activation / reconciliation sequence:**
- What's not tested: The async IIFE in `extension.ts` (lines 108–166) that runs the 5-step reconciliation sequence on activation. No test verifies that worktree reconciliation, agent reconciliation, orphan process cleanup, diff cache warm-up, and last-focused reveal happen in the correct order or handle errors correctly.
- Files: `src/extension.ts`
- Risk: A future refactor of the activation sequence (e.g., reordering steps, adding a new step) could silently break reconciliation without any test failure.
- Priority: Medium -- the individual steps are unit-tested; only the orchestration ordering is uncovered.

---

*Concerns audit: 2026-03-04*
