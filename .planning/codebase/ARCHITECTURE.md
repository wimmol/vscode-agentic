# Architecture

**Analysis Date:** 2026-03-04

## Pattern Overview

**Overall:** VS Code Extension with layered service architecture

**Key Characteristics:**
- Single activation entry point (`src/extension.ts`) wires all services via constructor injection
- Services own domain logic; commands own user interaction logic; views own display logic
- All state persisted through `vscode.Memento` (workspaceState) — no external database
- Event-driven UI refresh: `AgentService` fires `onDidChangeAgents`, `AgentTreeProvider` subscribes and debounces tree refresh
- One resolved circular dependency: `AgentService` ↔ `TerminalService` broken via `setTerminalService()` setter pattern

## Layers

**Models (`src/models/`):**
- Purpose: TypeScript interfaces, type aliases, and Memento key constants — no logic
- Location: `src/models/`
- Contains: `AgentEntry`, `AgentStatus`, `WorktreeEntry`, `RepoConfig`, and their associated Memento key constants
- Depends on: nothing (pure types)
- Used by: all services, commands, views

**Services (`src/services/`):**
- Purpose: All business logic — git operations, agent lifecycle, terminal management, state persistence, diff computation
- Location: `src/services/`
- Contains: `AgentService`, `WorktreeService`, `TerminalService`, `GitService`, `DiffService`, `RepoConfigService`, `WorkspaceSwitchService`
- Depends on: models, `vscode.Memento`, VS Code APIs, Node.js `child_process`
- Used by: commands, views, `extension.ts`

**Commands (`src/commands/`):**
- Purpose: VS Code command handler registration — UI interaction only (QuickPick, InputBox, warnings)
- Location: `src/commands/`
- Contains: `agent.commands.ts`, `diff.commands.ts`, `repo.commands.ts`, `sidebar.commands.ts`, `worktree.commands.ts`
- Depends on: services, models, VS Code APIs
- Used by: `extension.ts` (registers all commands at activation)

**Views (`src/views/`):**
- Purpose: Sidebar TreeDataProvider and TreeItem definitions for the Agents panel
- Location: `src/views/`
- Contains: `AgentTreeProvider` (implements `vscode.TreeDataProvider`), `AgentTreeItem`, `RepoGroupItem`
- Depends on: `AgentService`, `DiffService`, models
- Used by: `extension.ts` (creates `vscode.TreeView`)

**Providers (`src/providers/`):**
- Purpose: VS Code content provider — serves file content at a specific git ref for diff views
- Location: `src/providers/`
- Contains: `GitContentProvider` (implements `vscode.TextDocumentContentProvider`, scheme: `agentic-git`)
- Depends on: `GitService`
- Used by: `extension.ts` (registers scheme), `diff.commands.ts` (builds URIs)

**Utils (`src/utils/`):**
- Purpose: Pure stateless helper functions — parsing, validation, filesystem helpers
- Location: `src/utils/`
- Contains: `worktree-parser.ts`, `gitignore.ts`, `branch-validation.ts`
- Depends on: models, Node.js `fs`
- Used by: services

## Data Flow

**Agent Creation Flow:**

1. User invokes `vscode-agentic.createAgent` command (or clicks `+` inline button)
2. `agent.commands.ts` validates repo selection, prompts for agent name (with branch validation via `isValidBranchName`), optional initial prompt
3. Command calls `agentService.createAgent(repoPath, agentName, initialPrompt)`
4. `AgentService` checks per-repo and global limits; throws `AgentLimitError` if exceeded
5. `AgentService` calls `worktreeService.addWorktree(repoPath, agentName)` — runs `git worktree add -b <branch>` into `<repoPath>/.worktrees/<agentName>/`
6. `AgentService` creates `AgentEntry` with `status: "created"`, persists to Memento via `workspaceState.update(AGENT_REGISTRY_KEY, ...)`
7. `AgentService` fires `_onDidChangeAgents` event
8. `AgentTreeProvider` receives event, debounces (150ms), calls `refresh()` → sidebar updates

**Agent Focus/Run Flow:**

1. User clicks agent tile in sidebar — fires `vscode-agentic.focusAgentFromTile` command
2. `sidebar.commands.ts` calls `workspaceSwitchService.switchToAgent(repoPath, agentName)`
3. `WorkspaceSwitchService` calls `agentService.focusAgent()` and (if cross-repo) adds worktree folder to VS Code workspace
4. `AgentService.focusAgent` calls `terminalService.createTerminal(repoPath, agentName, worktreePath, initialPrompt?, continueSession?)`
5. `TerminalService` creates a `vscode.Terminal` with `shellPath: "claude"`, `cwd: worktreePath`, marks as `isTransient: true`
6. First run: passes `initialPrompt` as `shellArgs`; subsequent runs: passes `["--continue"]`
7. Terminal PID tracked in Memento (`PID_REGISTRY_KEY`) for orphan cleanup on next activation
8. Agent status updated to `"running"` in Memento; `onDidChangeAgents` fires; sidebar refreshes

**Terminal Exit / Status Update Flow:**

1. `TerminalService` subscribes to `vscode.window.onDidCloseTerminal`
2. On terminal close: identifies agent by terminal identity (`===` comparison), computes status (`"finished"` or `"error"` based on exit code)
3. Calls `onStatusChange` callback (set in `extension.ts` as `agentService.updateStatus`)
4. `AgentService.updateStatus` writes new status to Memento, fires `onDidChangeAgents`
5. If terminal closed in background: fires `onBackgroundExit` callback → shows `showInformationMessage` notification

**Diff Review Flow:**

1. User clicks "Review Changes" on an agent tile (shown only when `viewItem =~ /WithDiffs$/`)
2. `diff.commands.ts` calls `diffService.getChangedFiles(repoPath, agentBranch)` — runs `git diff --name-only <staging>...<agentBranch>`
3. Command shows QuickPick of changed files; user selects one
4. Command builds two `agentic-git:` URIs via `GitContentProvider.buildUri(repoPath, ref, filePath)` — one for staging ref, one for agent branch ref
5. Runs `vscode.diff` command — VS Code calls `GitContentProvider.provideTextDocumentContent` to fetch each side via `git show <ref>:<path>`

**State Management:**

- All persistent state lives in `vscode.Memento` (`workspaceState`), keyed by constants from `src/models/`
- Keys: `vscode-agentic.agentRegistry` (agent list), `vscode-agentic.worktreeManifest` (worktree list), `vscode-agentic.repoConfigs` (repo list), `vscode-agentic.pidRegistry` (active PIDs), `vscode-agentic.lastFocusedAgent` (last-focused key)
- No in-memory caches for agent/worktree data — every read goes through `state.get()`
- Exception: `AgentTreeProvider` maintains a TTL diff cache (`Map<string, boolean>` + `Map<string, number>` timestamps, 30-second TTL)

## Key Abstractions

**AgentEntry:**
- Purpose: Persistent record of one agent session — the core domain object
- Examples: `src/models/agent.ts`
- Pattern: Plain data interface; no methods. Fields: `agentName`, `repoPath`, `status: AgentStatus`, `initialPrompt?`, `createdAt`, `exitCode?`, `hasBeenRun?`

**AgentStatus:**
- Purpose: Lifecycle state machine for agents
- Examples: `src/models/agent.ts`
- Pattern: `"created" | "running" | "finished" | "error" | "suspended"` — used to drive UI icons, command availability (via `contextValue`), and terminal behavior

**WorktreeEntry:**
- Purpose: Persistent record of a git worktree on disk
- Examples: `src/models/worktree.ts`
- Pattern: Plain data interface; always stored at `<repoPath>/.worktrees/<agentName>/`

**GitService:**
- Purpose: Thin wrapper around `git` CLI via Node.js `execFile`
- Examples: `src/services/git.service.ts`
- Pattern: All git operations go through `gitService.exec(repoPath, args[])` — 30s timeout, 10MB buffer, throws `GitError` on failure

**Circular Dependency Resolution:**
- Pattern: `AgentService` depends on `TerminalService` for `focusAgent`/`deleteAgent`; `TerminalService` depends on an `onStatusChange` callback that calls `AgentService.updateStatus`
- Resolved in `extension.ts` by constructing both separately, then calling `agentService.setTerminalService(terminalService)`

## Entry Points

**Extension Activation:**
- Location: `src/extension.ts` — `activate(context)` function
- Triggers: VS Code extension activation (any contributes activation event)
- Responsibilities:
  1. Constructs all service singletons in dependency order
  2. Resolves circular dependency via `agentService.setTerminalService(terminalService)`
  3. Creates `AgentTreeProvider` and `vscode.TreeView`
  4. Registers all command groups (`registerRepoCommands`, `registerAgentCommands`, `registerSidebarCommands`, `registerDiffCommands`)
  5. Registers `GitContentProvider` for `agentic-git:` scheme
  6. Pushes disposables to `context.subscriptions`
  7. Runs health checks for `git` and `claude` CLI (non-blocking)
  8. Runs ordered reconciliation sequence (fire-and-forget): worktree reconcile → agent reconcile → orphan process cleanup → diff cache warm → reveal last-focused agent

**Extension Deactivation:**
- Location: `src/extension.ts` — `deactivate()` function
- Cleanup: delegated entirely to `context.subscriptions` disposables (empty function body)

## Error Handling

**Strategy:** Typed error classes for expected domain failures; unhandled exceptions bubble to command caller (VS Code shows generic error)

**Patterns:**
- `AgentLimitError` (from `src/services/agent.service.ts`): thrown by `createAgent` when per-repo or global limit is reached; caught in `agent.commands.ts` which offers to auto-suspend an idle agent and retry
- `WorktreeLimitError` (from `src/services/worktree.service.ts`): thrown by `addWorktree` when per-repo worktree limit is reached; handled in `src/commands/worktree.commands.ts`
- `GitError` (from `src/services/git.service.ts`): thrown by `GitService.exec`; most callers catch and return graceful fallbacks (empty array, false)
- Services swallow expected errors gracefully: `DiffService` returns `false`/`[]` on any git error; `WorktreeService.removeWorktree` ignores "worktree/branch already gone" errors; `TerminalService.trackPid` is best-effort
- All user-facing errors surface via `vscode.window.showErrorMessage` or `showWarningMessage`

## Cross-Cutting Concerns

**Logging:** None — no structured logging framework. Development errors use `console.error` only in `esbuild.js`

**Validation:** Branch name validation in `src/utils/branch-validation.ts` (`isValidBranchName`), called as a VS Code `validateInput` callback in `agent.commands.ts`

**Authentication:** Not applicable — extension operates on local git repos; `gh` CLI handles GitHub auth for PR creation

**Concurrency:** `WorktreeService` implements a per-repo mutex (`withLock`) using chained Promises to prevent TOCTOU races on `addWorktree`/`removeWorktree`

**Resource Limits:** Enforced by config settings `maxAgentsPerRepo` (default 5), `maxWorktreesPerRepo` (default 5), `maxConcurrentAgents` (default 10) — read from `vscode.workspace.getConfiguration` at call time (not cached)

---

*Architecture analysis: 2026-03-04*
