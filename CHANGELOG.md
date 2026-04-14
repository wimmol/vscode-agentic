# Changelog

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
