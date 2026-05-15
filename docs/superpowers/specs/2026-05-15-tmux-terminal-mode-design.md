# Tmux terminal mode — design

*Date: 2026-05-15*

Adds an opt-in **tmux** terminal mode to the Agentic VS Code extension.
The default mode stays byte-identical. When `vscode-agentic.terminalMode`
is set to `tmux`, each agent runs inside a detached tmux session on a
dedicated socket (`-L agentic`) so it survives VS Code reload, terminal
close, and is reattachable from any SSH client on the same host.

## Settled decisions

1. **Setting key:** `vscode-agentic.terminalMode` — enum `default` | `tmux`,
   default `default`.
2. **Missing tmux:** block. Show an error dialog with an "Install tmux"
   button (opens `https://github.com/tmux/tmux/wiki/Installing`).
3. **Restore on reload:** if `tmux has-session` is alive → attach (Claude
   keeps running). If dead → start fresh tmux session and run
   `claude --resume <sessionId>` inside it. Strict 1:1:1:1 mapping:
   tile ↔ agent row ↔ Claude session ↔ tmux session.
4. **Setting change:** wipe all agents on confirm — close terminals,
   kill tmux sessions, delete Agent rows. **Worktrees and branches stay
   on disk.** No per-agent mode field; the global setting is the single
   source of truth.
5. **Scope:** launch + restore + cleanup + scrollback-via-conf. No
   pipe-pane log file, no capture-pane preview UI.
6. **Session name:** `agentic-<agentId>` (UUID from existing Agent row).

## Architecture

```
package.json
  contributes.configuration:
    vscode-agentic.terminalMode: enum ["default","tmux"], default "default"

resources/agentic.tmux.conf          (new, static, packaged in VSIX)

src/constants/terminal.ts            (extended)
  TERMINAL_MODE_DEFAULT, TERMINAL_MODE_TMUX
  TMUX_SOCKET_LABEL = 'agentic'
  tmuxSessionName(agentId)

src/constants/views.ts               (extended)
  CONFIG_TERMINAL_MODE = 'terminalMode'

src/services/TmuxSession.ts          (new, pure, no vscode imports)
  isInstalled, hasSession, killSession, listAgenticSessions,
  newSessionShellArgs, attachShellArgs, tagWorkdir, confPath

src/services/TerminalService.ts      (surgical edits)
  createTerminal: branch on mode → tmux uses shellPath:'tmux' + new-session -A
  restoreAll: for tmux agents, hasSession check before fresh create
  closeTerminal: kill tmux session before disposing VS Code terminal
  onTerminalClosed: in tmux mode, silently re-attach if session alive

src/features/wipeAgentsOnModeChange.ts (new)
  Modal confirmation; on confirm wipe all agents (terminals + tmux + rows)
  preserving worktrees/branches. On cancel revert setting.

src/extension.ts                     (small edit)
  onDidChangeConfiguration for terminalMode → wipeAgentsOnModeChange
```

## Data flow

### Launch (tmux mode)

1. `TerminalService.createTerminal({...})` called.
2. Read mode from config. If `tmux`: call `TmuxSession.isInstalled()`.
3. If not installed: `showErrorMessage` with "Install tmux" button.
   Throw — caller already wraps in try/catch.
4. Build the claude command (existing `buildCommand`).
5. `vscode.window.createTerminal({ shellPath:'tmux', shellArgs: newSessionShellArgs(...) })`.
   The `new-session -A -s agentic-<id>` form is attach-or-create.
6. After terminal exists, `TmuxSession.tagWorkdir(agentId, cwd)` writes
   `@workdir` session option for diagnostic cleanup.
7. SessionWatcher detection unchanged — Claude still writes the same
   JSONL session file.

### Restore on reload (tmux mode)

In `restoreAll`, for each agent in tmux mode:
1. `TmuxSession.hasSession(agentId)`.
2. If alive: create VS Code terminal with `attachShellArgs` (no claude
   command — tmux already has Claude running).
3. If dead: fall through to existing `recreateFromAgent` path which
   calls `createTerminal` → that itself runs in tmux mode, starts fresh
   tmux session, runs `claude --resume <sessionId>`.

### User closes VS Code terminal tab (tmux mode)

`onTerminalClosed` distinguishes detach from death:
1. If `removing` flag set: programmatic delete, do nothing extra.
2. Else if `tmux has-session` alive: user just detached. Silently
   re-create the attach terminal in background (no `.show()` — stays
   invisible until user clicks the agent tile). Keep agent status.
3. Else: tmux session died too — same dialog as default mode
   (Remove / Reopen).

### Agent deletion (tmux mode)

`closeTerminal(agentId)` is called by the UI delete flow. In tmux mode:
1. `TmuxSession.killSession(agentId)` (ignore "not found" errors).
2. Dispose VS Code terminal (existing logic).
3. Existing worktree cleanup from `onTerminalClosed` continues to run.

### Setting change (`terminalMode` flips)

`extension.ts` already has an `onDidChangeConfiguration` block. Add:
1. Compare new mode to cached previous mode. If unchanged: no-op.
2. If agents exist: `showWarningMessage` modal:
   - "Switching terminal mode will close all agents and reset their
     state. Worktrees and branches will be kept on disk. Continue?"
   - Buttons: "Switch and wipe agents", "Cancel"
3. On confirm: for each agent, `terminalService.closeTerminal(id)`
   (kills tmux session + disposes terminal), then
   `storage.removeAgent(id)`. Update cached previous mode.
4. On cancel: write previous value back via
   `config.update(KEY, oldValue, ConfigurationTarget.Workspace)`.

## `resources/agentic.tmux.conf`

```tmux
# Isolated socket (-L agentic) — never reads user's ~/.tmux.conf

set -g default-terminal "tmux-256color"
set -as terminal-features ",xterm-256color:RGB"

# No prefix — Claude owns key input; VS Code owns chord like Ctrl-B.
unbind-key -a
set -g prefix None

# Wheel scrolling works via mouse mode.
set -g mouse on

# Small history — user requested "scroll but don't need large history".
set -g history-limit 2000

# Single-client viewport policy + redraw on attach.
set -g window-size latest
setw -g aggressive-resize on

# No status bar — saves a row, prevents Claude fullscreen clipping.
set -g status off

# Don't disable session on last detach — that's the whole point.
set -g destroy-unattached off
set -g remain-on-exit on

# Avoid csi-u — breaks Claude's bracketed paste.
set -s extended-keys off

# Don't touch the user's clipboard.
set -g set-clipboard off
```

Claude env: `CLAUDE_CODE_DISABLE_MOUSE=1` is set when spawning so
wheel events go to tmux scrollback instead of Claude's renderer.

## Error handling

- `tmux` not installed → `showErrorMessage` with "Install tmux" button,
  throw from `createTerminal`. Caller's try/catch surfaces the failure.
- `tmux has-session` exits non-zero (normal "not found") → treat as
  false. No log entry.
- `tmux kill-session` failures → log at `trace` level, swallow.
  Deleting an agent must never fail because of tmux exit code.
- `tagWorkdir` failures → log at `trace`, swallow. Tagging is
  diagnostic-only; missing tag doesn't break the feature.

## Testing

- Pure helpers in `TmuxSession.ts` (`newSessionShellArgs`,
  `attachShellArgs`, `tmuxSessionName`) are easy to unit-test, but the
  project has no test harness yet. **Not adding one in this PR** —
  scope creep. The helpers are simple enough to verify by inspection.
- Manual verification path documented in the PR description:
  1. Set `terminalMode=tmux`, launch agent, confirm `tmux -L agentic ls`
     shows `agentic-<id>`.
  2. Reload VS Code window — agent re-attaches, no spinner restart.
  3. Close terminal tab — agent silently re-attaches when tile clicked.
  4. Delete agent from UI — `tmux ls` shows session is gone.
  5. SSH attach: `tmux -L agentic attach -t agentic-<id>` from another
     shell — see live agent.
  6. Wheel scroll — see prior conversation.
  7. Flip setting to `default` — modal warns, on confirm all agents
     gone, worktrees intact.
  8. Uninstall tmux, set mode to tmux, try to create agent — clear
     error with "Install tmux" button.

## Files touched

| File | Change |
| --- | --- |
| `package.json` | + `vscode-agentic.terminalMode` enum setting |
| `resources/agentic.tmux.conf` | **new** static config |
| `src/constants/terminal.ts` | + mode constants, session-name helper |
| `src/constants/views.ts` | + `CONFIG_TERMINAL_MODE` |
| `src/services/TmuxSession.ts` | **new** pure helpers |
| `src/services/TerminalService.ts` | branch on mode in 4 methods |
| `src/features/wipeAgentsOnModeChange.ts` | **new** feature handler |
| `src/extension.ts` | + setting-change wiring |

## Out of scope (explicit)

- `pipe-pane` log file
- `capture-pane` UI preview
- zellij / screen / dtach backends
- Windows-native tmux support (require WSL)
- Reboot survival via tmux-resurrect/continuum
- Per-agent mode field (single global mode is authoritative)
