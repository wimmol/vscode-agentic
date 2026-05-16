# Changelog

## [v0.8.3] - 2026-05-16

### Fixed

- Catch already-running agentic-socket tmux servers up to the bundled conf on activation via `syncRunningServerSettings()` in `src/services/TmuxSession.ts`, so `mode-style` (blue selection) and `set-clipboard` (OSC52 copy) apply without restarting the server.


## [0.8.2] - 2026-05-16

### Fixed

- **Paste in tmux mode (text and images)** — `resources/agentic.tmux.conf` now sets `allow-passthrough on` so VS Code's image-paste escape sequences (iTerm2 OSC 1337 inline-image protocol) reach the inner Claude instead of being silently stripped by tmux 3.3+. `terminal-features` for `xterm-256color` additionally declares `bpaste` and `clipboard`, so pastes are forwarded as a single bracketed-paste chunk and OSC52 clipboard writes flow through.


## [0.8.1] - 2026-05-16

### Fixed

- **Empty terminals on VS Code reload** — VS Code's persistent terminal panel used to restore Agentic-named terminals from prior sessions whose underlying shell had already exited (or whose agent was removed while VS Code was closed). `TerminalService.restoreAll` now disposes any terminal whose name matches the Agentic tile pattern (`<agent> · <branch> (<repo>)`) but isn't in the current agent set, and any matching terminal whose `exitStatus` is set, before adopt-by-name runs. Adoption also rejects terminals with a non-undefined `exitStatus` so a dead shell is never inherited.

### Changed

- **tmux session naming follows the Agentic tile** — Sessions on the private `-L agentic` socket are now named `agentic-<agent>·<branch>(<repo>)` (with `.`, `:`, whitespace replaced by `_` to satisfy tmux's session-name rules) instead of `agentic-<agentId>`. `tmux ls` now lists Agentic sessions by the same descriptor shown on the tile / VS Code terminal tab. tmux helper APIs (`hasSession`, `killSession`, `newSessionShellArgs`, `attachShellArgs`) now take a fully built session name; `TerminalService` keeps an `agentId → sessionName` map alongside its terminal map so close / silent re-attach paths don't need to refetch the agent.
- **`tmuxSessionName(agentName, branch, repoName)`** — `src/constants/terminal.ts` exports the new builder plus `AGENTIC_TERMINAL_NAME_RE`, the canonical pattern used to recognise Agentic-owned VS Code terminals during startup cleanup.

### Migration

- Existing tmux sessions named `agentic-<uuid>` are no longer recognised by the new code; their VS Code attach client will be disposed on next reload by the empty-terminal cleanup. End them with `tmux -L agentic kill-server` (or just relaunch the agent) before relying on tmux mode after the upgrade.


## [0.8.0] - 2026-05-16

### Persistent tmux terminals — opt-in alternative to VS Code's built-in terminal

New `vscode-agentic.terminalMode` setting selects how agent terminals are hosted. Default mode is unchanged from 0.7.x. The new `tmux` mode runs each agent inside a private tmux session on the `-L agentic` socket so it survives VS Code reload, terminal pane close, and is reattachable from any SSH session on the same host. Design spec: `docs/superpowers/specs/2026-05-15-tmux-terminal-mode-design.md`.

### Added

- **`vscode-agentic.terminalMode` setting** — Enum `default | tmux`. `default` keeps the current behaviour (VS Code's built-in terminal, Claude session resumed by `sessionId` on reload). `tmux` launches each agent under `tmux new-session -A -s agentic-<agentId>` on the private `-L agentic` socket with a bundled `agentic.tmux.conf`. Switching modes wipes all agents (worktrees and branches are preserved on disk); a modal confirms before wiping and the setting reverts at its original scope if cancelled.
- **`resources/agentic.tmux.conf`** — Bundled, isolated tmux config: `prefix None`, `unbind-key -a`, `mouse on`, `history-limit 2000`, `status off`, `destroy-unattached off`, `remain-on-exit on`, `default-terminal "tmux-256color"`, `terminal-features ",xterm-256color:RGB"`, `extended-keys off`, `set-clipboard off`. Never reads the user's `~/.tmux.conf`.
- **`src/services/TmuxSession.ts`** — Thin tmux CLI helpers (`isInstalled` with module-level cache, `hasSession`, `killSession`, `newSessionShellArgs`, `attachShellArgs`, `confPath`, `showMissingDialog`). `new-session -A` is used for both fresh launch and post-reload restore — tmux's attach-or-create handles the branch transparently. `set-option @workdir <cwd>` is chained into the `new-session` argv via tmux's `;` command separator, so the diagnostic tag is applied atomically with session creation (no separate subprocess, no race).
- **`src/features/wipeAgentsOnModeChange.ts`** — Modal-confirmed wipe on `terminalMode` change. Closes terminals (incl. tmux session kill), deletes agent rows in parallel via `Promise.all`, preserves worktrees and branches. Reverts the setting at the same `ConfigurationTarget` (Folder / Workspace / Global) where the user changed it on cancel or when tmux is missing.
- **`checkAvailable()` precheck on `TerminalService`** — Called by `addAgent` and `launchAgent` before any state mutation. In tmux mode, probes `tmux -V` and shows a shared `showMissingDialog` (Install tmux button → opens `https://github.com/tmux/tmux/wiki/Installing`, Open settings button → opens the `terminalMode` setting) if tmux is missing. Cancels agent creation before any orphan rows can land.
- **Silent re-attach in tmux mode** — When the VS Code terminal pane closes while the underlying tmux session is still alive (`tmux has-session`), `onTerminalClosed` creates a fresh attach client in the background (no `.show()`) and replaces the stale entry in the agent map. The dialog is only triggered when the tmux session itself is gone.
- **Constants** — `TERMINAL_MODE_DEFAULT` / `TERMINAL_MODE_TMUX` / `TerminalMode` type, `TMUX_SOCKET_LABEL`, `TMUX_CONF_RELATIVE_PATH`, `TMUX_SESSION_PREFIX`, `TMUX_INSTALL_URL`, `tmuxSessionName(agentId)` in `src/constants/terminal.ts`; `ENV_CLAUDE_DISABLE_MOUSE` + `TMUX_TERMINAL_ENV` in `src/constants/agent.ts`; `TMUX_EXEC_TIMEOUT_MS = 5000` in `src/constants/timing.ts`; `BTN_INSTALL_TMUX`, `BTN_SWITCH_AND_WIPE`, `BTN_OPEN_SETTINGS` in `src/constants/messages.ts`.

### Changed

- **`TerminalService` constructor** — Now takes `tmuxConfPath: string` (pre-computed by `extension.ts` via `tmux.confPath(context.extensionUri.fsPath)`) so the service does not need to know about the `resources/` layout.
- **`TerminalService.closeTerminal` semantics** — Full teardown for external callers (worktree close, agent remove, repo remove): disposes the VS Code attach client AND kills the tmux session (idempotent). The internal "close-previous-before-create" use case in `createTerminal` was extracted to a new private `disposeTerminalRef`, which only drops the VS Code reference and leaves the tmux session alive.
- **`clearAgentState` private method** — Extracted from three duplicate `terminals.delete` + `stopDetecting` + `sessionWatcher.stopWatching` triplets in `onTerminalClosed`, programmatic teardown, and `checkTerminalHealth`.
- **Mouse-wheel scroll in tmux mode** — `CLAUDE_CODE_DISABLE_MOUSE=1` is set in the spawned terminal env (`TMUX_TERMINAL_ENV`) so wheel events flow to tmux and enter copy-mode for scrollback. Trade-off: mouse-click selection inside Claude's TUI no longer works; Claude is keyboard-driven so this is acceptable for the persistence win.

## [0.7.0] - 2026-04-28

### Sidebar redesign — "Observatory"

Full visual + interaction redesign of the Agentic sidebar. Shipped in three phases: Phase 1 visual-only (tokens, typography, new atoms/molecules), Phase 2 data-model (selected worktree per repo, template colour + default flag, short agent-text fields), Phase 3 behaviours (one-click launch with CLAUDE.md write, merge worktree, local summariser, template editor panel). Design spec: `docs/superpowers/specs/2026-04-19-sidebar-redesign-observatory-design.md`.

### Added

- **Observatory design system** — Hardcoded dark palette in `design-tokens.css` (`--obs-*`), Geist + Geist Mono + Instrument Serif loaded via a CSP-widened webview `<link>`, 10-swatch template palette, status rails for running/idle/error.
- **Agent tile rewrite** — 3-row layout (`[tpl-label] name time / prompt-line / main-text ctx-badge`), 2-line clamp on main text, `MM:SS` running timer, `2m 14s`-style finished duration, right-side hover actions (`send`, `fork`, `rename`, `trash`) via `TileActions`, selected state is a background tint + accent border (no rail change).
- **ContextBadge** — Pure-text `47k/1M` context display with colour thresholds at 50% (amber) and 75% (coral). No bar, no percent.
- **Template launcher row** (`LaunchRow` + `TemplateChip`) — Horizontal-scroll chip strip with fade-mask edges and a trailing manage-gear button. Default template renders first and filled; other chips are ghost pills.
- **Worktree tabs** (`WorktreeTabs`) — File-tab strip with a `+` tab-slot for new worktree and a dashed action bar scoped to the active tab (Merge + Delete). Exactly one worktree open per repo at a time; current branch is always visible.
- **Empty states** — Italic `No agents. Pick a template.` and centred dashed `⊕ WORKTREE` row that creates the first worktree on click.
- **One-click template launch** — `launchAgent(repoId, branch, templateId)` feature bypasses the branch quick-pick and the template picker; the chip row already knows the scope's branch (repo current vs selected worktree). The template's `prompt` is written to `<worktreePath>/.claude/CLAUDE.md` so it layers as a per-worktree system prompt over the project root's `CLAUDE.md`; skipped on the repo's main branch. `templateName` + `templateColor` are snapshotted onto the agent record so tile colour survives template rename/delete.
- **Dedicated `+ worktree`** — `newWorktree(repoId)` creates just the worktree with a pre-filled unique `tree-N` branch name. Does not spawn an agent; spawning is driven from the per-scope launch row afterwards.
- **Template editor webview** — Own React bundle (`src/ui/templateEditor/`) opened via `vscode-agentic.manageTemplates` in the editor area (not the sidebar). Two-column layout: template list with `+ New template`, form with name / multi-line system prompt / 10 colour swatches / `Default` toggle / Save / Delete. New storage methods `updateTemplate`, `setDefaultTemplate`, `getTemplate`. Replaces the prior quick-pick `Create Agent Template` / `Remove Agent Template` commands.
- **Merge worktree** — `mergeWorktree(repoId, branch)` feature runs `git merge --no-ff --no-edit <branch>` into the repo's current branch. Refuses when any agent on the worktree is running; confirms via a modal dialog; on conflicts, offers an "Abort merge" path and logs full stderr to the output channel. Backed by new `mergeBranch` + `abortMerge` helpers in `GitService`.
- **Local summariser** — `SummariserService` lazy-loads `@xenova/transformers` + `Xenova/distilbart-cnn-6-6` on first use, caches the model in `globalStorageUri/transformers/`, shows a single `withProgress` notification on first download (~75 MB). Per-(agent, kind) debounce so the model doesn't fire during streaming; serialised inference chain; truncation fallback on any failure — never surfaces errors to the user. New `Agent.lastPromptShort` / `outputShort` fields; tiles prefer the short version when present.
- **Configuration** — New `contributes.configuration` keys: `agentic.summariser.enabled` (default `true`), `.thresholdChars` (320), `.stabilityMs` (2000).
- **Protocol version bump** — Webview envelope carries `PROTOCOL_VERSION = 2`; mismatched cached webview state resets on first update.
- **New commands and messages** — `CMD_LAUNCH_TEMPLATE`, `CMD_MANAGE_TEMPLATES`, `CMD_NEW_WORKTREE`, `CMD_MERGE_WORKTREE`, `CMD_SELECT_WORKTREE`; retired `CMD_TOGGLE_ZONE_EXPANDED`.

### Changed

- **Snapshot shape** — `RepoWithZones` → `RepoWithScopes`: `{ currentAgents, worktrees: [{branch, path, agentCount, agents}], selectedWorktreeBranch }`. `agents` is populated only for the selected worktree; others ship empty to keep the payload small.
- **`Repository.selectedWorktreeBranch`** — Drives the worktree tab state. Resolved in the snapshot to most-recent worktree when unset or stale; cleared automatically when the pointed-at worktree is removed. Webview dispatches `CMD_SELECT_WORKTREE` on tab click.
- **`AgentTemplate.color` + `isDefault`** — User-settable per template; lazy-migrated on read (missing colours picked from palette by index; the first template becomes default if none is marked). `addTemplate` accepts `{color?, isDefault?}`; `setDefaultTemplate` enforces the single-default invariant; `removeTemplate` promotes the first survivor when the default is deleted.
- **Agent fields** — Added `templateColor` (hex snapshot at launch) and `lastPromptShort` / `outputShort` (local-summariser output). `Repository` and `Agent` readers normalise defaults so old stored records keep working without an explicit migration.
- **`addAgent` signature** — `launchAgent` writes `templateName` / `templateColor` atomically through `storage.addAgent`'s initial options bag instead of a follow-up `updateAgent` call. The standalone `addAgent` feature now takes only `repoId`; the legacy `initialPrompt` / `branchHint` / `seed` parameters are gone.
- **`StateStorage.updateAgent`** — Accepted fields derived from a single `AGENT_SCALAR_FIELDS` tuple (one source of truth); no-op comparison covers the new short fields and short-circuits when nothing changed, so SessionWatcher polls don't broadcast fresh references.
- **`sendPrompt`** — Terminal stays in the background (no `terminal.show()`); the tile's `lastPrompt` + `startedAt` update immediately so the UI doesn't show stale state while SessionWatcher parses the new turn.
- **Tile ordering** — Agents sort by `createdAt` (oldest first) inside every scope and never reorder when status or fields change.
- **`AgentPanelProvider`** — Templates are re-sent over the wire only when a cheap signature diff indicates they actually changed; agent-state-only pushes reuse the previous templates reference.
- **Activation hot path** — `setContext(vscode-agentic.hasRepos)` only dispatches when the boolean flips (not on every agent mutation); `refreshCurrentBranches` runs per-repo git calls in parallel; `syncWorktrees` batches add/remove writes.
- **Summariser lifecycle** — `SummariserService.cancel(agentId)` fires from `SessionWatcher.stopWatching`, so pending inference doesn't hit deleted agents.
- **Fonts in webview CSP** — `style-src` / `font-src` now include `fonts.googleapis.com` and `fonts.gstatic.com`; nonces are regenerated per render.
- **Retired** — `STORE_ZONE_EXPANDED`, `toggleZoneExpanded`, the hash-based `templateColor(name)` utility (replaced by stored `template.color` + fallback), the `createTemplate` / `removeTemplate` quick-pick commands, `manageTemplates.ts` feature, unused `EmptyState` / `StatusIcon` / `TruncatedText` atoms and `ZoneHeader` molecule.
- **Repo block visual separation** — `.repo-head` now sits on a `--obs-bg-surface` strip with its own hairline, name bumps to 15px on a 40px row; `.repo` blocks are separated by a 4px `--obs-bg-inset` gutter plus a strong inset hairline (`.repo:last-child` drops the trailing gutter).

### Removed

- **Fork agent feature** — `forkAgent` command, `CMD_FORK_AGENT` / `LABEL_FORK_AGENT` / `LABEL_FORK` constants, `forkAgentMessage`, the fork action button on `AgentTile`, and the `Agent.forkedFrom` field (with its row in `AGENT_SCALAR_FIELDS`). Persisted agents that still carry `forkedFrom` in `globalState` are stripped on the next normalize/write — no migration required.

### Fixed

Bug-fix pass on `staging` prior to the Observatory redesign (referenced by issue numbers from the now-removed `BUGFIX.md` audit of 84 reports).

- **Terminal wipe on activation** — `TerminalService.restoreAll` no longer disposes pre-existing non-Agentic terminals (BUGFIX #1, P0).
- **External drop data loss** — Files dragged from Finder/Explorer are now copied with scheme filtering and per-item error handling, not moved (BUGFIX #2, #10, #37, P0).
- **Paste ignoring OS clipboard** — Paste now falls back to `vscode.env.clipboard` when the internal clipboard is empty (BUGFIX #3, P0).
- **Placeholder current branch** — The real current branch is resolved via `git symbolic-ref --short HEAD` instead of storing the literal `"current"` (BUGFIX #4, P1).
- **Workspace settings mutation** — Root-click handlers no longer write to `terminal.integrated.cwd` (BUGFIX #5, P1).
- **State scope** — Cross-workspace data moved to `globalState`; UI state stays in `workspaceState` (BUGFIX #6, P1).
- **Schema versioning** — Added `schemaVersion` key and migration hook on activation (BUGFIX #7, P1).
- **Window restart on empty workspace** — `addRepo` no longer forces a workspace-folder insert that kills the extension host (BUGFIX #8, P1).
- **Webview listener leaks** — Providers now dispose prior subscriptions before re-subscribing on `resolveWebviewView` (BUGFIX #9, P1).
- **StateStorage write races** — All mutators serialize through an async write lock (BUGFIX #15, P1).
- **Per-repo worktree mutex** — `git worktree add/remove/ensureBranch` are serialized per repo path (BUGFIX #16, P2).
- **Localized git error matching** — Error paths no longer key off English-only substrings (BUGFIX #17, P2).
- **Whitespace prompts** — `sendPrompt` rejects whitespace-only input (BUGFIX #19, P2).
- **Partial-failure rollback** — `addAgent` rolls back worktree + metadata when downstream steps fail (BUGFIX #20, P2).
- **ErrorBoundary in Source Control** — The source control webview is now wrapped in the shared error boundary (BUGFIX #21, P2).
- **SessionWatcher logging** — Silent `catch {}` replaced with structured logger output (BUGFIX #24, P2).
- **Webview message validation** — `WebviewToExtensionMessage` is a discriminated union validated at the handler boundary (BUGFIX #25, #84, P2).
- **Watcher noise** — Source control watcher filters `.git/**` and `node_modules/**` (BUGFIX #26, P2).
- **Status rename path** — `gitStatus` preserves the rename source so UI can render `old → new` (BUGFIX #29, P3).
- **Staged vs unstaged status** — `gitStatus` reports index and worktree status separately (BUGFIX #30, #31, P2).
- **Empty-area paste menu** — `New File` / `New Folder` / `Paste` now appear on the scope-header (empty-area) context menu (BUGFIX #13, P2).
- **Command enablement** — Commands use `setContext` + `enablement` (e.g. `vscode-agentic.hasRepos`) to hide when unavailable (BUGFIX #43, P3).
- **Push conflict UX** — Failed `git push` offers a Pull-and-retry action (BUGFIX #33, P3).
- **Explorer persist on dispose** — Pending persist timer is flushed before disposal (BUGFIX #36, P3).
- **Global `user-select: none`** — Removed from body; text is selectable again (BUGFIX #47, P3).
- **Hardcoded colors** — Replaced `rgba(...)` literals with VS Code theme variables (BUGFIX #48, P3).
- **Structured logging** — Added `LogOutputChannel` (`Agentic`); replaced `console.*` on hot paths (BUGFIX #49, P3).
- **Webview tsconfig coverage** — `src/utils/` is now in the webview `include` (BUGFIX #52, P3).
- **Hours in `formatTime`** — Long-running agents render as `Hh Mm Ss` (BUGFIX #57, P4).
- **Divide-by-zero in context usage** — Tile renders gate on `total > 0` (BUGFIX #61, P3).
- **Name generator short-circuit** — Falls through to the suffix branch when all names are taken (BUGFIX #62, P4).
- **CSP `img-src`** — Added to webview CSP (BUGFIX #63, P4).
- **ADR directory** — Added `docs/decisions/` with the initial globalState ADR (BUGFIX #76, P4).
- **Protocol version** — Messages now carry a `PROTOCOL_VERSION` for forward-compatible handshakes (BUGFIX #83, P4).

### Known remaining

- No integration tests yet (BUGFIX #12), no `tsc --noEmit` publish gate (BUGFIX #51), Windows shell quoting (BUGFIX #14), and other P3/P4 items remain open — see `BUGFIX.md` for the full backlog.

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
