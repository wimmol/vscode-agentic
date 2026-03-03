# Phase 3: Sidebar UI and Agent Switching - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

TreeView sidebar showing agent tiles grouped by repository, with click-to-switch behavior. Same-repo switching changes only the agent CLI panel. Cross-repo switching updates the entire VS Code context (file explorer, editor, terminal, CLI panel) via multi-root workspace. Merge buttons (Phase 4), session persistence (Phase 5), and suspend/restore UI (Phase 6) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Agent tile content
- Two-line tiles: agent name with status ThemeIcon on line 1, description on line 2
- Description line shows initial prompt preview (truncated), or "Interactive session" if no prompt was given
- Status indicators use VS Code ThemeIcon with ThemeColor: green circle for running, gray circle for created, checkmark for finished, warning triangle for error
- Only show the 4 current statuses (created, running, finished, error) — suspended indicator added in Phase 6

### Cross-repo switching
- Multi-root workspace: all configured repos live in one VS Code window
- Cross-repo agent click: switch file explorer focus, editor, bottom terminal, and agent CLI panel to the target repo's worktree
- Auto-focus file explorer on cross-repo switch — scroll to and expand the target repo's worktree folder
- Same-repo agent click: only switch the CLI panel (show that agent's terminal) — do NOT touch the editor or file explorer
- Currently active/focused agent is visually highlighted in the sidebar (bold, accent, or active indicator)

### Context menu and actions
- Right-click context menu on agent tiles: Delete Agent, Copy Branch Name
- Inline hover action: trash icon (delete) appears on hover over agent tile
- Repo group headers: inline '+' button to create a new agent in that repo
- View title toolbar: Create Agent button ('+') and Add Repo button (folder icon)
- Welcome content when no agents exist: "No agents yet" message with a Create Agent button (VS Code TreeView welcome content API)

### Tile ordering and grouping
- Agents ordered within repo group by status priority: running > created > finished > error
- Within same status, alphabetical by agent name
- Repo groups are collapsible, expanded by default
- TreeView auto-refreshes on state changes (agent created/deleted, status changes) via onDidChangeTreeData event

### Claude's Discretion
- Exact ThemeIcon names and ThemeColor values
- TreeView item tooltip content
- Active agent highlight implementation (bold text, decoration, or TreeView selection)
- TreeView refresh debouncing strategy
- Multi-root workspace folder management details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentService.getAll()` / `getForRepo()`: data sources for TreeView — returns AgentEntry[] with agentName, repoPath, status, initialPrompt, createdAt
- `AgentService.focusAgent()`: the action triggered when clicking an agent tile — handles lazy terminal creation and status update
- `RepoConfigService.getAll()`: returns configured repos for building repo group headers
- `TerminalService.showTerminal()`: shows existing terminal for same-repo switching
- `AgentEntry` model: has all fields needed for tile rendering (agentName, status, initialPrompt, createdAt)

### Established Patterns
- Constructor injection: TreeDataProvider will be instantiated in `extension.ts activate()` with AgentService and RepoConfigService injected
- VS Code Memento for persistence: agent data already persisted, TreeView is a read-only view of it
- `onDidCloseTerminal` event already fires status changes via TerminalService callback — TreeView can listen to same pattern
- package.json already declares `vscode-agentic.agents` view in `vscode-agentic` activity bar container

### Integration Points
- `extension.ts activate()`: register TreeDataProvider via `vscode.window.registerTreeDataProvider('vscode-agentic.agents', provider)`
- `AgentService`: TreeDataProvider reads from AgentService, needs to observe changes for auto-refresh
- `package.json contributes.menus`: context menu items registered in `view/item/context` and `view/title` sections
- `package.json contributes.commands`: new commands for context menu actions (delete from tile, copy branch name)
- `vscode.workspace.updateWorkspaceFolders()`: API for multi-root workspace folder management during cross-repo switch

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard VS Code TreeView patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-sidebar-ui-and-agent-switching*
*Context gathered: 2026-03-04*
