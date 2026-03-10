## PROJECT

- We develop VS Code Extension for working on several repositories using AI agents on own worktrees.
- Make things as simple as possible. Keep the codebase consistent.
- Extension exists in right sidebar tab named 'Agentic'. All UI is placed there.

## DOCS MAP

- `CLAUDE.md` — project rules, architecture conventions, coding standards.
- `FILE_STRUCTURE.md` — planned file and folder layout for the codebase.

## MAIN RULES

### Architecture

- **Feature-first organization.** Each command lives under `features/`. Simple commands: one file with everything (validation, prompts, logic, error handling, store updates). Complex commands: one folder with sub-modules. Services (`services/`) handle shared data access and shared infrastructure. Cross-cutting business logic (auth, permissions) may live in services.
- **Unidirectional data flow.** Extension is the single source of truth. Webview sends commands via `postMessage({type: "command", command, data})`, never mutates state. Extension pushes state via `postMessage({type: "update", data})`. Prefer full state snapshots for simplicity; use targeted updates only when profiling shows performance issues. All messages must use a shared TypeScript union type.
- **No large classes.** Each class must have a TSDoc comment explaining: what it does, where it fits, why it exists as a class vs. a module. For significant architectural decisions, write an ADR in `docs/decisions/`.

### Extension Lifecycle

- **Disposable pattern is mandatory.** Push every `Disposable` returned by `registerCommand`, `onDid*`, `createFileSystemWatcher`, `registerWebviewViewProvider`, and any other registration into `context.subscriptions`. Leaked disposables cause ghost handlers and memory growth.
- **Specific activation events only.** Never use `*`. Use `onView:vscode-agentic.agents`, `onCommand:vscode-agentic.*`. Note: since VS Code 1.74, commands declared in `contributes.commands` generate implicit activation events automatically — explicit `onCommand` entries are often unnecessary.
- **No heavy work in `activate()`.** Activation blocks the extension host (single-threaded). Defer expensive work (file scanning, network, git) to after activation completes using async IIFE or setTimeout.
- **Use `context.extensionUri` for all extension resource paths.** Never use `__dirname` — it breaks in web extensions, remote SSH, and bundled environments.
- **Use `setContext` to control command/menu availability.** `vscode.commands.executeCommand('setContext', 'myExt.hasRepos', true)` + `when` clauses in `package.json`.

### Commands & Input

- **Always validate quick pick / input box results for `undefined`.** User pressing Escape returns `undefined` — skipping this check causes runtime errors.
- **Follow VS Code event naming: `on[Will|Did]VerbNoun`.** e.g., `onDidChangeConfiguration`, `onWillSaveTextDocument`.

### Configuration

- **Expose user-facing settings through `contributes.configuration`.** Read via `vscode.workspace.getConfiguration('vscode-agentic')`. Avoid hardcoding values users should be able to change.
- **React to settings changes at runtime.** Use `onDidChangeConfiguration` with `affectsConfiguration()`. Don't read config once at activation.

### Webview Security & Communication

- **Always set CSP in webview HTML with fresh nonces.** Generate a new 32-char random nonce each render. Reusing nonces defeats CSP.
- **Use `webview.asWebviewUri()` for all resource URIs.** Direct file paths are blocked by CSP.
- **Use `postMessage` / `onDidReceiveMessage` for all communication.** Always validate message shape on receive.
- **Handle webview disposal.** `onDidDispose` fires when destroyed — clean up intervals, listeners, subscriptions.
- **Use `setState` / `getState` for lightweight persistence.** Survives hide/show, cheaper than `retainContextWhenHidden`. Avoid `retainContextWhenHidden` unless absolutely necessary — it keeps the entire DOM alive in memory.
- **`acquireVsCodeApi()` once and cache.** Calling it twice throws an error.

### State Management

- **`globalState` for cross-workspace data** (agent configs, repo paths). **`workspaceState` for workspace-specific state** (collapsed sections, UI preferences).
- **Always provide defaults when reading Memento:** `globalState.get(key, defaultValue)`.
- **Fire change events after every store mutation** using `vscode.EventEmitter`. The webview provider reacts to changes.
- **Never mutate stored objects directly.** Clone, modify, then save. Memento stores by reference — mutations without save are lost on restart.
- **Use `SecretStorage` for tokens and credentials.** Never store secrets in `globalState` — it's not encrypted.

### Git Operations

- **Use `--no-optional-locks` for read-only git operations.** Prevents `.git/index.lock` contention during status checks.
- **Set timeouts on all git child processes.** 10-30s for status/branch operations. 120s+ for fetch/clone/checkout.
- **Parse porcelain output, not human-readable.** `git status --porcelain`, `git worktree list --porcelain` — machine-parseable, stable across git versions. Use `-z` for NUL-delimited output to handle special characters.
- **Validate branch names before passing to git.** Reject `~^:?*[\\`, `..`, `.lock` suffix. Invalid characters cause cryptic errors or command injection.
- **Use per-repo mutexes for worktree operations.** Concurrent `git worktree add/remove` on the same repo corrupts the worktree list.
- **Clean up worktrees on agent deletion.** Run `git worktree remove` then `git worktree prune`.

### Terminal Management

- **Use unique terminal names:** `"AgentName (repo)"` pattern.
- **Listen for `onDidCloseTerminal` to update agent status.** Check `terminal.exitStatus`: `exitCode === 0` → "finished", `exitCode !== 0` → "error", `undefined` → "stopped by user".
- **Set `cwd` when creating terminals.** Always set working directory explicitly.
- **Use `sendText()` to send commands to existing terminals.** Don't create new terminals for follow-up commands.
- **Dispose terminal references when the terminal closes.** Remove from tracking map to prevent memory leaks.

### Error Handling

- **Use `vscode.window.showErrorMessage` for user-facing errors.** Never silently swallow errors.
- **Use a `LogOutputChannel` for structured logging.** Create via `vscode.window.createOutputChannel('Agentic', { log: true })`. Use `trace` for function entry, `info` for operations, `warn`/`error` for problems. Never use raw `console.log` in production.
- **Wrap every async command handler in try/catch.** Unhandled rejections crash silently with no user feedback.
- **Never show raw stack traces to users.** Parse and show human-readable messages. Log full details to the output channel.

### Extension UI

- Use React 19 with hooks. Strict component hierarchy:
  - `atoms/` — pure presentational, props only, no hooks, no context, no child components.
  - `molecules/` — compose atoms, no business logic.
  - `views/` — compose molecules/atoms, only UI state (isDropdownOpen, isExpanded).
  - `pages/` — all business logic lives in hooks, render only a view with props.
  - `hooks/` — all business logic, data fetching, command dispatching. Clean up event listeners in `useEffect` return.
  - `styles/` — CSS files using VS Code theme variables exclusively.
- **Use CSS custom properties (VS Code theme variables) everywhere.** `var(--vscode-foreground)`, `var(--vscode-button-background)`. Never hardcode colors.
- **Use Codicons** (`@vscode/codicons`) for icons. Same icons as native VS Code.
- **Use `key` prop with stable unique identifiers** in lists, not array indices.
- **Include error boundaries in React webview.** Unhandled React errors leave a blank webview with no recovery.

### Build

- **Separate TypeScript configs:** `tsconfig.json` for extension (Node.js, CommonJS), `tsconfig.webview.json` for React (browser, DOM libs, JSX).
- **Externalize `vscode` module in bundler:** `external: ["vscode"]`. The module is provided by the runtime.

---

## SECONDARY RULES

### Code Style

- All function declarations use `const <name> = (<args>) => {}`. Prefer arrow functions for consistency and lexical `this`. `function` declarations are acceptable for top-level named exports when hoisting improves readability.
- Maintain an `ARCHITECTURE.md` at the project root describing the high-level folder structure. Individual `.md` files are only required in folders whose purpose is non-obvious or that serve as module boundaries (e.g., `src/ui/`, `src/features/`).

### Extension Lifecycle

- Since VS Code 1.74, commands declared in `contributes.commands` auto-activate the extension. For programmatically registered commands not in `contributes`, add explicit `onCommand` activation events.
- If `deactivate()` needs async cleanup, return a Promise — VS Code waits ~5 seconds. Caution: most VS Code APIs (including `globalState.update`) may already be unavailable during deactivation. Use direct `fs` for critical cleanup. Never rely on `deactivate()` for essential state persistence.
- Use `context.extensionMode` to detect development vs production (`ExtensionMode.Development`, `Production`, `Test`). Adjust logging verbosity accordingly.
- Use `context.extension.packageJSON` to read package.json at runtime. Don't import or read the file manually.
- Check `vscode.env.uiKind` for Desktop vs Web when targeting multiple platforms.

### Commands & Input

- Prefix all command IDs with the extension name: `vscode-agentic.createAgent`. Prevents collisions.
- Use `category` in command declarations for Command Palette grouping: `"category": "Agentic"` → "Agentic: Create Agent".
- Add `placeHolder` text to input boxes and quick picks when the expected input is not obvious from context.
- Use `validateInput` for real-time input validation when inputs have constraints (branch names, identifiers).
- Use `ignoreFocusOut: true` for multi-step input flows. Prevents dismissal when user clicks elsewhere.
- Use `when` to hide irrelevant commands and `enablement` to grey out temporarily unavailable ones.
- Show confirmation dialogs before destructive commands. Use `WorkspaceEdit` for text changes to leverage the built-in undo stack.

### Configuration

- Scope configuration reads to the resource in multi-root: `getConfiguration('vscode-agentic', resourceUri)`.
- For settings with complex constraints not covered by JSON schema, validate values at read time.
- Use `markdownDescription` for settings that benefit from formatted descriptions (links, code examples).
- Use `enum` for settings with fixed options — VS Code renders a dropdown.

### Webview

- Send initial state immediately after webview resolves in `resolveWebviewView`.
- Handle `onDidChangeVisibility` for WebviewView (sidebar). Pause updates when not visible.
- Consider debouncing high-frequency `postMessage` calls to avoid webview jank.

### State Management

- Call `globalState.setKeysForSync` to enable Settings Sync across machines.
- Prefer a single store key per data collection for simplicity. Consider splitting for large datasets to avoid serialization overhead.
- Version your stored data schema. Add a schema version number. Migrate on activation if the version is old.
- Consider optimistic UI updates for operations involving external processes (git, network) where latency is noticeable.

### Git Operations

- Set `maxBuffer` (10MB) when using `exec` for git commands. For unbounded output (diff, log), prefer `spawn` with streaming.
- Handle `ENOENT` errors when the repo directory is deleted externally. Show "Repository not found" instead of crashing.
- Check git availability and version on first git operation (not activation) to avoid startup overhead. Require Git 2.15+ for `--no-optional-locks`.

### Terminal Management

- Track terminals by composite key: `repoPath::agentName` in a Map.
- Use `terminal.show(preserveFocus)` carefully. `show(true)` keeps focus, `show(false)` steals focus.
- Prefer `sendText()` after terminal creation for initial commands. Use `shellArgs` only for flags to the shell executable itself.
- Handle terminal creation failure gracefully. Catch errors and show error message instead of leaving agent in "running" state.

### Error Handling

- Include actionable buttons in error messages: `showErrorMessage("Failed", "Retry", "Open Settings")`.
- Use typed errors: `GitError`, `WorktreeError`, `ValidationError` — each with specific properties.
- Handle `CancellationToken` in long operations. `withProgress` provides a token when `cancellable: true`.
- Use `withProgress()` for operations that may take > 1-2 seconds. Consider a short delay before showing the indicator to avoid flicker.
- Apply exponential backoff for operations with known transient failures (git lock contention, network timeouts). Do not retry non-transient errors.

### React & UI

- Consider `React.memo` for atoms rendered in lists or with stable primitive props — but profile first; trivial components often render faster than the memo comparison.
- Use `useCallback` for event handlers passed to memoized child components.
- Prefer conditional rendering over CSS `display:none` to reduce DOM size. Exception: use CSS hiding for frequently toggled elements where remounting is expensive.
- Use semantic HTML: `<button>`, `<section>`, `<header>` — not `<div onClick>`.
- Debounce rapid UI interactions. Disable buttons while operations are in progress.
- Aim to keep component files under 150-200 lines. If exceeded, evaluate decomposition, but prioritize single responsibility over arbitrary line counts.

### Build & Testing

- Use `--sourcemap` in development builds only. Source maps in production increase VSIX size.
- Write unit tests for pure functions (validation, parsing, data transforms). No VS Code API mocking needed.
- Use `@vscode/test-electron` for integration tests that need the VS Code API.
