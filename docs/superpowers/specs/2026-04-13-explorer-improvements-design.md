# Explorer Improvements: Live Watching, Source Control, Bug Fixes

**Date:** 2026-04-13
**Status:** Draft

## Overview

Improve the Agentic Explorer with three work streams: file system watching for live updates, a new Source Control webview for commit/push/pull, and targeted bug fixes from audit.

## Context

The Agentic Explorer (`FileExplorerProvider`) is a native VS Code TreeView that provides file browsing scoped to repos and agent worktrees. It currently has no file system watchers — changes on disk only appear after manual operations that call `explorer.refresh()`. Users must reselect a folder to see new files created by agents, git operations, or external tools.

The sidebar currently has two views stacked vertically:
1. **Agents** (webview) — repo tiles, agent management
2. **Agentic Explorer** (tree view) — file browser

## Work Stream 1: File System Watching

### Goal
Any file create/delete/rename on disk is reflected in the explorer automatically, regardless of source (agent terminal, git operation, external editor, Finder).

### Design

Add file system watchers to `FileExplorerProvider` using `vscode.workspace.createFileSystemWatcher` with `RelativePattern` per root path.

**Watcher lifecycle:**
- On `showRepo()` / `showAllRepos()`: dispose old watchers, create new ones for current `roots`
- Each root gets a watcher with pattern `**/*` (all files/folders recursively)
- On `dispose()`: clean up all watchers

**Events handled:**
- `onDidCreate` — debounced tree refresh
- `onDidDelete` — debounced tree refresh + remove path from `expandedPaths` if it was a directory
- `onDidChange` — ignored (file content changes don't affect tree structure)

**Debounce:** 300ms debounce on refresh to batch rapid changes (e.g., `git checkout` changing many files at once). Use a single timer shared across all watchers.

**Targeted refresh:** When possible, identify the parent directory of the changed file and fire `_onDidChangeTreeData` for that specific `FileItem` instead of `undefined` (full tree). This requires maintaining a map of `dirPath -> FileItem` for currently visible items. If the parent isn't in the map (collapsed directory), skip — the children will load correctly when the user expands it.

**Files affected:**
- `src/services/FileExplorerProvider.ts` — add watcher management
- `src/constants/explorer.ts` — add `WATCHER_DEBOUNCE_MS = 300`

## Work Stream 2: Source Control Webview

### Goal
Provide commit, push, pull functionality scoped to the current explorer root, with a changed files list and commit message suggestion.

### Design

New webview view `vscode-agentic.sourceControl` registered in the same `vscode-agentic` sidebar container, positioned below the explorer.

**View structure (top to bottom):**
1. Commit message text input (placeholder: "Commit message...")
2. Button row: Suggest (sparkle icon), Commit, Push, Pull
3. Changed files list with status letters and clickable file names

**Scoping:**
- The view tracks the same roots as the explorer
- When explorer scope changes, the source control view re-runs `git status` for the new root
- `FileExplorerProvider` exposes an event or method for the source control provider to subscribe to scope changes

**Git operations (all run in the scoped root directory):**

| Action | Command | Notes |
|--------|---------|-------|
| Suggest | `git diff --cached --stat` + `git diff --stat` | Parse filenames and stats to generate a short phrase like "update FileExplorerProvider, add watcher". If nothing staged, uses unstaged diff. |
| Commit | `git add -A && git commit -m "<message>"` | Stages all changes then commits. Message comes from the input field. Shows error if message is empty. |
| Push | `git push` | Shows error toast if no upstream. On success, shows info toast. |
| Pull | `git pull` | Shows error toast on conflict. On success, refreshes explorer and status. |

**Changed files list:**
- Populated by `git status --porcelain -z` parsed into `{status, path}` entries
- Each entry shows: status letter (M/A/D/?/R) + relative file path
- Clicking a file executes `vscode.commands.executeCommand('git.openChange', fileUri)` to open the built-in diff view
- List refreshes on file watcher events (debounced, same as explorer)

**Suggest heuristic (no AI):**
- Parse `git diff --stat` output to extract changed file basenames
- If 1-3 files: list them, e.g., "update FileExplorerProvider, explorerFileOps"
- If 4+ files: summarize, e.g., "update 7 files in services, features"
- If single directory: "changes in src/services"
- Prefix with action word based on status: "add" for new files, "update" for modified, "remove" for deleted, mixed = "update"
- User can always edit the suggestion before committing

**Webview communication:**
- Extension side: `SourceControlProvider` (new `WebviewViewProvider`)
- Webview sends: `{ type: "command", command: "commit" | "push" | "pull" | "suggest", data: { message?: string } }`
- Extension sends: `{ type: "update", data: { changes: FileChange[], suggestedMessage?: string, isLoading: boolean } }`
- Uses the same `postMessage` / `onDidReceiveMessage` pattern as `AgentPanelProvider`

**Webview UI:**
- React component in `src/ui/sourceControl/`
- Uses VS Code theme variables for all styling
- Codicons for button icons
- Input field styled to match VS Code's native input look

**Files to create:**
- `src/services/SourceControlProvider.ts` — webview provider, git command execution
- `src/ui/sourceControl/SourceControlPage.tsx` — React page component
- `src/ui/sourceControl/index.tsx` — entry point (acquireVsCodeApi, render)
- `src/ui/sourceControl/styles/sourceControl.css` — styles
- `src/constants/sourceControl.ts` — constants

**Files to modify:**
- `package.json` — add view declaration, activation event
- `src/extension.ts` — register new provider
- `src/services/FileExplorerProvider.ts` — expose scope change event for source control to subscribe

## Work Stream 3: Bug Fixes

### 3a. Silent `readDirectory` errors

**File:** `src/services/FileExplorerProvider.ts:248-263`
**Problem:** `readDirectory` catches all errors and returns `[]`. User sees an empty folder with no indication of failure.
**Fix:** On error, return a single placeholder `TreeItem` with label "(unable to read)" and no collapsible state. Use a dedicated class `ErrorPlaceholderItem` that extends `TreeItem`.

### 3b. Stale expanded paths

**File:** `src/services/FileExplorerProvider.ts:36`
**Problem:** When a directory is deleted externally, its path remains in `expandedPaths` and gets persisted.
**Fix:** On file watcher delete event, check if the deleted path is in `expandedPaths` and remove it. Also remove any child paths (paths that start with `deletedPath + sep`).

### 3c. No manual refresh button

**Problem:** No way to force-refresh if file watching misses something.
**Fix:** Add a refresh command `vscode-agentic.explorer.refresh` and register it as a view title button with `$(refresh)` icon in `package.json` menus under `view/title`.

### 3d. External drop partial failures

**File:** `src/services/FileExplorerProvider.ts:176-194`
**Problem:** When dropping multiple external files, if one fails the others may have succeeded. Only the failing file's error is shown.
**Fix:** Collect all errors during the loop, then show a single summary message: "Moved 2 of 3 files. Failed: filename.ts (reason)".

### 3e. Inconsistent paste conflict handling

**File:** `src/features/explorerFileOps.ts:163-166`
**Problem:** Cut-paste uses `overwrite: false` which throws on conflict, while copy-paste generates unique names. Inconsistent behavior.
**Fix:** For cut-paste, check if target exists before renaming. If conflict, show a quick pick: "Replace", "Keep Both" (generate unique name), "Cancel".

## Out of Scope

These were considered but deferred to keep scope focused:
- Git file decorations (colors/badges) in explorer tree items
- File search/filter in tree
- Collapse All button
- Hidden files toggle (dotfiles)
- AI-powered commit message suggestions
- Staging individual files (current flow is always `git add -A`)

## Technical Notes

- All git commands use `--no-optional-locks` for read operations per CLAUDE.md rules
- Git child processes use `spawn` with timeouts (10s for status, 30s for push/pull)
- The source control webview needs its own esbuild entry point (separate bundle from agent panel)
- CSP nonces generated fresh each render per CLAUDE.md security rules
