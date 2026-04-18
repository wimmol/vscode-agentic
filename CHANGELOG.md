# Changelog

## [0.6.4] - 2026-04-16

### Fixed

- **Worktree rollback** — Partial worktree creation now cleans up on failure instead of leaving orphaned branches/directories.
- **Orphaned terminals** — Creating a new terminal for an agent disposes the existing one first, preventing ghost processes.
- **Terminal cleanup on repo removal** — All agent terminals are closed before the repository is deleted from storage.
- **Send Prompt race condition** — Agent status is re-read after the input box to prevent queuing when the agent already finished.
- **Tool-use timeout** — Stale-detection no longer prematurely marks agents as idle while a tool is executing.
- **Tool-cycle status** — Assistant activity during tool-use cycles now keeps the agent status as RUNNING.
- **Context usage tokens** — Token count now sums uncached, cache-creation, and cache-read input tokens.
- **Shell quoting** — File paths sent to the terminal via the explorer are now properly quoted.
- **Source control error state** — Git status failures now clear the change list instead of showing stale data.
- **File watcher disposal** — Event subscriptions on file watchers are now explicitly tracked and disposed.
- **Git stdout safety** — Large git output is truncated at the buffer limit instead of growing unbounded.
- **Division by zero** — Context level guard for agents with zero total tokens.

### Changed

- **Agent tile selection** — Detail panel is now tied to the focused/selected agent instead of a separate expand toggle.
- **Tile styling** — Selected tile uses a subtle gray highlight; hover highlight removed.
- **Prompt compression** — Long prompts in the detail view collapse to first 3 + last 3 lines.
- **Worktree paths in UI** — Branch zones now carry their worktree path through to the agent tile detail view.
- **Source control watchers** — The source control panel auto-refreshes on file system changes.
- **Scoped commits** — Source control commits only the displayed changed paths instead of `git add -A`.
- **Error boundary** — Retry button replaces the static "check console" message.

## [0.6.0] - 2026-04-15

### Added


- **Agent templates** — Create reusable prompt templates (name + prompt) via Command Palette. Pick a template when creating an agent, or start blank.
- **Prompt queue** — Send prompts to running agents; they queue up and auto-execute sequentially when each task completes.
- **Session forking** — Fork an agent to a new branch with full branch picker. Context from the source agent carries over. Forked agents show a FORK badge.
- **Output summaries** — Agent tiles show a one-line summary of what the agent accomplished, parsed from the session when it finishes.
- **Context usage display** — Token usage shown as compact text (e.g. `47k / 1M`) with color thresholds (50% warn, 75% danger) and a thin progress bar on each tile.
- **Expandable agent tiles** — Click a tile to focus its terminal AND expand inline details: branch, worktree, context, full prompt, queued prompts, and action buttons (Send Prompt, Fork, Rename).
- **Agent notifications** — VS Code info/warning messages when agents finish or encounter errors.
- **Agent rename** — Rename agents from the expanded tile detail view via input box.
- **Strip XML tags** — Prompt previews on agent tiles now strip `<tag>` markup for clean readability.
- **Template commands** — `Agentic: Create Agent Template` and `Agentic: Remove Agent Template` in Command Palette.

### Changed

- **Agent names** — Replaced adjective-animal generator (e.g. "fuzzy penguin") with short human names (e.g. "Alice", "Max", "Leo").
- Removed hardcoded "Generate Documentation" and "Refactor" explorer actions in favor of user-defined templates.
- Removed `generateMdPrompt` and `refactorPrompt` settings (replaced by templates).

## [0.5.0] - 2026-04-15

### Fixed

- **Agent status on wrong tile** — When multiple agents shared a working directory, `/clear` in one agent could cause another agent to steal its session file, displaying the wrong agent's running status on the wrong tile
- **Timer showing 1000m+** — After extension reload, agents stuck in "running" status with stale `startedAt` timestamps now correctly transition to idle via stale detection
- **Session detection losing candidates** — Unclaimed session files were eagerly marked as known and permanently lost; now tracked as pending candidates for re-evaluation

### Changed

- License changed from Fair Source (FSL-1.1-MIT) to MIT

## [0.4.0] - 2026-04-15

### Added

- **Live file watching** — Explorer automatically reflects file changes from agents, git operations, and external tools without manual refresh
- **Source Control panel** — New sidebar section below the explorer with commit, push, pull, and commit message suggestion
- **Changed files list** — View modified/added/deleted files with status indicators; click to open VS Code's built-in diff view
- **Refresh button** — Manual refresh in the explorer title bar as a fallback

### Fixed

- Explorer now shows "Unable to read directory" placeholder instead of silently returning empty for unreadable directories
- Drop operations report a summary of failures instead of individual error messages per file
- Cut-paste shows Replace/Keep Both/Cancel picker when target already exists (previously threw silently)
- Stale expanded folder paths are cleaned up when directories are deleted externally

## [0.3.0] - 2026-03-15

### Added

- **Agentic Explorer** — Custom file explorer tree view in the sidebar with branch and worktree scoping
- File operations: new file, new folder, rename, delete, copy, cut, paste, copy path, copy relative path, reveal in Finder
- Keyboard shortcuts for explorer operations (copy, cut, paste, delete, rename)
- **AI-powered explorer actions** — Send to Claude, Generate Documentation, and Refactor via context menu
- Configurable prompts for Generate Documentation and Refactor actions
- Full worktree sync

## [0.2.0] - 2026-03-14

### Added

- Extension icon
- Fair Source License (FSL-1.1-MIT)

### Fixed

- Agent now reuses existing worktree instead of failing when worktree already exists
- Agent focus on create
- Settings configuration

### Changed

- Replaced SQLite storage with VS Code context-based storage

## [0.1.0] - 2026-03-13

### Added

- Initial release
- Manage AI agents across multiple repositories
- Git worktree-based isolation per agent
- Configurable agent command
- Sidebar panel with agent overview and explorer
