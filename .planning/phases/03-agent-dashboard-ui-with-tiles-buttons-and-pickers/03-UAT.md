---
status: complete
phase: 03-agent-dashboard-ui-with-tiles-buttons-and-pickers
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-03-07T00:00:00Z
updated: 2026-03-07T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar Panel Visibility
expected: Open the Agentic sidebar (click the Agentic icon in the Activity Bar). A webview panel appears showing the agent dashboard — not a tree view. If repos are configured, you see repo sections. If no repos, you see an empty dashboard area with the "Add Repo" (+) button in the view title bar.
result: issue
reported: "When I click to agent, the agent worktree opens, thats why Agentic tab see current work tree scope and hide all agents. We should have workspace of agentic tab that hold information all time not dependent to root folder. Workspace should be only one and without any settings for now."
severity: major

### 2. Agent Tile Content
expected: Each agent appears as a prominent tile card (not a cramped list item). The tile shows: agent name (prominent, at top), status icon (codicon), repo name with repo icon, elapsed time with clock icon, initial prompt text (single line, truncated with ellipsis if long), and placeholder metrics (+-- -- files, ctx: --%, RAM: --MB).
result: skipped
reason: Blocked by Test 1 workspace scoping issue

### 3. Status Icon Animation
expected: A running agent's tile shows an animated spinning icon. Created agents show a person icon. Finished agents show a checkmark. Error agents show an error icon with exit code displayed.
result: skipped
reason: Blocked by Test 1 workspace scoping issue

### 4. Action Button Disabled States
expected: Each tile has 4 action buttons: Stop, Reset Changes, Delete, Clear Context. For a running agent: Stop is enabled, Reset Changes and Clear Context are disabled (dimmed at ~70% opacity), Delete is enabled. For a finished/error agent: Stop is disabled, Reset Changes and Clear Context are enabled, Delete is enabled.
result: skipped
reason: Blocked by Test 1 workspace scoping issue

### 5. Repo Section Collapsing
expected: Each repo has a collapsible section header with a chevron, the repo name (last path segment), and action buttons (+ create agent, gear settings, x remove). Clicking the chevron or header collapses/expands the agent tiles within that section. The chevron rotates to indicate state.
result: skipped
reason: Blocked by Test 1 workspace scoping issue

### 6. Tile Click Focuses Agent
expected: Clicking on an agent tile (not on an action button) switches the VS Code workspace to the agent's worktree directory. The workspace folders update to show the agent's worktree path.
result: skipped
reason: Blocked by Test 1 workspace scoping issue

### 7. Stop Agent Button
expected: Clicking the Stop button on a running agent kills its terminal and the agent status changes to "finished". The tile updates to show a checkmark icon instead of spinner. Stop button becomes disabled.
result: skipped
reason: Blocked by Test 1 workspace scoping issue

### 8. Auto-Refresh on Changes
expected: When you create a new agent (via Create Agent button on a repo section), the sidebar immediately shows the new agent tile without needing to close and reopen the sidebar. Similarly, deleting an agent removes its tile automatically.
result: skipped
reason: Blocked by Test 1 workspace scoping issue

### 9. Remove Repo Confirmation
expected: Clicking the remove (x) button on a repo section header shows a modal confirmation dialog warning that the repo will be removed. Confirming removes the repo section from the sidebar. Cancelling leaves everything unchanged.
result: skipped
reason: Blocked by Test 1 workspace scoping issue

### 10. Add Repo Title Bar Button
expected: The view title bar (top of the Agentic sidebar) shows an "Add Repo" button with a + icon. Clicking it triggers the add repo workflow (folder picker dialog).
result: skipped
reason: Blocked by Test 1 workspace scoping issue

## Summary

total: 10
passed: 0
issues: 1
pending: 0
skipped: 9
skipped: 0

## Gaps

- truth: "Sidebar panel shows all agents regardless of active workspace folder"
  status: failed
  reason: "User reported: When I click to agent, the agent worktree opens, thats why Agentic tab see current work tree scope and hide all agents. We should have workspace of agentic tab that hold information all time not dependent to root folder. Workspace should be only one and without any settings for now."
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
