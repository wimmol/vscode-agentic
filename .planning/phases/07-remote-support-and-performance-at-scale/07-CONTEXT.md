# Phase 7: Remote Support and Performance at Scale - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Extension works seamlessly over VS Code Remote SSH with configurable resource limits independent of local settings, and remains responsive with 5 concurrent agents and large repositories. Custom SSH implementation, hybrid local/remote agent execution, and OS-native notifications are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Remote resource limits
- Use VS Code's native `contributes.configuration` settings with `resource` scope for per-remote overrides — users set defaults locally, override per remote host in Remote SSH settings
- Migrate `worktreeLimit` from per-repo Memento (RepoConfig) to VS Code settings (`vscode-agentic.maxWorktreesPerRepo`). Add `vscode-agentic.maxAgentsPerRepo`. RepoConfig keeps only repo-specific data (path, stagingBranch)
- Add `vscode-agentic.maxConcurrentAgents` as a global cap across all repos — prevents runaway resource usage on constrained remote machines
- Three configurable limits: `maxAgentsPerRepo` (default 5), `maxWorktreesPerRepo` (default 5), `maxConcurrentAgents` (default 10)
- When limit reached: block creation + offer to auto-suspend the oldest idle agent to make room. More helpful on resource-constrained remotes than just refusing

### Remote execution model
- Remote host only — extension runs entirely on the remote host via VS Code Remote SSH. Agents run on the remote machine where the repo lives. No hybrid local/remote complexity
- No custom SSH implementation — VS Code Remote SSH is the transport layer. The extension host process runs on the remote, so all paths, git operations, and terminal processes are local to the remote machine
- Rely on VS Code Remote SSH reconnection for network interruptions — agents keep running on the remote, existing reconciliation picks up state on reconnect. No custom connection-aware status tracking

### Remote environment validation
- Extend existing activation health checks: git version check (already exists) + Claude Code CLI availability check (new). Both run on the remote host automatically since the extension host is remote
- Check for `claude` in PATH on activation. If not found: show warning, disable agent creation. Repo management still works — similar pattern to existing git health check
- No remote path translation needed — VS Code Remote SSH maps paths transparently. The existing `.worktrees/` sibling folder pattern works as-is on the remote filesystem

### Scale optimizations
- Primary concern: git operation contention with 5 agents. Per-repo mutex already serializes git calls. Optimize diff status checks to avoid full sweeps on every change
- Batched + time-based diff cache: cache diff results with a TTL (e.g., 30s). Only recompute for the specific agent whose status changed, not all agents. Current `updateDiffStatus()` checks all agents on every change event — optimize to targeted updates
- Shallow git operations for large repos: use `git diff --stat` with limited output, avoid full history traversal. No repo-size-specific adaptive behavior needed
- No runtime performance instrumentation — keep it simple. Success criterion is "remains responsive" — verify with 5 agents during testing

### Remote UX
- No remote-specific visual indicators in the sidebar — VS Code already shows remote connection in status bar. Extension should feel identical whether local or remote
- No special latency handling — extension operations run on the remote host, so no added latency vs local. Existing async patterns are sufficient
- Settings only, no remote-specific commands — VS Code settings with `resource` scope enables per-remote overrides. All existing commands work identically local vs remote

### Claude's Discretion
- Exact VS Code settings schema (types, enums, descriptions, defaults)
- Migration strategy for existing worktreeLimit values in Memento to new settings
- TTL duration for diff status cache (30s suggested, but Claude can tune)
- Whether to add progress indicators (`withProgress`) for potentially slow operations
- Exact error messages and warning text for missing CLI on remote
- Developer-mode timing logs (optional, behind a setting if Claude deems useful)

</decisions>

<specifics>
## Specific Ideas

- The extension should "just work" on remote — the key insight is that VS Code Remote SSH runs the extension host on the remote machine, so all file paths, git operations, and terminal processes are local to the remote. This means Phase 7's remote support is primarily about configuration (resource limits) and validation (CLI availability), not about SSH tunneling or path translation
- Three configurable limits with sensible defaults cover REMOTE-02 while being useful locally too
- The auto-suspend suggestion when limits are hit connects Phase 6 (suspend/restore) to Phase 7 (resource management) nicely

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RepoConfig.worktreeLimit`: currently in Memento — migrating to VS Code settings. Pattern for reading: `vscode.workspace.getConfiguration('vscode-agentic').get('maxWorktreesPerRepo')`
- `WorktreeService.addWorktree()`: already checks `worktreeLimit` — update to read from VS Code settings instead of RepoConfig
- `AgentService.reconcileOnActivation()`: runs on activation — add CLI health check alongside
- `gitService.exec(".", ["--version"])`: existing git health check pattern — replicate for `claude --version`
- `AgentTreeProvider.updateDiffStatus()`: current full-sweep diff check — optimize to targeted per-agent updates with caching
- `AgentService.suspendAgent()`: Phase 6 suspend — reuse for auto-suspend suggestion when limits hit
- `handleWorktreeLimitError()`: existing limit-reached UX pattern — enhance with auto-suspend option

### Established Patterns
- Constructor injection: services created in `extension.ts activate()` with dependencies injected
- VS Code Memento (`workspaceState`): used for agent registry, worktree manifest, repo configs
- `vscode.workspace.getConfiguration()`: not yet used but is the standard VS Code settings API
- Fire-and-forget reconciliation on activation: async operations that don't block startup
- 150ms debounce on TreeView refresh via `onDidChangeAgents` event
- Per-repo mutex via promise chain: prevents TOCTOU on concurrent git operations

### Integration Points
- `package.json contributes.configuration`: new settings section for resource limits
- `RepoConfig` model: remove `worktreeLimit` field, read from VS Code settings instead
- `WorktreeService`: update limit check to use `vscode.workspace.getConfiguration()`
- `extension.ts activate()`: add Claude CLI health check alongside git health check
- `AgentTreeProvider.updateDiffStatus()`: refactor for per-agent targeted updates with TTL cache
- `handleWorktreeLimitError()`: enhance with "Suspend idle agent" option when limit reached

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-remote-support-and-performance-at-scale*
*Context gathered: 2026-03-04*
