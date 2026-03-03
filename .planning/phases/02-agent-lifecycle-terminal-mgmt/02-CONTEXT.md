# Phase 2: Agent Lifecycle and Terminal Management - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Create and delete named agents backed by git worktrees, launch Claude Code CLI sessions in VS Code terminals, track basic agent status (created/running/finished), and support 2-5 concurrent agents per repo. Sidebar UI (Phase 3), merge protection (Phase 4), session persistence (Phase 5), and suspend/restore (Phase 6) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Terminal type & CLI launch
- Terminal type (real vs pseudoterminal): Claude's discretion — pick based on research findings and trade-offs
- Terminals are visible to the user in the VS Code terminal panel — transparent, user can see and interact with Claude Code directly
- Lazy terminal creation: terminal is created only when user focuses the agent, not on agent creation (satisfies PERF-01)
- Claude Code CLI invoked with `claude "initial prompt"` when a prompt is provided; bare `claude` when no prompt given

### Agent status detection
- Basic status model for Phase 2: `created` (agent exists, no terminal yet), `running` (terminal open), `finished` (terminal exited)
- Detect status via terminal lifecycle events (open/close) and exit codes — no output parsing required
- When terminal process exits: mark agent as `finished`, keep the agent in the list with worktree and branch preserved
- Agent metadata stored in VS Code Memento (workspaceState) — consistent with Phase 1 pattern for worktree manifest and repo configs

### Agent creation flow
- Agent name: free text via VS Code InputBox with branch-name validation (no spaces, no special chars that break git branch names)
- Repo selection: QuickPick from repos configured via Phase 1's "Add Repo". Auto-skip picker if only one repo is configured
- Initial prompt: optional — user can provide a task description at creation time, or skip to open Claude Code in interactive mode
- Name collision: if agent name already exists in that repo, offer to reuse the existing agent or pick a new name

### Agent deletion behavior
- Running agents CAN be deleted — show confirmation warning: "Agent X is still running. Delete anyway?"
- ALL deletions require confirmation dialog: "Delete agent X? This removes the worktree and branch."
- Agent selection for deletion: Command palette QuickPick listing all agents with status indicators
- No merge protection in Phase 2 — Phase 4 adds the guard against deleting agents with unmerged changes

### Claude's Discretion
- Terminal type choice (real VS Code terminal vs pseudoterminal)
- Agent data model design (extend WorktreeEntry, new AgentEntry, or unified model)
- Exact branch-name validation rules
- Terminal process kill strategy (SIGTERM vs dispose)
- Error status detection and error handling patterns
- Internal service architecture (AgentService, TerminalService, or combined)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorktreeService.addWorktree()` / `removeWorktree()`: already handles branch+worktree creation/deletion with per-repo mutex locking
- `WorktreeService.getManifest()`: returns worktree entries per repo — agent registry can follow same pattern
- `RepoConfigService.getAll()` / `getForRepo()`: repo picker can use these to populate QuickPick
- `handleWorktreeLimitError()`: existing QuickPick pattern for listing worktrees — Phase 2 can enhance with status indicators
- `GitService`: async git operations wrapper ready to use

### Established Patterns
- Constructor injection: services created in `extension.ts activate()` and injected via constructors
- VS Code Memento for persistence: `context.workspaceState` used for both repo configs and worktree manifest
- QuickPick for interactive selection: used in both `addRepo()` and `handleWorktreeLimitError()`
- Per-repo mutex via promise chain: prevents TOCTOU on concurrent worktree operations
- Fire-and-forget reconciliation: async operations that don't block activation

### Integration Points
- `extension.ts activate()`: new agent service(s) instantiated here, new commands registered
- `WorktreeService`: agent creation calls `addWorktree()`, deletion calls `removeWorktree()`
- `vscode.window.createTerminal()`: terminal creation API for launching Claude Code CLI
- `vscode.window.onDidCloseTerminal`: event for detecting terminal exit (status transition to finished)
- Command palette: new commands for create/delete/list agents

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-agent-lifecycle-terminal-mgmt*
*Context gathered: 2026-03-04*
