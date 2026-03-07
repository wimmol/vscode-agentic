# Phase 4: UI Polish - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the Agentic sidebar UI and Explorer integration: set up a .code-workspace file so the workspace is named "Agentic", add root navigation buttons (global + per-repo), switch to message-based DOM patching to eliminate rendering glitches, and manage Explorer folder scope consistently across all navigation actions.

</domain>

<decisions>
## Implementation Decisions

### Workspace naming
- Create `~/.agentic/agentic.code-workspace` file on first extension activation
- Workspace file lists all repo root folders from `~/.agentic/config.json` (repos key: name -> global path)
- Title bar shows "Agentic" instead of "Untitled (Workspace)"
- Workspace file is auto-synced: when repos are added/removed via the extension, update the `.code-workspace` folders list to match config.json
- Prompt user to reopen VS Code in workspace mode after creating the file
- File lives in user's home directory (`~/.agentic/`) for portability — user can move it to another machine

### Root navigation buttons
- Global "root" button in the panel toolbar, positioned left of the + (Add Repo) button
- Per-repo "root" button in each repo header, positioned left of the + (Create Agent) button
- Both use `codicon-root-folder` icon for consistency
- Global root: sets workspace folders to all repo roots from config.json
- Per-repo root: replaces all workspace folders with that single repo's root folder
- Active root button gets a visual highlight (accent color or background) to show current scope

### Smooth rendering
- Replace current `refresh()` full HTML replacement with postMessage + DOM patching
- Extension sends agent/repo data as JSON via `webview.postMessage()`
- Webview JS receives data and updates existing DOM elements in-place (text, classes, attributes)
- Initial render still uses full HTML (first load only)
- New agent tiles animate in (fade/slide), deleted tiles animate out (fade) via CSS transitions
- Status icon changes use crossfade transition; elapsed time updates text only, no tile re-creation
- No element should disappear and re-render — all updates are in-place modifications

### Explorer folder scope
- Three scope modes, all using replace-all pattern:
  1. Global root: show all repo root folders (basenames only, e.g., "foo", "bar")
  2. Per-repo root: show single repo root folder
  3. Agent focus (tile click): show single agent worktree folder (raw folder path, current behavior)
- On startup, Explorer shows all repo roots (read from .code-workspace file)
- Scope changes sync to the .code-workspace file (persists across restarts — user sees last-focused scope on reopen)
- workspace.updateWorkspaceFolders() used for all scope changes

### Claude's Discretion
- Exact CSS transition durations and easing functions for tile animations
- DOM diffing implementation details (manual vs lightweight library)
- Workspace file creation timing (on activate vs on first addRepo)
- How to detect if VS Code is already in workspace mode
- Notification UX for the "reopen in workspace" prompt

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants the .code-workspace file to serve as a portable config with repo paths, so it can be moved to another PC
- ~/.agentic/config.json already stores repos as key=name, value=global_path — workspace file should reference these paths
- "We hide nothing without manual removal by clicking cross buttons" — no UI element should ever disappear without explicit user action
- Global root button and per-repo root button should be visually consistent (same icon, similar placement logic)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SidebarViewProvider`: WebviewViewProvider with message handling, already has refresh() method to convert to postMessage
- `getHtmlForWebview()`: Pure function generating HTML — can be reused for initial render
- `renderAgentTile()` / `renderRepoSection()`: Pure render functions — can inform the JSON shape for DOM patching
- `getDashboardScript()`: Already has event delegation and timer — extend with message receiver
- `focusAgent` command: Already uses `updateWorkspaceFolders()` — pattern to reuse for root buttons

### Established Patterns
- Event delegation on `.dashboard` container for all click handling
- VS Code theme CSS variables for all colors
- Codicons for all icons
- Commands receive arguments from webview postMessage
- Services created in activate() and injected

### Integration Points
- `sidebar-provider.ts`: refresh() needs refactoring from HTML replacement to postMessage
- `sidebar-html.ts`: getDashboardScript() needs message receiver for DOM patching
- `agent.commands.ts`: focusAgent already has updateWorkspaceFolders — root commands follow same pattern
- `extension.ts`: Register new commands for root navigation
- `package.json`: May need new commands for root navigation, toolbar buttons
- `~/.agentic/config.json`: Source of truth for repo list (new dependency)
- `~/.agentic/agentic.code-workspace`: New file to create and manage

</code_context>

<deferred>
## Deferred Ideas

- Settings gear dialog UI (editing staging branch, worktree limits) — future phase
- Actual diff counts, context usage, RAM metrics — future phases with real data
- Clear Context terminal write integration — future phase
- Reset Changes git operation — future phase

</deferred>

---

*Phase: 04-ui-polish-agentic-tab-folder-scope-sidebar-workspace-naming-root-navigation-buttons-smooth-rendering-without-glitches*
*Context gathered: 2026-03-07*
