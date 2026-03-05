---
status: testing
phase: 01-extension-foundation-and-git-infrastructure
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-03-05T04:40:00Z
updated: 2026-03-05T04:40:00Z
---

## Current Test

number: 1
name: Extension Activates in Development Host
expected: |
  Press F5 (or Run > Start Debugging) to launch the Extension Development Host. The extension should activate without errors. No error notifications should appear. The Output panel (select "vscode-agentic" channel if available) should show no activation errors.
awaiting: user response

## Tests

### 1. Extension Activates in Development Host
expected: Press F5 (or Run > Start Debugging) to launch the Extension Development Host. The extension should activate without errors. No error notifications should appear.
result: [pending]

### 2. Add Repository Command Available
expected: In the Extension Development Host, open Command Palette (Cmd+Shift+P) and type "agentic". The command "vscode-agentic: Add Repository" should appear in the list.
result: [pending]

### 3. Add Repository Flow
expected: Run the "Add Repository" command. A workspace folder picker appears. Select a git repository folder. An InputBox appears asking for staging branch name with "staging" as the default value. Press Enter to accept the default. The repository should be saved without errors.
result: [pending]

### 4. Gitignore Entry Added
expected: After adding a repository, check the .gitignore file in that repo. It should contain a ".worktrees/" entry (created or appended automatically).
result: [pending]

### 5. Reconciliation on Activation
expected: With a repository already added, restart the Extension Development Host (reload window). The extension should activate and silently reconcile worktree state. If no orphans exist, no notification appears. The extension activates cleanly.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
