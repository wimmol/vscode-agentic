# Persistent terminal sessions for Agentic's Claude TUI mode

*Researched 2026-05-15.* (depth: deep)

## TL;DR

Add an opt-in **detached mode** that runs Claude inside **tmux 3.6 on a
dedicated socket (`tmux -L agentic`)** with a bundled `agentic.tmux.conf`
that strips the prefix, disables mouse, and forces a single
`window-size latest` policy. VS Code attaches with
`vscode.window.createTerminal({ shellPath: 'tmux', shellArgs: ['-L','agentic','attach','-t','agent-<id>'] })`;
the user can attach the same session from any SSH client with the same
command. Keep the current `createTerminal()`+`claude -r <sessionId>`
flow as the default. Reject zellij (smallest-client resize, alt-screen
scrollback, AI-TUI crash bugs); reject screen (GPLv3 bundling
contagion); reject dtach/abduco (no scrollback capture, no
multi-client size handling, ~2018 last release).

## Why tmux (top 3)

1. **It's the only candidate that gives you all five required
   properties at once:** scriptable session lifecycle (`new-session
   -A`, `has-session`, `kill-session`, `list-sessions -F`),
   multi-client attach with per-client viewports (`window-size latest`
   + `aggressive-resize on`), out-of-band scrollback capture
   (`capture-pane -p`, `pipe-pane`), permissive ISC license safe to
   bundle, and a documented (if imperfect) track record with
   Anthropic's Ink/fullscreen renderer.
2. **Every Claude Code rough edge under a multiplexer has a known
   tmux-side workaround Anthropic itself references.** Mouse capture
   ([#38810](https://github.com/anthropics/claude-code/issues/38810)),
   bracketed-paste newline loss
   ([#43169](https://github.com/anthropics/claude-code/issues/43169)),
   fullscreen clipping under tmux status bar
   ([#51497](https://github.com/anthropics/claude-code/issues/51497)),
   and flicker ([#37076](https://github.com/anthropics/claude-code/issues/37076))
   are all addressable from one config file you control — *if* you ship
   your own conf on your own socket so user defaults don't override
   you.
3. **The single-server blast radius — tmux's biggest architectural
   weakness — is neutralized by `-L agentic`.** Putting Agentic on a
   private socket isolates a server crash to *your* agents and prevents
   your config from leaking into the user's everyday tmux. This is the
   same isolation pattern that mosh-server, byobu, and tmuxinator
   converged on after years of complaints.

## Alternatives considered

- **zellij (0.43/0.44).** Disqualifying for this use case: alt-screen
  has no scrollback by design (intentional, no escape hatch), all
  clients shrink to the smallest attached size with no per-client
  override, and session resurrection is reported "completely
  non-functional" in 0.42–0.43.1 even with serialization enabled. AI
  TUIs are visibly broken: OpenAI Codex needed an upstream zellij patch
  ([codex #8555](https://github.com/openai/codex/pull/8555)) to render
  at all, and the follow-up
  [#10331](https://github.com/openai/codex/issues/10331) is still
  open. Crash bugs accumulating: `WouldBlock` panic
  ([#4452](https://github.com/zellij-org/zellij/issues/4452)),
  attach-after-detach crash
  ([#4490](https://github.com/zellij-org/zellij/issues/4490)).
- **GNU screen 5.0.1.** A real 2024 rewrite, but **GPLv3+** — bundling
  it transitively makes the relevant parts of your extension GPL.
  Assume-installed only. UTF-8 + mouse handling remain known-bad
  ([HN 26081428 remote-DoS thread](https://news.ycombinator.com/item?id=26081428)
  keeps getting re-cited), and packagers are dropping it. No upside
  over tmux for new code.
- **dtach 0.9 / abduco 0.6.** Trivially bundleable, zero deps, no
  prefix to fight. *But*: no scrollback capture API (kills your "show
  agent output in the webview" use case), resize semantics are
  "last attached wins" (breaks dual-attach from VS Code + SSH
  simultaneously), last releases 2016/2018. Fine for a `make` job —
  wrong tool for a long-running TUI agent fleet.
- **WezTerm `wezterm-mux-server`.** Works *if* both endpoints run
  WezTerm. You don't control the user's terminal, so this fails the
  "user attaches via plain SSH" requirement. Pass.
- **Mosh.** Not a multiplexer. It's a roaming UDP client. Mosh +
  tmux is the canonical pair, but mosh alone doesn't persist
  server-side state. Don't substitute for tmux.

## Gotchas

The ones that *will* bite you, drawn from production reports:

- **Zombie sessions consume memory indefinitely.** glibc doesn't
  return freed history arenas to the OS; tmux #4029, #1261, and Claude
  Code [#4851](https://github.com/anthropics/claude-code/issues/4851)
  all describe RSS growth over weeks. Mitigation: cap
  `history-limit 10000` in your conf (default is 2000, but agents
  generate dense output and users tend to crank this up); ship a
  manual "restart tmux server" command; never auto-kill on activation.
- **Single-server crash takes down every Agentic agent.** Use
  `-L agentic` to scope blast radius to your extension; on activation,
  `tmux -L agentic list-sessions` and re-attach what survived; for the
  rest, fall back to your existing `claude -r <sessionId>` resume.
- **`@workdir`-tagged orphan cleanup.** Always `tmux set-option -t
  agent-<id> @workdir <repoPath>` at session create. Never kill a
  session you didn't tag. Cron-based reapers are widely regretted —
  put cleanup behind an explicit user command and a confirmation, not
  on a timer ([tmux #3083](https://github.com/tmux/tmux/issues/3083)).
- **`csi-u` bracketed-paste eats newlines in Claude.** Confirmed bug
  ([claude-code #43169](https://github.com/anthropics/claude-code/issues/43169)).
  Don't set `extended-keys-format csi-u` in your bundled conf.
- **Mouse mode trade-off.** `set -g mouse on` lets tmux scroll
  *outside* alt-screen but Claude's fullscreen renderer captures wheel
  events. Anthropic's recommendation
  ([fullscreen docs](https://code.claude.com/docs/en/fullscreen)) is
  `mouse on` plus `Ctrl+o`/`[` to dump transcript to scrollback. If
  your users complain, expose a setting that flips
  `CLAUDE_CODE_DISABLE_MOUSE=1` per agent.
- **VS Code intercepts Ctrl-B.** Default keybinding is "Toggle
  Sidebar". You don't need a prefix at all (Claude owns the screen),
  so set `prefix None` + `unbind-key -a` in your conf. If you ever
  want a prefix back, the cleanest fix is to push
  `-workbench.action.toggleSidebarVisibility` into
  `terminal.integrated.commandsToSkipShell` from `activate()`.
- **`tmux send-keys` for programmatic prompt delivery.** Use `-l`
  (literal) for text and send Enter as a *separate* `send-keys`
  invocation; insert ~300 ms between them or Claude treats the newline
  as still-typing
  ([claude-code #15553](https://github.com/anthropics/claude-code/issues/15553)).
- **systemd login-session reaping.** `KillUserProcesses=yes` /
  `RemoveIPC=yes` will silently kill the tmux server on logout
  ([systemd #12981](https://github.com/systemd/systemd/issues/12981)).
  Document this in the extension's README — users who SSH in/out
  expecting persistence will be surprised. The fix is
  `loginctl enable-linger <user>`, not anything you can ship.
- **`has-session` race.** Between `has-session` and `attach`, the
  server can die. Always use `new-session -A -s NAME` (attach-or-create
  in one command) so the server is implicitly respawned.
- **WSL / ConPTY strips OSC + curly underlines.** If you support
  Windows, document that the detached mode runs better in WSL terminal
  than in cmd.exe ([tmux #4668](https://github.com/tmux/tmux/issues/4668)).

## What's changed recently (last 12-18 months)

- **tmux 3.5 (2024-10) → 3.6 (2025-12).** Default `escape-time` 10 ms
  (snappier TUIs), native `pane-scrollbars`, multi-line status, Mode
  2031 dark/light reporting, `server-access` ACLs, richer Unicode
  (regional indicators, emoji modifiers). For your use case the
  practical wins are the snappier escape time and ACL-based access if
  you ever expose the socket across users.
- **zellij 0.42 → 0.44 (2025-03).** Stacked resize, web client,
  Windows native (alpha), Remote Sessions, CLI automation, plugin API
  protobuf serialization. Capability has expanded but stability for
  long-running AI agents hasn't caught up — see crash issues above.
- **A whole subgenre of "tmux for agents" wrappers appeared in
  2025.** `amux`, `smux`, `wmux`, `ccmux`, `Termdock` — all are
  tmux-backed control planes for Claude Code / Codex / Gemini CLI
  sessions, none replace tmux itself. Worth reading `amux` and `ccmux`
  source for orchestration patterns. The community converged on tmux
  for this exact job.
- **Anthropic's "Effective harnesses for long-running agents" (2025)
  and the multi-session Agent SDK / Routines (2025-11)** signal a
  shift toward managed-infrastructure persistence rather than
  tmux-as-substrate. Worth tracking, but tmux remains the de-facto
  community choice for local parallel agents.
- **Anthropic's Fullscreen mode (v2.1.89+, 2026-04).** Custom React
  renderer that replaces Ink; meant to fix flicker and resize drift.
  Mouse mode is now first-class. Adjust your bundled conf
  expectations: don't disable mouse globally — only per-agent if user
  reports issues.

## Contrasting viewpoints

- **"Zellij is the modern choice."** True for casual users; provably
  false for AI TUI hosts as of 2026-05. The alt-screen + smallest-client
  resize + AI-TUI bug pattern is structural, not a bug to be fixed in
  a point release. If you wait 12 months and re-evaluate, the alt-screen
  policy in particular is unlikely to change — it's an intentional
  xterm-spec position the maintainers have defended publicly.
- **"Just use `nohup` / `setsid` / `disown`."** Repeatedly proposed
  by users new to the problem; doesn't work for an interactive TUI
  that needs an attached PTY. Background processes lose their
  controlling terminal and Claude exits or hangs. tmux/screen own the
  PTY; you cannot replicate this with shell builtins.
- **"Bundle our own tmux binary."** Tempting (version skew is real
  per tmux #4756) but the lesson from mosh-server-style bundling is it
  breaks `~/.tmux.conf` expectations and confuses `pgrep tmux` based
  tooling. Assume-installed + a clear install prompt
  (`vscode.window.showErrorMessage` with an "Install tmux" action) is
  the practical answer. The `-L agentic` socket already isolates your
  config from theirs; that's the bundling problem solved without
  shipping a binary.
- **"Use a `Pseudoterminal` API instead of `shellPath: tmux`."**
  Better in theory (you can intercept bytes, stream to webview), worse
  in practice — you reimplement resize, signal forwarding, shell
  integration markers. Stick with `shellPath: tmux` for the attach;
  capture output out-of-band with a separate `execFile('tmux',
  ['capture-pane', ...])` from your code. This is what every
  production VS Code tmux extension lands on (see
  `kargnas/vscode-ext-tmux-worktree`'s `tmuxBackend.ts`).

## Open questions

- **How well does the fullscreen renderer (v2.1.89+) actually behave
  under tmux on reattach with mixed client sizes?** Mixed reports;
  not yet corroborated by official changelog notes. Test with a real
  long-running agent before shipping; if drift persists, expose a
  per-agent fallback to legacy renderer
  (`CLAUDE_CODE_DISABLE_FULLSCREEN=1` if/when that flag stabilizes).
- **Should restoration use Claude's own `-r <sessionId>` resume, or
  tmux re-attach, or both?** The recommended path is *both*: on
  activation, walk surviving tmux sessions and re-attach the still-live
  ones; for the rest, fall back to your existing `claude -r` resume
  inside a fresh tmux session. But that means you store both
  identifiers per agent — adds one column to `StateStorage`.
- **Reboot survival.** Out of scope for tmux without
  `tmux-resurrect`+`tmux-continuum`. Recommendation: don't try to
  paper over this with a plugin — let agents die on reboot and resume
  via `claude -r` on next activation. Tell the user explicitly in the
  README.
- **Windows-native support without WSL.** tmux requires Cygwin/MSYS
  on bare Windows; `wmux` exists but is alpha. If you have Windows
  users, the right answer for now is "detached mode requires WSL"
  rather than supporting a half-working native build.

## How to do it

### Wire it into `TerminalService`

The current `TerminalService.createTerminal` at
`src/services/TerminalService.ts:130` calls
`vscode.window.createTerminal({ name, cwd, location })` then
`sendText(buildCommand(...))`. Add a config flag
`vscode-agentic.persistentSessions` (`enum: ["off", "tmux"]`, default
`"off"`) and branch on it. Sketch:

```ts
const persistent = vscode.workspace
  .getConfiguration('vscode-agentic')
  .get<'off' | 'tmux'>('persistentSessions', 'off');

const sessionTag = `agentic-${agentId}`;

if (persistent === 'tmux') {
  const confPath = vscode.Uri.joinPath(
    this.ctx.extensionUri, 'resources', 'agentic.tmux.conf',
  ).fsPath;

  // attach-or-create; tmux runs claude on first create, no-ops on attach
  const shellArgs = [
    '-L', 'agentic',
    '-f', confPath,
    'new-session', '-A',
    '-s', sessionTag,
    '-c', cwd,
    '-x', '200', '-y', '50',
    claudeCmd,                         // tmux runs this as the session's first command
  ];

  const terminal = vscode.window.createTerminal({
    name,
    shellPath: 'tmux',
    shellArgs,
    location: { viewColumn: vscode.ViewColumn.Two },
  });
  this.terminals.set(agentId, terminal);

  // tag for orphan cleanup — separate call so it runs after server is up
  void execFile('tmux', [
    '-L', 'agentic', 'set-option', '-t', sessionTag, '@workdir', cwd,
  ]).catch(() => {});

  return terminal;
}

// existing path unchanged
```

**Restoration** (`restoreAll`): for each Agent in storage, call
`execFile('tmux', ['-L','agentic','has-session','-t', sessionTag])`
once. Exit code 0 → recreate the VS Code terminal with the *attach*
form (`['-L','agentic','attach','-t', sessionTag]`, no first command);
the agent inside is still alive. Non-zero → fall back to your existing
`claude -r <sessionId>` path inside a fresh tmux session.

**Health check**: your existing `healthTimer` calls
`checkTerminalHealth`. Extend it to also call `has-session` for
persistent agents — a VS Code terminal dispose no longer means the
agent is dead.

**Cleanup on agent delete**: in addition to `git worktree remove`,
`execFile('tmux', ['-L','agentic','kill-session','-t', sessionTag])`.
Wrap in try/catch, ignore "can't find session" stderr.

Match the codebase's existing idiom in `services/GitService.ts`
(`promisify(execFileCb)` from `child_process`) — same per-call timeout
handling, same error swallowing pattern.

### `resources/agentic.tmux.conf`

```tmux
# Isolated socket — never read user's ~/.tmux.conf
set -g default-terminal "tmux-256color"
set -as terminal-features ",xterm-256color:RGB"

# Drop the prefix entirely — Claude owns the screen.
unbind-key -a
set -g prefix None

# Per-client viewports so VS Code + SSH attaching at different sizes
# don't shrink the TUI for everyone.
set -g window-size latest
setw -g aggressive-resize on

# Suppress status bar — saves a row, prevents fullscreen clipping
# (claude-code #51497).
set -g status off

# Don't enable csi-u — breaks bracketed paste in Claude
# (claude-code #43169).
set -s extended-keys off

# Bound history; agents generate dense output.
set -g history-limit 10000

# Don't auto-kill on last detach — that's the whole point.
set -g destroy-unattached off
set -g remain-on-exit on

# Mouse OFF by default — Claude's fullscreen renderer handles wheel.
# Users can re-enable per session if they want copy-mode scroll.
set -g mouse off

# Don't pollute the user's clipboard or send OSC 52 by accident.
set -g set-clipboard off
```

### Capturing output for the webview (optional)

When you want the most-recent terminal contents in a hover/panel,
shell out to tmux with `execFile` (matches the GitService idiom):

```ts
const { stdout } = await execFile(
  'tmux',
  ['-L', 'agentic', 'capture-pane', '-p', '-t', sessionTag, '-S', '-2000'],
  { timeout: 5_000, maxBuffer: 10 * 1024 * 1024 },
);
```

For a streaming transcript log file, run `pipe-pane` *once* at session
create (the tmux server persists the pipe across detach/attach):

```ts
await execFile('tmux', [
  '-L', 'agentic', 'pipe-pane', '-o', '-t', sessionTag,
  `cat >> ${logPath}`,
]);
```

(Note the single `cat >> ...` is interpreted by tmux as a shell
fragment via `/bin/sh -c`, not by Node — but the surrounding command
array is argv, so no Node-side shell-injection surface.)

### Document for users

Add a section to the extension README:

- "Persistent sessions require `tmux ≥ 3.2` installed and on PATH."
- "On Linux, `loginctl enable-linger $USER` is required for sessions
  to survive logout."
- "Detached mode is currently unsupported on native Windows; use WSL."
- "Sessions are created on a dedicated socket (`-L agentic`) — your
  personal tmux config is not used and not modified."

## Sources

[1] [tmux 3.6 release notes](https://github.com/tmux/tmux/releases/tag/3.6) — [official] 2025-12
[2] [tmux ISC license](https://hoop.dev/blog/understanding-the-tmux-isc-license-and-its-benefits/) — [community] 2025
[3] [GNU Screen 5.0.1 announcement](https://lists.gnu.org/archive/html/screen-users/2025-05/msg00005.html) — [official] 2025-05
[4] [tmux Getting Started wiki](https://github.com/tmux/tmux/wiki/Getting-Started) — [official] 2025
[5] [tmux Advanced Use — pipe-pane & capture-pane](https://github.com/tmux/tmux/wiki/Advanced-Use) — [official] 2025
[6] [Zellij 0.44.0 release](https://github.com/zellij-org/zellij/releases/tag/v0.44.0) — [official] 2025-03
[7] [Zellij multi-client size discussion #3124](https://github.com/zellij-org/zellij/discussions/3124) — [community] 2024-2025
[8] [Codex PR #8555: --no-alt-screen for Zellij](https://github.com/openai/codex/pull/8555) — [community] 2025
[9] [Zellij issue #10331: alt-screen scrollback still broken](https://github.com/openai/codex/issues/10331) — [community] 2025
[10] [Claude Code #38810 — mouse capture under tmux](https://github.com/anthropics/claude-code/issues/38810) — [community] 2026-03
[11] [Claude Code #43169 — csi-u bracketed-paste newline loss](https://github.com/anthropics/claude-code/issues/43169) — [community] 2026-04
[12] [Claude Code #51497 — fullscreen clipped under tmux status bar](https://github.com/anthropics/claude-code/issues/51497) — [community] 2026-04
[13] [Claude Code #37076 — flicker in tmux/multiplexers](https://github.com/anthropics/claude-code/issues/37076) — [community] 2026-03
[14] [Claude Code #4851 — scrollback rewind in tmux+VS Code](https://github.com/anthropics/claude-code/issues/4851) — [community] 2025-08
[15] [Claude Code Fullscreen docs](https://code.claude.com/docs/en/fullscreen) — [official] 2026-04
[16] [Claude Code #15553 — programmatic send-keys](https://github.com/anthropics/claude-code/issues/15553) — [community] 2025-12
[17] [tmux #4029 — memory leak with large history](https://github.com/tmux/tmux/issues/4029) — [community] 2024-07
[18] [tmux #1261 — leaks after weeks](https://github.com/tmux/tmux/issues/1261) — [community] ongoing
[19] [tmux #4459 — ssh timeout kills sessions](https://github.com/tmux/tmux/issues/4459) — [community] 2025-03
[20] [Zellij #4452 — WouldBlock panic](https://github.com/zellij-org/zellij/issues/4452) — [community] 2025-10
[21] [Zellij #4490 — crash on attach after detach](https://github.com/zellij-org/zellij/issues/4490) — [community] 2025-10
[22] [Zellij #4413 — session resurrection non-functional](https://github.com/zellij-org/zellij/issues/4413) — [community] 2025-09
[23] [systemd #12981 — user tmux service auto-disabled](https://github.com/systemd/systemd/issues/12981) — [community] re-cited 2025
[24] [VADOSWARE — From Zellij to Tmux Back to Zellij](https://vadosware.io/post/from-zellij-to-tmux-back-to-zellij/) — [community] 2025
[25] [Lobsters — Why Zellij? discussion](https://lobste.rs/s/ft797a/why_zellij) — [community] 2024–2025
[26] [HN 26081428 — UTF-8 remote DoS in GNU screen](https://news.ycombinator.com/item?id=26081428) — [community] re-cited
[27] [HN 46392682 — SSH-agent broken in tmux](https://news.ycombinator.com/item?id=46392682) — [community] 2025-12
[28] [HN 46611935 — "tmux for Agents (2025)"](https://news.ycombinator.com/item?id=46611935) — [community] 2025
[29] [kargnas/vscode-ext-tmux-worktree — tmuxBackend.ts](https://github.com/kargnas/vscode-ext-tmux-worktree/blob/main/src/utils/tmuxBackend.ts) — [community] 2026-05
[30] [kargnas/vscode-ext-tmux-worktree — orphanCleanup.ts](https://github.com/kargnas/vscode-ext-tmux-worktree/blob/main/src/commands/orphanCleanup.ts) — [community] 2026-05
[31] [anatoliykmetyuk/vscode-tmux — terminalManager.ts](https://github.com/anatoliykmetyuk/vscode-tmux/blob/main/src/terminalManager.ts) — [community] 2026-04
[32] [cybersader/vscode-terminal-workspaces — tmux integration docs](https://github.com/cybersader/vscode-terminal-workspaces/blob/main/docs/tmux-integration.md) — [community] 2025
[33] [VS Code docs — Terminal Persistent Sessions](https://code.visualstudio.com/docs/terminal/advanced) — [official] 2026-05
[34] [Alan Johnson — Truly persistent terminals in VSCode and Cursor](https://acjay.com/2025/12/04/truly-persistent-terminals-in-vscode-and-cursor/) — [community] 2025-12
[35] [VS Code API reference — Pseudoterminal / TerminalState](https://code.visualstudio.com/api/references/vscode-api) — [official] 2026
[36] [microsoft/vscode #118726 — extension terminals opt-out of persistence](https://github.com/microsoft/vscode/issues/118726) — [official] 2022, mechanism current
[37] [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — [official] 2025
[38] [Tmux 3.5 Released — Linuxiac](https://linuxiac.com/tmux-3-5-terminal-multiplexer/) — [community] 2024-10
[39] [tmux vs zellij 100-Pane Benchmark — TildAlice](https://tildalice.io/tmux-vs-zellij-100-pane-benchmark/) — [community] 2025
[40] [Show HN: Amux — tmux-based Claude Code multiplexer](https://news.ycombinator.com/item?id=47104424) — [community] 2025
[41] [mixpeek/amux — Claude Code agent multiplexer](https://github.com/mixpeek/amux) — [community] 2026-02
[42] [Hwee-Boon Yar — Using tmux with Claude Code](https://hboon.com/using-tmux-with-claude-code/) — [community] 2025-11/2026-05
[43] [cdmckay — Keep Claude Code running across SSH disconnects](https://cdmckay.org/how-to-keep-claude-code-running-across-ssh-disconnects/) — [community] 2025-09
[44] [Lorenzo Bettini — tmux true color + italics](https://www.lorenzobettini.it/2025/10/configure-tmux-to-support-true-color-and-italics-in-alacritty-and-neovim/) — [community] 2025-10
[45] [WezTerm Multiplexing docs](https://wezterm.org/multiplexing.html) — [official] current
[46] [Coder devcontainer rework #16491](https://github.com/coder/coder/issues/16491) — [official] 2025
[47] [Termdock — tmux vs Termdock vs Zellij for AI Agents](https://www.termdock.com/en/blog/terminal-multiplexing-tmux-termdock-zellij) — [community] 2025
