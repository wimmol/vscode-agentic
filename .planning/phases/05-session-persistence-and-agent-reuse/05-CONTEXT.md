# Phase 5: Session Persistence and Agent Reuse - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Agent sessions survive VS Code restarts (metadata and sidebar state restored, terminals relaunched on demand), finished agents can be restarted by clicking their tile, and orphan processes from unclean shutdowns are detected and cleaned up on activation. Suspend/restore (Phase 6), notifications (Phase 6), and remote support (Phase 7) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Session restoration on restart
- Dormant until clicked: agents appear in sidebar with correct metadata, but no terminals are created until user clicks an agent tile
- When relaunching after restart, launch Claude Code in interactive mode (no prompt) — the original task prompt is stale context
- Remember last-focused agent key in Memento; highlight it in sidebar on restart (but don't launch its terminal)
- Keep `isTransient: true` on terminals — extension fully controls restoration, no VS Code ghost terminal tabs

### Agent restart behavior
- Click tile = restart: clicking a finished/error agent tile relaunches it immediately (consistent with existing `focusAgent()` behavior)
- Launch directly with no prompt dialog — user can type whatever they want in the CLI
- Preserve original `initialPrompt` field as metadata for reference (shown in sidebar description) — it's history, not an action to repeat
- Resume vs fresh session (`claude --resume` vs bare `claude`): Claude's discretion based on research findings about --resume flag reliability

### Orphan process detection
- Detection strategy (PID tracking vs process scanning vs other): Claude's discretion based on VS Code Terminal API feasibility and cross-platform concerns
- Auto-kill orphans with notification: "Cleaned up N orphaned agent processes" — informative but doesn't block the user
- Run on every activation — matches existing worktree reconciliation pattern (Phase 1), low cost
- Full reconciliation scope: cross-reference agent registry with worktree manifest, remove agent entries whose worktrees no longer exist on disk

### Sidebar status after restart
- Reset previously "running" agents to "created" status — same as current `reconcileOnActivation()` behavior
- No visual distinction between restored and newly created agents — "created" means "no terminal yet" regardless of history
- Preserve all agents indefinitely until explicitly deleted — no auto-archiving of stale agents
- Diff status cache (Phase 4) recomputed from scratch on activation — git state may have changed externally

### Claude's Discretion
- Resume vs fresh session strategy for agent restart (`claude --resume` vs bare `claude`)
- Orphan process detection mechanism (PID tracking, process scanning, or alternative)
- Cross-platform orphan detection considerations (macOS, Linux, Windows)
- Reconciliation ordering (worktree reconcile first, then agent reconcile, then orphan cleanup)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraints from existing codebase:
- Agent metadata already persists via Memento (`AGENT_REGISTRY_KEY` in `workspaceState`)
- `reconcileOnActivation()` already resets "running" to "created" — enhance rather than replace
- Worktree reconciliation already runs fire-and-forget on activation — orphan cleanup should follow same pattern
- Notification pattern already established: `vscode.window.showInformationMessage("Agentic: Cleaned up N orphaned worktree(s)")`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentService.reconcileOnActivation()`: already resets "running" to "created" — extend to include orphan process cleanup and registry-worktree cross-reference
- `AgentService.focusAgent()`: already handles relaunching finished/error agents with new terminals — core restart mechanism is in place
- `AgentEntry` model: already persisted in Memento with status, initialPrompt, createdAt, exitCode — add fields if needed (e.g., lastFocusedAt, pid)
- `TerminalService.createTerminal()`: already accepts worktreePath and optional initialPrompt — modify to skip prompt on restart
- `WorktreeService.reconcile()`: worktree-level orphan detection pattern to follow for agent-level reconciliation
- `WorktreeService.getManifest()`: returns worktree entries per repo — use for cross-referencing against agent registry

### Established Patterns
- Constructor injection: services created in `extension.ts activate()` with dependencies injected
- VS Code Memento (`workspaceState`): used for agent registry, worktree manifest, repo configs — use for last-focused agent and PID tracking
- Fire-and-forget reconciliation on activation: async operations that don't block startup
- Notification pattern: `vscode.window.showInformationMessage("Agentic: ...")` for cleanup results
- `onDidChangeAgents` event: fires on status changes, triggers TreeView refresh with 150ms debounce

### Integration Points
- `extension.ts activate()`: enhanced reconciliation sequence (worktree → agent → orphan cleanup)
- `AgentService`: enhanced `reconcileOnActivation()` with agent-worktree cross-reference
- `TerminalService`: may need PID tracking capability for orphan detection
- `AgentTreeProvider`: needs to handle last-focused agent highlighting on restart
- `focusAgent()`: modification to skip initialPrompt on restart (launch interactive mode)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-session-persistence-and-agent-reuse*
*Context gathered: 2026-03-04*
