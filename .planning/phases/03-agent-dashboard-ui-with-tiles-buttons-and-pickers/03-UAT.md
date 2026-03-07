---
status: complete
phase: 03-agent-dashboard-ui-with-tiles-buttons-and-pickers
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-03-07T10:00:00Z
updated: 2026-03-07T10:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar Panel Visibility
expected: Open the Agentic sidebar (click the Agentic icon in the Activity Bar). A webview panel appears showing the agent dashboard. If repos are configured, you see repo sections with agent tiles. If no repos, you see an empty dashboard area with the "Add Repo" (+) button in the view title bar.
result: pass

### 2. Agent Tile Content
expected: Each agent appears as a tile card (not a list item). The tile shows: agent name (prominent), status icon (codicon), repo name with icon, elapsed time with clock icon, initial prompt text (single line, truncated with ellipsis), and placeholder metrics (+-- -- files, ctx: --%, RAM: --MB).
result: pass

### 3. Status Icons Per State
expected: A running agent's tile shows an animated spinning icon. Created agents show a person icon. Finished agents show a checkmark. Error agents show an error icon.
result: pass

### 4. Action Button Disabled States
expected: Each tile has 4 action buttons: Stop, Reset Changes, Delete, Clear Context. For a running agent: Stop is enabled, Reset Changes and Clear Context are disabled (dimmed). For a finished/error agent: Stop is disabled, Reset Changes and Clear Context are enabled. Delete is always enabled.
result: pass

### 5. Repo Section Collapsing
expected: Each repo has a collapsible section header with a chevron, the repo name, and action buttons (+ create agent, gear settings, x remove). Clicking the chevron or header collapses/expands the agent tiles. The chevron rotates to indicate state.
result: pass

### 6. Tile Click Focuses Agent
expected: Clicking on an agent tile (not on an action button) switches the VS Code workspace to the agent's worktree directory. The workspace folders update to show the agent's worktree path.
result: pass

### 7. Stop Agent Button
expected: Clicking the Stop button on a running agent kills its terminal and the agent status changes to "finished". The tile updates to show a checkmark icon instead of spinner. Stop button becomes disabled.
result: pass

### 8. Auto-Refresh on Changes
expected: When you create a new agent (via Create Agent button on a repo section), the sidebar immediately shows the new agent tile without needing to manually refresh. Similarly, deleting an agent removes its tile automatically.
result: pass

### 9. Remove Repo Confirmation
expected: Clicking the remove (x) button on a repo section header shows a modal confirmation dialog. Confirming removes the repo section. Cancelling leaves everything unchanged.
result: pass

### 10. Add Repo Title Bar Button
expected: The view title bar (top of the Agentic sidebar) shows an "Add Repo" button with a + icon. Clicking it triggers the add repo workflow (folder picker dialog).
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
