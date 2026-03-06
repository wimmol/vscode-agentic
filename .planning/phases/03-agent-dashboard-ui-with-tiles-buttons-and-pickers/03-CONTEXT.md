# Phase 3: Agent Dashboard UI with Tiles, Buttons, and Pickers - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a Webview-based sidebar panel that replaces terminal-command-based agent management with a visual dashboard. Repo sections with header bars, agent tile cards with status indicators, action buttons, and pickers. This phase is UI only -- all data that isn't available yet (context usage, RAM, diff counts) shows as placeholders. Wires to existing commands (focusAgent, deleteAgent, createAgent, addRepo) from Phases 1-2. No new backend logic.

</domain>

<decisions>
## Implementation Decisions

### Rendering approach
- Webview panel in the sidebar (not TreeView) for full custom HTML/CSS card layout
- Replaces the placeholder TreeView registered in package.json (`vscode-agentic.agents`)
- Uses VS Code theme CSS variables for all colors (`--vscode-editor-background`, `--vscode-panel-border`, `--vscode-foreground`, etc.) -- automatically adapts to dark/light themes

### Tile content (all fields shown on every tile, regardless of status)
- Agent name (prominent, top of tile)
- Status icon: animated spinner (running), wave hand (created), checkmark (finished), cross (error)
- Repo name
- Elapsed time: live-updating timer (ticks every second) for running agents; total time for finished; "--" for created
- Initial prompt: single line, truncated with ellipsis. Full text in tooltip on hover
- Diff indicator: `+N -M files` format (placeholder `-- --` until Phase 4 git workflow provides data)
- Context usage: `ctx: --%` (placeholder until Claude Code integration)
- RAM usage: `RAM: --MB` (placeholder until process monitoring integration)
- Exit code shown on error tiles
- Branch name NOT shown separately (agent name = branch name by design)

### Tile action buttons (always visible, disabled buttons at opacity 0.7)
- **Stop** button: active when agent is running, disabled otherwise. Kills terminal process
- **Reset Changes** button: active for finished/error agents, disabled for running/created. Runs `git checkout .` in worktree (UI only in Phase 3 -- logic wired in future phase)
- **Delete** button: always active. Calls existing deleteAgent command with confirmation dialog
- **Clear Context** button: active for finished/error agents, disabled for running/created. Sends `/clear` to Claude Code terminal (UI only in Phase 3 -- terminal write logic wired in future phase)
- Entire tile is clickable -- clicking the tile itself calls focusAgent (focuses terminal)

### Sidebar layout
- Single scrollable Webview panel
- Panel toolbar: "Add Repo" icon button in the title bar area
- Repo sections stacked vertically, each collapsible
- Each repo has a header bar: repo name, active/inactive indicator, `[+]` create agent, `[gear]` settings, `[x]` remove repo
- Agents sorted by creation order within each repo section (oldest at top, newest at bottom)
- Empty repo section: just the header bar, no placeholder text

### Agent creation flow
- Per-repo `+` button in repo header bar (no global repo picker needed)
- Triggers existing createAgent command flow: VS Code InputBox for name, then optional prompt InputBox
- No changes to the creation logic itself -- just the trigger point moves to sidebar

### Repo management
- Add Repo button in panel toolbar (calls existing addRepo command)
- Each repo header shows active/inactive state indicator (visual only -- auto-timeout is deferred)
- Collapse/expand toggle per repo section
- Settings gear opens repo settings (staging branch, worktree limit)
- Remove repo button (X) with confirmation

### Claude's Discretion
- Webview HTML/CSS structure and card styling details
- Exact icon choices (codicons, SVGs, or emoji for status indicators)
- Animation implementation for the running spinner
- Timer update interval optimization (1s vs less frequent)
- Message passing protocol between webview and extension host
- How to handle webview state persistence on panel hide/show

</decisions>

<specifics>
## Specific Ideas

- User wants "big tiles" -- each agent card should be visually prominent, not a cramped list item
- Disabled buttons use opacity 0.7 (not hidden) for consistent tile sizing
- Status badge is icon-only, no text label for the status (spinner, hand, check, cross convey the state)
- Full tile is a click target for focusing the agent -- buttons are overlaid on the tile

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentService.getAll()` / `getForRepo()`: provides agent data for populating tiles
- `AgentService.updateStatus()`: status changes trigger webview refresh
- `TerminalService.disposeTerminal()`: Stop button calls this
- `RepoConfigService.getAll()`: provides repo list for sidebar sections
- Existing commands: `createAgent`, `deleteAgent`, `focusAgent`, `addRepo` -- all registered and functional

### Established Patterns
- Constructor injection: services created in `activate()` and injected
- VS Code Memento for persistence: agent registry and repo configs stored in workspaceState
- Commands receive `repoPath`/`agentName` as arguments from UI (Phase 2 design decision)
- All commands hidden from Command Palette (Phase 2) -- sidebar is the sole interaction surface

### Integration Points
- `extension.ts activate()`: register WebviewViewProvider, pass services
- `package.json contributes.views`: change existing `vscode-agentic.agents` view type to webview
- `vscode.WebviewViewProvider`: implements `resolveWebviewView()` to render HTML
- Commands invoked via `vscode.commands.executeCommand()` from webview postMessage
- Agent status changes need to push updates to webview (event-driven refresh)

</code_context>

<deferred>
## Deferred Ideas

- Auto-inactive repo after 1h of no clicks and no active agents -- needs timer logic, future phase
- Actual context usage from Claude Code (needs CLI integration or IPC)
- Actual RAM/CPU monitoring per agent process
- Actual diff counts vs staging branch (Phase 4 git workflow)
- Clear Context terminal write (`/clear` command) -- needs TerminalService.sendText() integration
- Reset Changes git operation (`git checkout .`) -- needs GitService integration
- Repo settings dialog UI (the gear button -- settings editing interface, not just the button)

</deferred>

---

*Phase: 03-agent-dashboard-ui-with-tiles-buttons-and-pickers*
*Context gathered: 2026-03-06*
