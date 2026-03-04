# External Integrations

**Analysis Date:** 2026-03-04

## APIs & External Services

**Claude Code CLI:**
- Service: Anthropic Claude Code CLI (`claude` binary)
- What it's used for: Each agent runs a VS Code terminal with `shellPath: "claude"`. The extension invokes `claude [initialPrompt]` for first run and `claude --continue` for session resume.
- SDK/Client: Spawned via `vscode.window.createTerminal` (no npm SDK). Health-checked on activation via `execFile("claude", ["--version"])`.
- Auth: Managed entirely by the Claude CLI itself (user configures it separately). The extension has no direct API key handling.
- Files: `src/services/terminal.service.ts`, `src/extension.ts`

**GitHub CLI (`gh`):**
- Service: GitHub CLI (`gh` binary)
- What it's used for: Creating pull requests from agent branches to staging branches via `vscode-agentic.createPR` command.
- SDK/Client: Invoked via `execFile("gh", ["pr", "create", ...])` with `promisify(execFile)`.
- Auth: Managed by `gh` CLI session (user runs `gh auth login` separately).
- Files: `src/commands/diff.commands.ts`
- Optional: The extension degrades gracefully if `gh` is absent (shows install link error).

**Git CLI:**
- Service: System `git` binary
- What it's used for: All worktree operations (`git worktree add/remove/list`), branch management (`git branch -D`, `git rev-parse`), diff operations (`git diff --name-only`), file content retrieval (`git show`).
- SDK/Client: Invoked via `execFile("git", args)` wrapped in `GitService.exec()` with 30s timeout and 10 MB buffer.
- Auth: Relies on system git credential configuration.
- Files: `src/services/git.service.ts` - all git interactions route through this service.

## Data Storage

**Databases:**
- None - no external database. All state is persisted locally.

**VS Code Memento (workspaceState):**
- Type: VS Code built-in key-value store (JSON serialized, scoped to workspace)
- Client: `vscode.Memento` injected into services via constructor
- Keys persisted:
  - `vscode-agentic.agentRegistry` (`AgentEntry[]`) - all agent metadata; defined in `src/models/agent.ts`
  - `vscode-agentic.pidRegistry` (`Record<string, number>`) - terminal PID map for orphan detection; defined in `src/models/agent.ts`
  - `vscode-agentic.lastFocusedAgent` (`string`) - compound key of last-focused agent; defined in `src/models/agent.ts`
  - `vscode-agentic.worktreeManifest` (`WorktreeEntry[]`) - worktree path/branch metadata; defined in `src/models/worktree.ts`
  - `vscode-agentic.repoConfigs` (`RepoConfig[]`) - user-configured repos and staging branches; defined in `src/models/repo.ts`
- Files: `src/services/agent.service.ts`, `src/services/worktree.service.ts`, `src/services/repo-config.service.ts`, `src/services/terminal.service.ts`

**File Storage:**
- Git worktrees on local disk: Created under `{repoPath}/.worktrees/{agentName}/`. Directory name constant `WORKTREE_DIR_NAME = ".worktrees"` in `src/models/worktree.ts`.
- `.gitignore` entries: Extension writes `.worktrees/` to the repo's `.gitignore` on repo add via `src/utils/gitignore.ts`.

**Caching:**
- In-memory TTL diff status cache in `AgentTreeProvider` (`src/views/agent-tree-provider.ts`) - caches `hasUnmergedChanges` results per agent to avoid repeated git calls on tree refresh.

## Authentication & Identity

**Auth Provider:**
- None (custom or otherwise). The extension itself has no authentication layer.
- Claude CLI auth: handled by `claude` CLI binary outside extension scope.
- GitHub auth: handled by `gh` CLI binary outside extension scope.
- Git credentials: handled by system git credential manager outside extension scope.

## Monitoring & Observability

**Error Tracking:**
- None - no external error tracking service (e.g., Sentry) integrated.

**Logs:**
- VS Code output channel: Not used. Errors surfaced directly via `vscode.window.showErrorMessage` / `vscode.window.showWarningMessage`.
- `console.error` in `esbuild.js` build script only.
- Extension activation errors shown as VS Code notifications with human-readable messages.

## CI/CD & Deployment

**Hosting:**
- VS Code Marketplace (published via `@vscode/vsce`)
- Repository: `https://github.com/wimmol/vscode-agentic.git`

**CI Pipeline:**
- Not detected in codebase (no `.github/workflows/` directory observed).

**Packaging:**
- `npm run package` produces production bundle; `vscode:prepublish` hook ensures this runs before marketplace publish.

## Environment Configuration

**Required env vars:**
- None - the extension reads no environment variables directly.
- All external tool auth (Claude, GitHub, git) is configured via those tools' own credential stores.

**VS Code Settings (user-configurable at runtime):**
- `vscode-agentic.maxAgentsPerRepo` - integer, default 5, scope: resource
- `vscode-agentic.maxWorktreesPerRepo` - integer, default 5, scope: resource
- `vscode-agentic.maxConcurrentAgents` - integer, default 10, scope: resource

**Secrets location:**
- No secrets stored by the extension. No `.env` files present.

## Webhooks & Callbacks

**Incoming:**
- None - extension is a VS Code client; it receives no inbound HTTP webhooks.

**Outgoing:**
- None - extension makes no direct HTTP calls. All external communication is via spawned CLI processes (`claude`, `gh`, `git`).

## Custom URI Scheme

**`agentic-git://` TextDocumentContentProvider:**
- Purpose: Serves git file content at specific refs for side-by-side diff view.
- Scheme: `agentic-git` (constant `GitContentProvider.SCHEME`)
- URI format: `agentic-git:/{filePath}?repo={encoded}&ref={encoded}&path={encoded}`
- Registered via `vscode.workspace.registerTextDocumentContentProvider`
- Files: `src/providers/git-content.provider.ts`
- Used by: `src/commands/diff.commands.ts` `reviewChanges` command to open VS Code native diff editor

---

*Integration audit: 2026-03-04*
