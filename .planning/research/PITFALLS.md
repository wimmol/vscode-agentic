# Domain Pitfalls

**Domain:** VS Code extension -- multi-repo multi-agent workspace manager with terminal management, git worktree isolation, process lifecycle management, and custom panel layouts
**Researched:** 2026-03-04

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architecture failures.

---

### Pitfall 1: Terminal Output Is Opaque -- You Cannot Read What the CLI Prints

**What goes wrong:** Developers assume they can use `terminal.sendText()` to run a command and then read stdout/stderr back from the terminal. The VS Code terminal API provides **no mechanism to capture terminal output**. The API literally just sends text to a shell -- it has no concept of "commands" or "output." This is by design and will not change (closed as "as-designed" by VS Code maintainers).

**Why it happens:** The mental model of "create terminal, run command, read output" seems natural but does not match the VS Code terminal architecture. The terminal is a visual component, not a process management API.

**Consequences:** If agent health monitoring, session status detection, or output parsing depends on reading terminal text, the entire monitoring architecture fails. You cannot detect if Claude Code has finished a task, errored, or is waiting for input by reading terminal output.

**Prevention:**
- Use `child_process.spawn()` or `child_process.exec()` for any process where you need to read stdout/stderr. Manage the Claude Code CLI as a child process, not just a terminal visual.
- Use the terminal purely as a **display layer** -- pipe child_process output into a Pseudoterminal (`ExtensionTerminalOptions` with `pty`) for visual rendering.
- Design the architecture with two layers: (1) process management via Node.js child_process, (2) visual terminal via Pseudoterminal that renders the process output.

**Detection (warning signs):**
- Any design document that says "read terminal output" or "parse terminal buffer"
- Using `terminal.sendText()` as the primary way to interact with Claude Code
- No `child_process` usage in the process management layer

**Confidence:** HIGH -- Confirmed via [VS Code issue #59384](https://github.com/microsoft/vscode/issues/59384), closed as by-design.

**Phase relevance:** Phase 1 (core terminal/process architecture). Getting this wrong means rewriting the entire agent session management layer.

---

### Pitfall 2: Orphan Processes Survive Extension Shutdown

**What goes wrong:** When VS Code closes, the renderer process goes down **immediately**. The extension host becomes orphaned and gets only ~4-5 seconds to clean up before forcible termination. Terminal processes spawned by extensions are killed before extensions can properly shut them down. If Claude Code sessions are running as child processes, they can become zombies that persist after VS Code exits, consuming RAM and CPU indefinitely.

**Why it happens:** VS Code intentionally prioritizes instant shutdown. The `deactivate()` function can return a Promise, but it has a hard 4-second deadline. Complex cleanup (killing process trees, saving state, cleaning up worktrees) often cannot complete in time. Additionally, `child_proc.kill()` only kills the direct child -- not the entire process tree (e.g., `node` -> `claude` creates a chain where killing `node` orphans `claude`).

**Consequences:** Users accumulate zombie Claude Code processes consuming system resources. With 2-5 agents per repo across multiple repos, this can mean 10+ orphan processes after each VS Code restart. On remote SSH hosts, this is even worse -- processes persist on the server with no local visibility.

**Prevention:**
- Use process groups: spawn child processes with `detached: false` and track process group IDs
- Implement tree-kill: use a library like `tree-kill` that kills the entire process tree, not just the parent
- Write a PID file on disk for each agent session; on activation, check for stale PIDs from previous sessions and clean them up
- Use `ExtensionTerminalOptions` (Pseudoterminal) -- processes spawned on the extension host have better lifecycle control than renderer-spawned terminals
- Implement a "cleanup on activation" pattern: when the extension activates, scan for and kill orphan processes from previous sessions
- Use `spawnSync` for the final kill operations in `deactivate()` to ensure they complete within the 4-second window

**Detection (warning signs):**
- `ps aux | grep claude` shows processes after VS Code is closed
- RAM usage climbs over time across VS Code restarts
- Users report "VS Code is slow" after extended use

**Confidence:** HIGH -- Confirmed via [VS Code issue #105484](https://github.com/microsoft/vscode/issues/105484) and [issue #11895](https://github.com/microsoft/vscode/issues/11895).

**Phase relevance:** Phase 1-2 (process management). Must be designed from the start -- retrofitting process lifecycle is extremely difficult.

---

### Pitfall 3: Worktree Explosion Without Cleanup

**What goes wrong:** Automated worktree creation without proper cleanup leads to disk space exhaustion and degraded git performance. The VS Code Copilot background agent incident created **1,526 worktrees in 16 hours**, consuming ~800 GB of disk space with 1,693 orphaned branches. Each worktree is a full working copy of the repository.

**Why it happens:** Retry loops, error recovery that creates new worktrees instead of reusing failed ones, and missing cleanup on agent deletion/failure. For large repositories (common in enterprise), each worktree can be hundreds of MB.

**Consequences:**
- Disk space exhaustion (each worktree = full working copy minus shared objects)
- Git operations slow dramatically with thousands of worktrees/branches
- `git worktree list`, `git branch`, and other commands become unusable
- On remote SSH hosts, disk quotas may be exceeded, breaking the entire remote session

**Prevention:**
- Implement hard limits: maximum worktrees per repo (e.g., 10), refuse to create more
- Track all created worktrees in extension state (`globalState` or a manifest file)
- On every activation, reconcile: compare tracked worktrees against `git worktree list` output, clean stale ones
- Implement `git worktree prune` as a periodic maintenance operation
- Never create worktrees in retry/error loops -- reuse the existing worktree on retry
- Add a "cleanup all" command that users can run manually
- Log worktree creation/deletion events for debugging

**Detection (warning signs):**
- `git worktree list` shows worktrees that don't correspond to active agents
- Disk usage growing unexpectedly
- Git operations getting progressively slower

**Confidence:** HIGH -- Confirmed via [VS Code issue #296194](https://github.com/microsoft/vscode/issues/296194) (real incident with Copilot agent).

**Phase relevance:** Phase 1 (worktree management). Must include cleanup from day one -- technical debt here compounds rapidly.

---

### Pitfall 4: The retainContextWhenHidden Memory Trap

**What goes wrong:** The agent tile sidebar and any webview-based panels use `retainContextWhenHidden: true` to preserve state when the user switches views. Each retained webview keeps its entire DOM, JavaScript heap, and iframe alive in memory. With multiple agent panels, this silently consumes gigabytes of RAM.

**Why it happens:** Without `retainContextWhenHidden`, webviews are destroyed and recreated when toggled, losing all state (scroll position, input text, rendered output). Developers enable it as a quick fix without understanding the memory cost. The Claude Code extension itself had a reported [11.6 GB memory leak per conversation window](https://github.com/anthropics/claude-code/issues/21182).

**Consequences:** With 5-10 agent panels retained in memory, each potentially holding large terminal output histories, memory usage can reach 10+ GB. VS Code becomes unresponsive. On machines running Claude Code agents (which themselves consume significant memory), this pushes systems to swap.

**Prevention:**
- Use `getState()` / `setState()` for webview state persistence instead of `retainContextWhenHidden` -- this has "much lower performance overhead" per official VS Code docs
- Implement a virtual rendering strategy: only render the active agent's full UI, serialize others to lightweight state
- Set scrollback limits on terminal output displayed in webviews (e.g., last 500 lines visible, full history on disk)
- Implement webview pooling: reuse a single webview instance, swap content when switching agents
- Profile memory regularly during development with VS Code's Process Explorer

**Detection (warning signs):**
- `retainContextWhenHidden: true` appears in webview creation code
- Memory usage in Process Explorer climbs with each new agent panel
- No explicit state serialization/deserialization code exists

**Confidence:** HIGH -- Confirmed via [VS Code webview docs](https://code.visualstudio.com/api/extension-guides/webview) and [Claude Code memory leak issue #21182](https://github.com/anthropics/claude-code/issues/21182).

**Phase relevance:** Phase 2 (UI/panel implementation). Architecture decision needed before building any webview panels.

---

### Pitfall 5: Git Lock Contention With Concurrent Agent Operations

**What goes wrong:** Multiple agents working in worktrees of the same repository share the `.git/objects` database and branch references. When multiple agents simultaneously perform git operations (commit, push, fetch, rebase), they compete for lock files (`.git/index.lock`, ref locks). Operations fail with "unable to create lock file" errors.

**Why it happens:** While worktrees have independent staging areas (index files), they share the object store and refs. Operations that modify refs (branch creation, commits that update HEAD, pushes) require locks on shared resources. With 2-5 agents per repo actively committing, collisions are frequent.

**Consequences:**
- Git operations randomly fail for agents, causing error states
- Claude Code may retry failed git operations, creating cascading failures
- On networked filesystems (Remote SSH with NFS), lock contention is dramatically worse due to latency

**Prevention:**
- Implement a git operation queue per repository: serialize git operations that touch shared refs
- Use retry-with-backoff for git operations that fail with lock errors
- Avoid concurrent `git fetch` / `git pull` across worktrees -- centralize fetch operations
- Consider using `git worktree lock` for active worktrees to prevent accidental pruning
- Run `git gc` and maintenance operations only when no agents are active
- For branch operations, use the repo-level lock, not per-worktree locks

**Detection (warning signs):**
- "Cannot lock ref" or "unable to create .git/index.lock" errors in agent output
- Agents randomly failing git operations
- More failures on slower disks or network filesystems

**Confidence:** MEDIUM -- Based on [git worktree documentation](https://git-scm.com/docs/git-worktree) and [lock contention patterns](https://oneuptime.com/blog/post/2026-01-24-git-cannot-lock-ref-errors/view). Exact failure frequency depends on agent activity patterns.

**Phase relevance:** Phase 2-3 (multi-agent concurrent operations). Becomes critical once multiple agents per repo are supported.

---

## Moderate Pitfalls

---

### Pitfall 6: Terminal Visibility and Focus State Tracking Is Unreliable

**What goes wrong:** The extension needs to show/hide terminals as users switch between agents, but the VS Code terminal visibility API has known bugs. Terminals created with `hideFromUser: true` and `TerminalLocation.Editor` always appear in the terminal panel instead. Focus state tracking fails when users interact with other panel sections (PROBLEMS, OUTPUT). The extension loses track of which terminal is visible.

**Prevention:**
- Do not rely on the terminal panel for agent display. Instead, use Pseudoterminals rendered inside webview panels where you have full control over visibility.
- If using real terminals, maintain your own visibility state tracking with boolean flags rather than relying on VS Code's terminal visibility APIs.
- Test terminal show/hide behavior extensively across different VS Code layouts (single panel, split panels, floating panels).

**Confidence:** HIGH -- Confirmed via [VS Code issue #272656](https://github.com/microsoft/vscode/issues/272656).

**Phase relevance:** Phase 2 (UI layout). Affects core UX of agent switching.

---

### Pitfall 7: Multi-Root Workspace Context Confusion

**What goes wrong:** The extension manages multiple repos, which maps naturally to VS Code's multi-root workspace feature. But many VS Code APIs (and other extensions) assume a single root. The `rootPath` API is deprecated but still used by some code. Workspace folder ordering affects which folder is "active." Extensions that users have installed may behave unpredictably in multi-root mode, and the file explorer, search, and debugging all have subtle multi-root edge cases.

**Prevention:**
- Always use `workspace.workspaceFolders` (plural), never `workspace.rootPath`
- Register for `workspace.onDidChangeWorkspaceFolders` to handle dynamic folder additions/removals
- When switching repos/agents, explicitly update the active workspace folder context
- Test with 3+ workspace folders in different ordering configurations
- Document that some third-party extensions may not work correctly in multi-root mode

**Confidence:** HIGH -- Confirmed via [VS Code multi-root workspace docs](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces) and [workspace API migration guide](https://github.com/microsoft/vscode/wiki/Adopting-Multi-Root-Workspace-APIs).

**Phase relevance:** Phase 1-2 (workspace setup). Foundational decision that affects all subsequent features.

---

### Pitfall 8: Session Suspend/Restore Is Harder Than It Looks

**What goes wrong:** The project requires suspending idle agents (save terminal state, kill process, restore on demand). Developers assume they can save terminal scrollback, kill the process, and restore it perfectly. In reality: terminal scrollback is limited (default 1000 lines), ANSI escape sequences in saved output cause rendering glitches on restore, Claude Code's interactive TUI state cannot be fully captured from outside, and the restored session won't have the same shell environment variables.

**Prevention:**
- Define "suspend" as "kill process, save last N lines of output as plain text" -- not "perfect resume"
- On restore, start a fresh Claude Code session in the same worktree/branch, showing saved output as read-only history above the new session
- Use `terminal.integrated.persistentSessionScrollback` awareness but don't depend on it for your own suspend/restore
- Store agent metadata (worktree path, branch name, last command) separately from terminal state
- Set user expectations: "restore" means "new session in same context" not "resume exactly where you left off"

**Confidence:** MEDIUM -- Based on terminal API limitations and [VS Code issue #131634](https://github.com/microsoft/vscode/issues/131634) (session restoration across restarts).

**Phase relevance:** Phase 3 (optimization). Defer this to after basic agent lifecycle works correctly.

---

### Pitfall 9: Extension Startup Blocks VS Code When Using `*` Activation

**What goes wrong:** Using the `*` activation event (activate on VS Code startup) causes the extension to block VS Code's startup. With complex initialization (scanning for existing worktrees, checking for orphan processes, restoring agent state), this can add seconds to VS Code's launch time.

**Prevention:**
- Use `onStartupFinished` instead of `*` -- it activates after VS Code is fully loaded, so it doesn't block the UI
- Defer heavy initialization: activate immediately with a minimal footprint, then lazily initialize agent sessions, worktree scanning, and process recovery in the background
- Use `onView:` activation events for sidebar contributions -- only activate when the user actually opens the agent panel
- Profile startup time with `Developer: Startup Performance` command during development

**Confidence:** HIGH -- Confirmed via [VS Code activation events docs](https://code.visualstudio.com/api/references/activation-events).

**Phase relevance:** Phase 1 (extension scaffolding). Set the activation strategy correctly from the start.

---

### Pitfall 10: Webview Panels Cannot Receive Messages When Hidden

**What goes wrong:** Even with `retainContextWhenHidden`, you cannot send messages to a hidden webview. If agent status updates need to reach inactive agent panels (e.g., "agent finished task"), the messages are silently dropped. When the user switches back to that panel, it shows stale state.

**Prevention:**
- Queue messages in the extension host for each webview; flush the queue when the webview becomes visible
- Use `onDidChangeViewState` to detect when a webview becomes visible and push pending updates
- Store authoritative state in the extension host, not in the webview -- the webview should always fetch current state on visibility change
- For the agent tile sidebar (which is always visible), use it as the source of truth for agent status, not the individual agent webviews

**Confidence:** HIGH -- Confirmed via [VS Code webview docs](https://code.visualstudio.com/api/extension-guides/webview).

**Phase relevance:** Phase 2 (UI state management). Affects the agent status display architecture.

---

### Pitfall 11: Testing Webview and Terminal Interactions Is Extremely Difficult

**What goes wrong:** VS Code's recommended testing framework (`@vscode/test-electron`) has no support for testing webview content or terminal interactions. Developers build complex UIs with zero automated test coverage, leading to regressions on every change. Integration testing between webviews and the extension host is essentially impossible with built-in tools.

**Prevention:**
- Use WebdriverIO with the `wdio-vscode-service` for e2e testing of webviews and terminal interactions
- Separate business logic from VS Code API surface: keep process management, git operations, and state management in pure TypeScript classes that can be unit tested without VS Code
- Use dependency injection so VS Code API calls can be mocked in unit tests
- Build the webview UI with a framework (e.g., React/Preact) that can be tested independently in a browser
- Accept that some interactions (exact terminal rendering, panel drag-drop) will need manual testing

**Confidence:** HIGH -- Confirmed via [VS Code extension testing docs](https://code.visualstudio.com/api/working-with-extensions/testing-extension) and [WebdriverIO VS Code service](https://webdriver.io/docs/extension-testing/vscode-extensions/).

**Phase relevance:** Phase 1 (project setup). Set up the testing architecture before writing features, not after.

---

## Minor Pitfalls

---

### Pitfall 12: Worktree Branch Name Collisions

**What goes wrong:** Agent names map to branch names. If a user creates agent "feature-login" in two different repos, or deletes and recreates an agent with the same name, branch naming conflicts arise. Git refuses to create a worktree for a branch that is already checked out in another worktree.

**Prevention:**
- Use a naming convention that includes repo context: `agent/<repo-name>/<agent-name>` or include a short hash
- Before creating a worktree, check if the branch exists and is checked out elsewhere
- Handle the "already checked out" error gracefully with a clear user message
- When deleting agents, ensure the branch is fully removed (not just the worktree)

**Confidence:** HIGH -- Confirmed via [git worktree documentation](https://git-scm.com/docs/git-worktree).

**Phase relevance:** Phase 1 (worktree creation).

---

### Pitfall 13: Remote SSH Doubles All Resource Problems

**What goes wrong:** On Remote SSH connections, the extension host runs on the remote machine. Every terminal, every child process, every worktree consumes remote server resources. Memory issues that are tolerable locally (8 GB MacBook can handle it) become critical on shared remote servers with quotas. Additionally, network latency makes git operations and process spawning noticeably slower.

**Prevention:**
- Implement configurable resource limits: max agents per repo, max total agents, max worktrees
- Add a "resource monitor" that warns when approaching limits (disk space, process count)
- Test on Remote SSH from day one, not as an afterthought
- Consider that `git worktree list` and other git commands are slower over SSH; cache results
- Handle network disconnection gracefully -- agents should survive brief SSH disconnects

**Confidence:** MEDIUM -- Based on [VS Code Remote SSH docs](https://code.visualstudio.com/docs/remote/ssh) and [VS Code memory issues on remote #203425](https://github.com/microsoft/vscode/issues/203425).

**Phase relevance:** Phase 3 (remote support). But resource limit design should be in Phase 1.

---

### Pitfall 14: Tree View Refresh Hammering With Many Agents

**What goes wrong:** The agent tile sidebar uses a TreeView. When multiple agents are running and their statuses change frequently, calling `treeDataProvider.refresh()` on every status change triggers expensive cross-process calls. For a tree with expanded items, each refresh can result in hundreds of round-trip calls to the extension host to re-fetch children.

**Prevention:**
- Debounce tree refreshes: batch status updates and refresh at most once per 500ms
- Use targeted refresh: pass the specific `TreeItem` to `refresh(element)` instead of refreshing the entire tree
- Keep the tree structure shallow (repos -> agents, not deeply nested)
- For frequently changing data (agent status indicators), consider using `TreeItem.description` updates rather than full tree rebuilds

**Confidence:** HIGH -- Confirmed via [VS Code issue #232263](https://github.com/microsoft/vscode/issues/232263) (tree view optimization).

**Phase relevance:** Phase 2 (sidebar implementation).

---

### Pitfall 15: Pseudoterminal Timing and Rendering Gotchas

**What goes wrong:** If using Pseudoterminal (the recommended approach for this project), several subtle issues arise: events fired before `Pseudoterminal.open()` is called are silently ignored, terminal dimensions are undefined until the terminal is visible, writing `\n` without `\r` only moves the cursor down (not to column 0), and shell integration sequences get misplaced causing command detection to break.

**Prevention:**
- Buffer all writes until `open()` fires, then flush
- Handle `setDimensions()` being called with undefined initially
- Always write `\r\n` not just `\n` for line breaks
- Test with shell integration both enabled and disabled
- Implement a write queue that respects the terminal's ready state

**Confidence:** HIGH -- Confirmed via [VS Code Pseudoterminal stabilization issue #78514](https://github.com/microsoft/vscode/issues/78514).

**Phase relevance:** Phase 1-2 (terminal rendering layer).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Extension scaffolding | Using `*` activation, blocking startup | Use `onStartupFinished` or `onView:` activation events |
| Terminal/process architecture | Trying to read terminal output via API | Use child_process for process management, Pseudoterminal for display |
| Worktree management | No cleanup, worktree explosion | Track in manifest, reconcile on activation, enforce hard limits |
| Agent process lifecycle | Orphan processes on shutdown | PID tracking, tree-kill, cleanup-on-activate pattern |
| Sidebar agent tiles | TreeView refresh hammering | Debounce refreshes, use targeted element refresh |
| Agent panel webviews | retainContextWhenHidden memory bloat | Use getState/setState, webview pooling, virtual rendering |
| Agent switching UI | Terminal visibility API bugs | Use Pseudoterminal in webview, own state tracking |
| Multi-repo workspace | Multi-root API confusion | Always use workspaceFolders, handle dynamic changes |
| Suspend/restore | Expecting perfect session resume | Define "restore" as "new session in same context" |
| Concurrent agents | Git lock contention | Operation queue per repo, retry with backoff |
| Remote SSH support | Resource exhaustion on remote host | Configurable limits, resource monitoring, test early |
| Testing | No webview/terminal test coverage | WebdriverIO for e2e, separate business logic for unit tests |

---

## Sources

- [VS Code issue #59384 - Get output from terminal sendText](https://github.com/microsoft/vscode/issues/59384) -- terminal output capture is not possible (closed as-designed)
- [VS Code issue #105484 - Extensions have no chance to clean up on close](https://github.com/microsoft/vscode/issues/105484) -- 5-second shutdown window
- [VS Code issue #11895 - Deactivating extensions cleanup time](https://github.com/microsoft/vscode/issues/11895) -- 4-second deactivate deadline
- [VS Code issue #296194 - Background agent worktree explosion](https://github.com/microsoft/vscode/issues/296194) -- 1,526 worktrees created, ~800 GB consumed
- [VS Code issue #272656 - Cannot create hidden terminals in editor pane](https://github.com/microsoft/vscode/issues/272656) -- terminal visibility bugs
- [VS Code issue #232263 - Optimize tree view cross-process calls](https://github.com/microsoft/vscode/issues/232263) -- tree refresh performance
- [VS Code issue #78514 - Stabilize extension terminals (Pseudoterminal)](https://github.com/microsoft/vscode/issues/78514) -- pty timing issues
- [VS Code issue #131634 - Restore terminal sessions across restarts](https://github.com/microsoft/vscode/issues/131634) -- session persistence limitations
- [VS Code issue #203425 - Memory leak on remote SSH](https://github.com/microsoft/vscode/issues/203425) -- remote resource concerns
- [Claude Code issue #21182 - 11.6 GB memory leak per conversation window](https://github.com/anthropics/claude-code/issues/21182) -- webview memory impact
- [VS Code Webview API docs](https://code.visualstudio.com/api/extension-guides/webview) -- retainContextWhenHidden guidance
- [VS Code Activation Events docs](https://code.visualstudio.com/api/references/activation-events) -- startup performance
- [VS Code Multi-root Workspace docs](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces) -- multi-root API requirements
- [VS Code Extension Testing docs](https://code.visualstudio.com/api/working-with-extensions/testing-extension) -- testing limitations
- [WebdriverIO VS Code Extension Testing](https://webdriver.io/docs/extension-testing/vscode-extensions/) -- e2e testing solution
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree) -- worktree mechanics and limitations
- [VS Code July 2025 release notes](https://code.visualstudio.com/updates/v1_103) -- terminal API migration to core
