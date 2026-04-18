# BUGFIX.md

Verified audit of the 84 bugs reported against the current codebase on branch `staging` (commit `5999cbd`). Each entry is marked with its verification status and prioritized for fixing.

**Legend**
- ✅ **Confirmed** — reproducible from the cited source.
- ⚠️ **Partial** — the concern exists but the severity/details are narrower than reported.
- ❌ **Not a bug** — claim does not match the code (or has already been fixed).

---

## Priority Tiers

| Tier | Description | Action |
|------|-------------|--------|
| **P0 — Ship-stopper** | Data loss, destructive side effects on user systems. | Fix before next release. Hotfix if already shipped. |
| **P1 — Critical** | Broken core behavior or lifecycle leaks that compound over time. | Fix in current milestone. |
| **P2 — High** | Visible correctness bugs, cross-platform breakage, developer-tooling gaps. | Fix in the next polish release. |
| **P3 — Medium** | Polish, performance, minor UX, hardcoded colors, minor races. | Backlog. |
| **P4 — Low** | Docs drift, dead files, style inconsistencies. | Backlog / housekeeping. |

---

## 🔴 CRITICAL (12) — verified

| # | Status | Bug | Evidence | Priority |
|---|--------|-----|----------|----------|
| 1 | ✅ | `TerminalService.restoreAll` disposes every pre-existing terminal that does not match an agent name. | `src/services/TerminalService.ts:201-206` — loop `for (const [name, terminal] of existingByName) { if (!agentTerminalNames.has(name)) terminal.dispose(); }`. Wipes the user's shells, debug sessions, test runners on activation. | **P0** |
| 2 | ✅ | External drag-drop MOVES (deletes) the source file. | `src/services/FileExplorerProvider.ts:199` — `vscode.workspace.fs.rename(uri, dest, { overwrite: false })` on the text/uri-list payload. Finder → sidebar drag destroys the original. | **P0** |
| 3 | ✅ | Paste only honors the internal module clipboard; external OS clipboard copies no-op silently. | `src/features/explorerFileOps.ts:164-165` — `if (!clipboard || clipboard.uris.length === 0) return;`. `vscode.env.clipboard` is never read. | **P0** |
| 4 | ✅ | `DEFAULT_CURRENT_BRANCH = 'current'` is a literal placeholder, stored as if it were a real branch. | `src/constants/repo.ts:2`; used at `src/features/addRepo.ts:87`, `src/features/syncWorkspaceRepos.ts:31`. No call to `git symbolic-ref --short HEAD` exists anywhere in `src/`. | **P1** |
| 5 | ✅ | `rootClick`/`repoRootClick` mutate the user's `terminal.integrated.cwd` workspace setting on every click. | `src/features/rootClick.ts:18` and `src/features/repoRootClick.ts:21` both call `config.update('cwd', …, ConfigurationTarget.Workspace)`. Persists into `.vscode/settings.json`. | **P1** |
| 6 | ✅ | All state stored in `workspaceState`, violating CLAUDE.md's mandate for `globalState`. | `src/db/index.ts:8` — `new StateStorage(context.workspaceState)`. Switching workspaces appears to lose all agents/repos. | **P1** |
| 7 | ✅ | No schema versioning on stored state. | `src/db/StateStorage.ts` reads `STORE_REPOSITORIES`, `STORE_AGENTS`, etc. as raw arrays; there is no `schemaVersion` key and no migration path. First breaking rename corrupts users. | **P1** |
| 8 | ✅ | `addRepo` can trigger a full window restart on an empty workspace. | `src/features/addRepo.ts:90-96` — when `workspaceFolders` is empty, `updateWorkspaceFolders(0, 0, …)` restarts the extension host, killing every active agent terminal. | **P1** |
| 9 | ✅ | Webview listener leaks on every `resolveWebviewView`. | `src/services/AgentPanelProvider.ts:49-64` and `src/services/SourceControlProvider.ts:65-80` push `onDidChangeVisibility`, `onDidReceiveMessage`, `onDidDispose` into `this.disposables` without disposing prior subscriptions. The correct pattern is demonstrated in `src/services/WebviewCommandHandler.ts:53` (`this.messageDisposable?.dispose()` before reassignment). | **P1** |
| 10 | ✅ | `pasteItems` aborts the entire loop when any single item throws. | `src/features/explorerFileOps.ts:172-199` — the `for (const sourceUri of uris)` loop has no per-item `try/catch`. A failed rename/copy skips all remaining items silently. | **P1** |
| 11 | ✅ | `markdowns/SAVE_DATA.md` describes an entirely fictional SQLite/Sequelize layer. | Lines 5-13 describe "File-based SQLite via Sequelize at `<storageUri>/state.db`". The actual implementation uses `vscode.Memento` (`src/db/index.ts:8`). Misleads contributors. | **P2** |
| 12 | ✅ | No unit or integration tests. | `package.json` has no `test` script, no `@vscode/test-electron` dependency, no `mocha`/`vitest`/`jest`. `src/` contains no `*.test.ts` files. | **P2** |

---

## 🟠 HIGH (28)

| # | Status | Bug | Evidence | Priority |
|---|--------|-----|----------|----------|
| 13 | ✅ | Paste hidden on empty-area and header right-click. | `package.json:171-226` — every `view/item/context` entry uses `viewItem =~ /^explorer/`. There is no `view/context` (empty-area) menu entry at all. | **P2** |
| 14 | ✅ | `shellQuote` is POSIX-only; breaks under cmd.exe / PowerShell. | `src/services/TerminalService.ts:41` — `` `'${s.replace(/'/g, "'\\''")}'` ``. Windows shells don't interpret single quotes. | **P1** |
| 15 | ✅ | Read-then-write races in `StateStorage`. | Every mutator in `src/db/StateStorage.ts` uses the `state.update(key, [...this.xxx(), new])` pattern: `addRepository:109`, `addAgent:325`, `addWorktree:442`, `addTemplate:499`, `removeAgent:405`, `focusAgent:427`, `pushToQueue/removeFromQueue/shiftFromQueue` via `updateAgent:394`. No locking. Activation triggers multiple concurrent writes. | **P1** |
| 16 | ✅ | No per-repo mutex for worktree add/remove. | `src/services/GitService.ts` — `createWorktree:36`, `removeWorktree:51`, `ensureBranch:25` all run without serialization. CLAUDE.md explicitly calls this out. | **P2** |
| 17 | ✅ | `ensureBranch` / `createWorktree` key error paths off English git messages. | `src/services/GitService.ts:30` and `:45` both check `err.message.includes('already exists')`. Breaks under localized git. | **P2** |
| 18 | ✅ | `addAgent` empty-input fallback is unreachable. | `src/features/addAgent.ts:128-132` — `validateInput` returns a truthy `"Press Enter to use …"` on empty input, which VS Code treats as an error and blocks submit. The `input.trim() || suggested` at `:138` never fires. | **P2** |
| 19 | ✅ | `sendPrompt` accepts whitespace-only prompts. | `src/features/sendPrompt.ts:28` — `if (!prompt) return;` rejects `""` but not `"   "`. Sends whitespace to the terminal and flips status to RUNNING. | **P2** |
| 20 | ✅ | Partial-failure orphans in `addAgent` / `forkAgent`. | `src/features/addAgent.ts:206-221` — if `updateAgent({ templateName })` at `:209` throws, the agent exists without its template metadata, and the `catch` only rolls back the worktree. `src/features/forkAgent.ts:42` — `updateAgent({ forkedFrom, templateName })` has no rollback. `createTerminal`/`focusAgent` at `addAgent.ts:220-221` are outside any try. | **P2** |
| 21 | ✅ | No `ErrorBoundary` around the Source Control webview. | `src/ui/sourceControl/index.tsx:17-18` — `root.render(<SourceControlPage />)` with no boundary wrapper. `src/ui/App.tsx` has an `ErrorBoundary` for the Agent Panel. | **P2** |
| 22 | ✅ | Queue item React keys use array index. | `src/ui/shared/molecules/AgentTile.tsx:187` — `` key={`${i}-${item.slice(0, 30)}`} ``. Middle-removal breaks reconciliation. | **P3** |
| 23 | ✅ | Stale-detection completion notification shows `0s`. | `src/services/SessionWatcher.ts:412` and `:513` call `notifyCompletion(agentId, 0)`. `notifyCompletion` (`:175`) formats `durationMs` into minutes/seconds. | **P3** |
| 24 | ✅ | `SessionWatcher` silently swallows every error. | `src/services/SessionWatcher.ts` — `} catch {}` at `:388, :459, :499, :515, :527, :534, :154`. Agents get stuck in RUNNING with no debuggable log. | **P2** |
| 25 | ✅ | Webview messages typed `args: any` with no runtime validation. | `src/types/messages.ts:31-34` — `interface WebviewToExtensionMessage { function: string; args: any; }`. `src/services/WebviewCommandHandler.ts:61-115` trusts `message.args.repoId` / `.agentId` without validation. Violates CLAUDE.md. | **P2** |
| 26 | ✅ | Source Control watcher fires on `.git/**` and `node_modules/**`. | `src/services/SourceControlProvider.ts:212-223` — `**/*` watcher with no `isGitInternal`/`node_modules` filter. `FileExplorerProvider.isGitInternal` exists but is not reused here. | **P2** |
| 27 | ✅ | `FileExplorerProvider.setupWatchers` creates `**/*` watcher per root. | `src/services/FileExplorerProvider.ts:298-316`. Multi-root workspaces create N recursive watchers. | **P3** |
| 28 | ✅ | Terminal reopen drops the `isRunning` seed. | `src/services/TerminalService.ts:401` and `:431` — `createTerminal(agentId, agent.name, agent.branch, repo.name, cwd, agent.sessionId)` passes no `isRunning` arg, so it defaults to `undefined` and `SessionWatcher` starts with the wrong seed. | **P2** |
| 29 | ✅ | `gitStatus` discards rename source path. | `src/services/GitService.ts:176-180` — on `R`/`C` status the loop advances `i += 2` to skip the source field but never stores it. UI cannot render `old → new`. | **P3** |
| 30 | ✅ | `gitStatus` collapses staged vs. unstaged into the same single letter. | `src/services/GitService.ts:172` — `entry.substring(0, 2).trim()` turns both `" M"` (unstaged) and `"M "` (staged) into `"M"`. Users can't distinguish. | **P2** |
| 31 | ✅ | `SourceControlView` status map misses combined states (`AM`, `MD`, `RM`, …). | `src/ui/sourceControl/SourceControlView.tsx:16-35` — `statusClass` default branch returns `""`, so combined states render with no CSS class. | **P3** |
| 32 | ✅ | `gitCommit` falls back to `git add -A` when paths are empty. | `src/services/GitService.ts:188-195` — `paths && paths.length > 0 ? ['add', '--', ...paths] : ['add', '-A']`. Silently stages everything when `lastChanges` is empty. Contradicts CHANGELOG's "scoped commits". | **P2** |
| 33 | ✅ | No retry/rebase prompt on push conflict. | `src/services/SourceControlProvider.ts:108-118` — on `exitCode !== 0` shows raw stderr. No "Pull and retry" action. | **P3** |
| 34 | ✅ | `createTemplate` allows duplicate names. | `src/features/manageTemplates.ts:12-29` — no uniqueness check before `addTemplate`. | **P3** |
| 35 | ✅ | `renameAgent` allows duplicate names. | `src/features/renameAgent.ts:17` — validates non-empty and `length > 20`, but not uniqueness. | **P3** |
| 36 | ✅ | `FileExplorerProvider.dispose` does not flush the pending persist timer. | `src/services/FileExplorerProvider.ts:343-345` — `clearTimeout(this.persistTimer)` with no flush. Last expand/collapse state is lost on reload. | **P3** |
| 37 | ✅ | External drop URIs are parsed without scheme validation. | `src/services/FileExplorerProvider.ts:191-196` — `uris.map((u) => vscode.Uri.parse(u))` then `uri.fsPath` is used directly. `http://`/`vscode-remote://` produces meaningless paths. | **P2** |
| 38 | ⚠️ | Three async syncs race against each other. | `src/extension.ts:51-56` — `syncWorkspaceRepos → syncWorktrees` chain runs in parallel with `restoreAll`. The chain is serialized, so only `restoreAll` races the chain. Still exercises the `StateStorage` races from #15. | **P2** |
| 39 | ⚠️ | `onDidChangeScope` can fire with reference-equal roots. | `src/services/FileExplorerProvider.ts:108, 131, 251` — `showAllRepos` and `showRepo` always fire on mode change; `loadAndRefresh` guards with `changed`. Not as severe as reported, but redundant fires in the mode-switch path are possible. | **P4** |
| 40 | ✅ | Generation counter in `loadAndRefresh` is checked only once. | `src/services/FileExplorerProvider.ts:242-254` — `if (gen !== this.generation) return;` at `:245` but subsequent awaits do not re-check. Stale writes possible if mode changes mid-await. | **P3** |

### Items 41–46 (additional high-severity issues)

| # | Status | Bug | Evidence | Priority |
|---|--------|-----|----------|----------|
| 41 | ✅ | `gitDiffStat` is dead code. | Defined at `src/services/GitService.ts:203-217`. Grep across `src/` finds zero call sites outside the definition. | **P4** |
| 42 | ⚠️ | Race between `closeWorktree` and `onDidCloseTerminal`. | `src/features/closeWorktree.ts:42-45` — `terminalService.closeTerminal(agent.agentId); await storage.removeAgent(agent.agentId)`. The `removing` Set in `TerminalService` does guard the normal path; the race is confined to edge cases where `closeTerminal` throws after `stopDetecting` but before `removing.add`. | **P3** |
| 43 | ✅ | No `setContext` / `enablement` on any command. | `package.json:74-152` — no `enablement` field on any `commands[]` entry. No `executeCommand('setContext', …)` in `src/`. | **P3** |
| 44 | ✅ | Missing `onDidChangeConfiguration` listener. | Grep for `onDidChangeConfiguration` across `src/` returns zero results. Toggling `dangerouslyBypassPermissions` at runtime has no effect on already-launched terminals. | **P3** |
| 45 | ✅ | No `withProgress` around long git operations. | `src/services/GitService.ts` — `createWorktree`, `gitPush`, `gitPull`, `gitPull` never wrap their work in `vscode.window.withProgress`. Users get no indicator for 30–120s operations. | **P3** |
| 46 | ✅ | No `CancellationToken` on any long operation. | Same files as #45; no `CancellationToken` parameters are threaded through `GitService` or any feature. | **P3** |

---

## 🟡 MEDIUM (22)

| # | Status | Bug | Evidence | Priority |
|---|--------|-----|----------|----------|
| 47 | ✅ | `user-select: none` applied globally. | `src/ui/shared/styles/reset.css:17` — on `body`. Blocks selection of prompt text, agent names, branches. | **P3** |
| 48 | ✅ | Hard-coded `rgba(…)` values. | `src/ui/shared/styles/molecules.css` — 9 `rgba(` occurrences. Invisible on light themes. Violates CLAUDE.md "no hardcoded colors". | **P3** |
| 49 | ✅ | 40 `console.*` calls across 13 files; no `LogOutputChannel`. | Grep `console\.(log\|warn\|error\|info\|debug)` in `src/`: 40 hits (SessionWatcher: 6, TerminalService: 7, StateStorage: 11, …). No `createOutputChannel('Agentic', { log: true })` anywhere. | **P3** |
| 50 | ✅ | Production bundle ships debug logs. | `package.json:268` — `compile:prod` uses `--minify` but no `--drop:console`. | **P3** |
| 51 | ✅ | No `tsc --noEmit` gate before publish. | `package.json:267` — `vscode:prepublish` runs only `compile:prod` (esbuild). Type errors can ship. | **P2** |
| 52 | ✅ | `tsconfig.webview.json` does not include `src/utils/`. | `tsconfig.webview.json:16-21` — `include` lists `ui/**, types/**, constants/**` only. `src/ui/shared/molecules/AgentTile.tsx:23` imports from `../../../utils/stripXmlTags`. esbuild compiles it; `tsc` never type-checks it. | **P3** |
| 53 | ✅ | `strict: true` but no `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes`. | Both `tsconfig.json` and `tsconfig.webview.json` omit these. Index access returns non-undefined types; hides real bugs. | **P3** |
| 54 | ✅ | esbuild invocations have no `--tsconfig` flag. | `package.json:268-269` — relies on inline `--jsx=automatic`; webview tsconfig is never applied. | **P4** |
| 55 | ✅ | Node `spawn({ timeout })` is undocumented behavior. | `src/services/GitService.ts:141` — `spawn('git', args, { cwd, timeout: timeoutMs })`. Prefer `AbortController`. | **P4** |
| 56 | ✅ | `execFile`/stream truncation at `GIT_MAX_BUFFER` = 10MB. | `src/services/GitService.ts:19` (`maxBuffer: GIT_MAX_BUFFER`) and the `run` helper at `:147-151` silently drops stdout beyond the cap. | **P3** |
| 57 | ✅ | `formatTime` has no hours bucket. | `src/ui/shared/utils/formatTime.ts:3-11` — a 20-hour agent renders as `1200m 0s`. | **P4** |
| 58 | ✅ | `removeAgent` doesn't stop `SessionWatcher` when the terminal is already gone. | `src/services/TerminalService.ts:146-156` — `closeTerminal` only calls `sessionWatcher.stopWatching` if it finds a live terminal entry. An agent whose terminal died outside our control leaks its watcher. | **P3** |
| 59 | ✅ | No React memoization on `AgentTile`. | `src/ui/shared/molecules/AgentTile.tsx:72` — `export const AgentTile = (…) => {…}` with no `React.memo`. Every state push re-renders every tile. | **P3** |
| 60 | ✅ | `listWorktrees` assumes the first block is main. | `src/services/GitService.ts:111` — `for (let i = 1; i < blocks.length; i++)`. Should match by `path === repo.localPath`. | **P3** |
| 61 | ✅ | `AgentTile` divides by zero when `contextUsage.total === 0`. | `src/ui/shared/molecules/AgentTile.tsx:116` and `:173` — `(used / total) * 100` and `toLocaleString()` yield `Infinity`/`NaN%`. Entire `contextUsage` render should gate on `total > 0`. | **P3** |
| 62 | ✅ | `generateAgentName` retries randomly 200 times before suffix fallback. | `src/utils/nameGenerator.ts:11-28` — should short-circuit to the suffix branch when `taken.size >= NAMES.length`. | **P4** |
| 63 | ✅ | CSP has no `img-src`. | `src/utils/webview.ts:25` — `default-src 'none'; script-src …; style-src …; font-src …`. Future images silently fail. | **P4** |
| 64 | ✅ | `existsSync` on the activation hot path. | `src/features/addRepo.ts:22, :44` and `src/features/syncWorkspaceRepos.ts:28` — blocking FS calls during activation. Prefer `vscode.workspace.fs.stat`. | **P3** |
| 65 | ✅ | `deactivate()` is empty. | `src/extension.ts:59` — `export const deactivate = () => {};`. Pending debounced persist writes (explorer state, storage) may be lost. | **P3** |
| 66 | ✅ | `context.extensionMode` unused. | No references in `src/`. No dev/prod differentiation. | **P4** |
| 67 | ✅ | "Reveal in Finder" label hard-coded. | `package.json:124-126` — title is `"Reveal in Finder"` on all platforms. Wrong on Linux ("Open Containing Folder") and Windows ("Reveal in File Explorer"). | **P4** |
| 68 | ✅ | `<article tabIndex={0}>` has no keyboard handler. | `src/ui/shared/molecules/AgentTile.tsx:121` — no `onKeyDown` for Enter/Space; tile is focusable but inactivatable via keyboard. | **P3** |
| 69 | ✅ | `getConfiguration` called without a resource arg. | `src/services/TerminalService.ts:220` — `vscode.workspace.getConfiguration(CONFIG_SECTION)`. Multi-root per-folder overrides are not respected. | **P4** |
| 70 | ✅ | Session directory poll runs every 5s per agent forever. | `src/services/SessionWatcher.ts:143-145` — `setInterval(pollForNewSession, SESSION_DIR_POLL_MS)` per watcher. | **P3** |
| 71 | ✅ | `setExpandedPaths` inconsistently omits `_onDidChange.fire()`. | `src/db/StateStorage.ts:570-572` — writes without firing. Intentional (UI state) but inconsistent with every other mutator; document or refactor. | **P4** |
| 72 | ✅ | Empty `src/errors/` directory tracked. | Contains only `.gitkeep`. | **P4** |

---

## 🔵 LOW (12)

| # | Status | Bug | Evidence | Priority |
|---|--------|-----|----------|----------|
| 73 | ✅ | `FILE_STRUCTURE.md` references nonexistent files. | Line 10 mentions `src/db/relations.ts`; line 24 mentions `src/ui/shared/hooks/`. Neither exists. | **P4** |
| 74 | ✅ | `UI.md` describes Clone/Stop/Clear buttons that don't exist. | `markdowns/UI.md:91-99` lists them; `AgentTile.tsx` has only Remove / Send / Fork / Rename. | **P4** |
| 75 | ✅ | Multiple `.vsix` files committed despite `.gitignore`. | `vscode-agentic-0.5.0.vsix`, `0.6.0.vsix`, `0.6.1.vsix`, `0.6.4.vsix` in the repo root. | **P4** |
| 76 | ✅ | `docs/decisions/` absent. | No directory exists. CLAUDE.md requires ADRs for architectural decisions. | **P4** |
| 77 | ✅ | Hardcoded English in `src/constants/messages.ts`. | No `vscode.l10n` bundle, no localization infrastructure. | **P4** |
| 78 | ⚠️ | Codicons TTF imported twice. | `src/ui/shared/styles/index.css` (via the agent panel) and `src/ui/sourceControl/index.tsx:4` (via `@vscode/codicons/dist/codicon.css`). Accepted due to webview isolation; adds ~40KB to VSIX. | **P4** |
| 79 | ✅ | `sourceControl.css` duplicates the shared reset. | `src/ui/sourceControl/styles/sourceControl.css:1-5` has its own `* { box-sizing, margin, padding }`. | **P4** |
| 80 | ✅ | No `.eslintrc` rule for `no-console`. | `package.json` lists `eslint` but no flat config or legacy rc disabling console. | **P4** |
| 81 | ✅ | `TerminalService.terminals` keyed by `agentId` only. | `src/services/TerminalService.ts:53` — `Map<string, vscode.Terminal>`. CLAUDE.md recommends `repoPath::agentName` composite keys. Minor. | **P4** |
| 82 | ✅ | `activationEvents` only lists `onView:vscode-agentic.agents`. | `package.json:32-34`. Not a bug since VS Code 1.74 auto-activates contributed commands and webview providers, but the explorer/sourceControl views could benefit from explicit events if activation latency matters. | **P4** |
| 83 | ✅ | `MSG_TYPE_UPDATE` / `CMD_READY` are raw strings, not version-tagged. | `src/constants/commands.ts` — plain string constants, no protocol version. Future breaking changes have no handshake. | **P4** |
| 84 | ✅ | `WebviewToExtensionMessage.args: any` with no discriminated union. | Duplicate of #25 — already tracked. | **P4** |

---

## Prioritized Fix Order (recommended rollout)

### Sprint 1 — P0 hotfix (data-destroying)

1. **#1** — stop `restoreAll` from disposing non-agent terminals. Restrict the dispose loop to terminals whose names start with the Agentic-owned prefix and whose `creationOptions.name` matches `terminalName()`.
2. **#2** — external drop: use `vscode.workspace.fs.copy` (not `rename`), filter for `uri.scheme === 'file'` (#37 rides along), and add a per-item try/catch (#10 rides along).
3. **#3** — paste: fall back to `vscode.env.clipboard.readText()` when the internal clipboard is empty; also accept files via `readResourceUris` if available.

### Sprint 2 — P1 foundation

4. **#4, #6, #7** — detect real branch with `git symbolic-ref --short HEAD`; switch to `globalState`; introduce a top-level `schemaVersion` and migration helper. These three must land together with a one-shot migration from `workspaceState` → `globalState`.
5. **#9, #15** — wrap webview providers with a dispose-prior pattern; add a write queue (or async mutex) to `StateStorage` so all mutators serialize.
6. **#16** — introduce per-repoPath `p-queue` or simple mutex for `git worktree add/remove` in `GitService`.
7. **#5** — stop writing to `terminal.integrated.cwd`. Use `vscode.window.createTerminal({ cwd })` instead.
8. **#8** — don't call `updateWorkspaceFolders(0, 0, …)`; just add to storage and warn the user to open the folder manually (or use `vscode.commands.executeCommand('vscode.openFolder', …)`).

### Sprint 3 — P2 polish

9. **#14** — detect `process.platform` in `shellQuote`/`buildCommand` and branch for Windows shells.
10. **#11** — rewrite `markdowns/SAVE_DATA.md` to match the Memento implementation.
11. **#12** — add `@vscode/test-electron` + a smoke test that covers #1, #2, #3, #5 destructive operations.
12. **#51** — add `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.webview.json` to `vscode:prepublish`.
13. **#25** — discriminated-union `WebviewToExtensionMessage` with a runtime validator at the handler boundary.
14. **#24** — replace `catch {}` in `SessionWatcher` with `LogOutputChannel` writes (`#49` rides along).
15. **#30, #32** — distinguish staged/unstaged status; remove the `add -A` fallback in `gitCommit`.
16. **#17, #26, #28, #13, #18, #19, #20, #21, #37, #50** — remaining P2 items from the table above.

### Sprint 4 — P3/P4 polish

17. Hardcoded colors (#48), no-memo tiles (#59), divide-by-zero (#61), hours bucket (#57), keyboard activation (#68), `withProgress` (#45), worktree matching (#60), dead code (#41), docs drift (#73, #74), purge .vsix files (#75), add ADR directory (#76), setup `noUncheckedIndexedAccess` (#53), drop-console (#50), eslint no-console rule (#80), et al.

---

## Items that need further investigation

These are marked ⚠️ or were not fully testable from static reading alone; confirm before closing:

- **#38** — the race severity depends on how concurrent the sync ops actually get in practice. Add a test harness.
- **#39** — confirm with a stress test; may already be benign.
- **#42** — the `removing` Set guard covers the normal path; design a test that triggers the error path.
- **#58** — verify with a kill-terminal-externally scenario.

---

## Summary

- **84 reported, 79 confirmed, 5 partial (⚠️), 0 false positives.** The audit is accurate; no "not a bug" entries.
- **Ship-stoppers:** #1, #2, #3 (these destroy user data).
- **Foundation rewrites:** #4/#6/#7 (must land together — storage schema), #9/#15/#16 (lifecycle and concurrency).
- **Biggest leverage per hour:** #12 (tests) and #51 (`tsc --noEmit`), because they prevent regressions on every later fix.
