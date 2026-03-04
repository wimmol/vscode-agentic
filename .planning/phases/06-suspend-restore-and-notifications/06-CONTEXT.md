# Phase 6: Suspend/Restore and Notifications - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

User can suspend idle/finished agents to reclaim RAM (terminal process killed, restored on demand via --continue), and receives VS Code notifications when background agents finish work. Auto-suspend, OS-native notifications, and remote support are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Suspend mechanics
- Kill process only — no terminal scrollback preservation. On restore, relaunch with `claude --continue`. Terminal scrollback is lost but Claude session state persists via --continue flag
- Only idle/finished/error/created agents can be suspended — running agents must finish or be stopped first (matches TERM-04: "suspend an idle/finished agent")
- Manual suspend only — no auto-suspend timer. User explicitly suspends via context menu or command palette
- Both individual and bulk suspend: context menu on agent tile for individual, plus "Suspend All Idle Agents" command in palette for bulk

### Restore behavior
- Click tile = restore + focus: clicking a suspended agent tile restores it — relaunches Claude CLI with --continue in worktree, shows terminal, sets status to running. Same UX as clicking a finished agent (extends existing `focusAgent()` path)
- Preserve sidebar position and last-focused state — suspended agents keep their place in the tree
- On VS Code restart, suspended agents stay suspended — they already have no process, so nothing changes. User explicitly restores when needed

### Notification triggers & style
- VS Code notifications only (`vscode.window.showInformationMessage`) — no OS-native notifications. Consistent with existing Agentic notification pattern
- Notify when a non-focused (background) agent's terminal exits (finished or error). If the user is looking at the agent terminal, no notification needed
- "Needs input" detection not included — Claude Code CLI doesn't expose a "waiting" signal, would require terminal output parsing
- Notification includes a "Show Agent" action button that focuses the agent's terminal when clicked

### Sidebar UX for suspended
- Icon: `debug-pause` ThemeIcon with `disabledForeground` color — clearly communicates "paused" state, distinct from created (circle-outline) and finished (check)
- Sort priority: running(0) > created(1) > suspended(2) > finished(3) > error(4). Suspended agents are "alive but paused" — more prominent than finished
- Context menu items for suspend/restore: "Suspend Agent" shown when status is finished/error/created, "Restore Agent" shown when status is suspended. Conditional based on status via contextValue
- No RAM savings indicator — suspended status icon is sufficient

### Claude's Discretion
- How to determine if an agent is "focused" for notification suppression (active terminal check, VS Code window focus, etc.)
- Terminal dispose vs process kill strategy for suspend (consistent with existing cleanup patterns)
- Reconciliation handling for suspended agents on activation (no process to clean up, just validate worktree still exists)

</decisions>

<specifics>
## Specific Ideas

- Suspend/restore reuses the existing `focusAgent()` → `createTerminal(--continue)` path from Phase 5 — extend rather than rebuild
- "Suspended" is a new AgentStatus value added to the existing union type: `"created" | "running" | "finished" | "error" | "suspended"`
- Notification "Show Agent" button should call `focusAgent()` which handles terminal creation and focus in one step

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentService.focusAgent()`: already handles relaunching finished/error agents with --continue — extend to handle "suspended" status identically
- `TerminalService.disposeTerminal()`: kills terminal and clears PID — can be used for suspend (dispose terminal without deleting agent)
- `TerminalService.createTerminal(continueSession: true)`: already passes --continue flag — restore uses this path
- `getStatusIcon()` in agent-tree-items.ts: switch statement for status→icon mapping — add "suspended" case
- `AgentService.updateStatus()`: already updates status + fires change event — use for suspend/restore transitions
- `onDidCloseTerminal` handler: already detects terminal exit — extend to fire notification for unfocused agents

### Established Patterns
- Constructor injection: services created in `extension.ts activate()` with dependencies injected
- VS Code Memento (`workspaceState`): agent registry persistence — suspended status persists automatically
- `contextValue` for conditional menus: `agentItem` / `agentItemWithDiffs` pattern — add `agentItemSuspended` variant
- Fire-and-forget reconciliation: async operations on activation that don't block startup
- `onDidChangeAgents` event: fires on status changes, triggers TreeView refresh with 150ms debounce

### Integration Points
- `AgentStatus` type in models/agent.ts: add "suspended" to union
- `AgentService.focusAgent()`: extend status check to include "suspended" (same path as finished/error)
- `AgentService`: new `suspendAgent()` method — dispose terminal, set status to "suspended"
- `TerminalService.handleTerminalClose()`: extend to fire notification for unfocused agents
- `agent-tree-items.ts`: add suspended icon case, update sort priority
- `package.json`: new context menu items with `when` clause for suspend/restore
- `extension.ts`: register new suspend/restore commands, "Suspend All Idle" command

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-suspend-restore-and-notifications*
*Context gathered: 2026-03-04*
