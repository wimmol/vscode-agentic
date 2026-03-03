# Architecture Research

**Domain:** VS Code extension -- multi-repo multi-agent workspace manager
**Researched:** 2026-03-04
**Confidence:** HIGH (VS Code extension API is well-documented; patterns are established)

## Standard Architecture

### System Overview

```
+-----------------------------------------------------------------------+
|                        VS Code Extension Host                         |
+-----------------------------------------------------------------------+
|                                                                       |
|  +------------------+    +------------------+    +-----------------+  |
|  | Extension Entry  |    | Command          |    | Configuration   |  |
|  | (activate/       |--->| Registry         |--->| Service         |  |
|  |  deactivate)     |    |                  |    |                 |  |
|  +--------+---------+    +--------+---------+    +-----------------+  |
|           |                       |                                   |
|           v                       v                                   |
|  +------------------+    +------------------+                         |
|  | Service          |    | Event Bus        |                         |
|  | Container        |<-->| (EventEmitters)  |                         |
|  +--------+---------+    +--------+---------+                         |
|           |                       |                                   |
|     +-----+-----+-------+--------+-------+--------+                  |
|     |           |        |                |        |                  |
|     v           v        v                v        v                  |
|  +------+  +-------+  +--------+  +----------+  +--------+          |
|  |Agent |  |Work-  |  |Terminal|  |Sidebar   |  |Git     |          |
|  |Mgr   |  |tree   |  |Manager|  |Tree View |  |Service |          |
|  |      |  |Mgr    |  |       |  |Provider  |  |        |          |
|  +--+---+  +---+---+  +---+---+  +----+-----+  +---+----+          |
|     |          |           |           |            |                 |
+-----+----------+-----------+-----------+------------+-----------------+
      |          |           |           |            |
      v          v           v           v            v
  +-------+  +-------+  +--------+  +--------+  +--------+
  |Agent  |  |Git    |  |VS Code |  |VS Code |  |Git CLI |
  |State  |  |Work-  |  |Terminal|  |TreeView|  |(child  |
  |Store  |  |trees  |  |API     |  |API     |  |process)|
  +-------+  +-------+  +--------+  +--------+  +--------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Extension Entry | Bootstrap all services, register disposables, handle lifecycle | `activate()` / `deactivate()` in `extension.ts` |
| Service Container | Create and wire services, manage singleton lifecycle | Simple factory object (no DI framework needed at this scale) |
| Command Registry | Register VS Code commands, route to service methods | `vscode.commands.registerCommand()` wrappers |
| Event Bus | Decouple components via typed events | `vscode.EventEmitter<T>` instances per event type |
| Agent Manager | CRUD for agent sessions, lifecycle (create/suspend/resume/delete) | Central coordinator class owning agent state |
| Worktree Manager | Create/list/remove git worktrees, map agents to worktrees | Wrapper around `git worktree` CLI commands via `child_process` |
| Terminal Manager | Create/show/hide/dispose terminals, track terminal-to-agent mapping | Pool of `vscode.Terminal` instances with lazy creation |
| Sidebar Tree View Provider | Render agent tiles grouped by repo, handle click/context actions | `TreeDataProvider<AgentTreeItem>` implementation |
| Git Service | Branch operations, diff detection, merge status checks | Thin wrapper around git CLI using `child_process.execFile` |
| Configuration Service | Per-repo settings (staging branch name, etc.), extension settings | `vscode.workspace.getConfiguration()` + `workspaceState` |

## Recommended Project Structure

```
src/
  extension.ts              # Entry point: activate/deactivate, bootstrap
  container.ts              # Service container: creates and wires all services
  types.ts                  # Shared interfaces and types (IAgent, IRepo, etc.)
  constants.ts              # Command IDs, view IDs, config keys

  services/
    agent-manager.ts        # Agent lifecycle: create, suspend, resume, delete
    terminal-manager.ts     # Terminal pool: create, show, hide, dispose
    worktree-manager.ts     # Git worktree operations
    git-service.ts          # Git CLI wrapper: branch, diff, merge
    config-service.ts       # Extension and workspace configuration
    layout-manager.ts       # Editor/panel layout orchestration

  providers/
    agent-tree-provider.ts  # TreeDataProvider for sidebar agent tiles
    repo-tree-provider.ts   # TreeDataProvider for repo grouping (or combined)

  models/
    agent.ts                # Agent data model and state
    repo.ts                 # Repository data model

  views/
    agent-tree-item.ts      # TreeItem subclass for agent tiles
    repo-tree-item.ts       # TreeItem subclass for repo groups

  utils/
    git-cli.ts              # Low-level git command execution
    process.ts              # Child process helpers with error handling
    disposable.ts           # Disposable collection utilities

  state/
    store.ts                # Centralized state (agents, repos, mappings)
    persistence.ts          # Save/restore state via workspaceState/globalState
```

### Structure Rationale

- **services/:** Each service owns one domain concern. Services communicate through events, not direct references to each other's internals. This is the pattern VS Code's own Git extension uses -- a `Model` class as central manager with distinct service classes for operations.
- **providers/:** VS Code API integration layer. Providers implement VS Code interfaces (`TreeDataProvider`) and delegate all logic to services. Keeps VS Code API coupling in one place.
- **models/:** Pure data structures with no VS Code API imports. Makes them testable and serializable for persistence.
- **views/:** TreeItem subclasses and any view-specific rendering logic. Separate from providers because items have their own display logic (icons, descriptions, context values).
- **state/:** Centralized state management. Agent-to-terminal mappings, agent-to-worktree mappings, repo configurations. Persisted via VS Code's Memento API (`workspaceState`).
- **utils/:** Shared utilities with no business logic. Git CLI execution, process management, disposable helpers.

## Architectural Patterns

### Pattern 1: Service-Event Architecture (Primary Pattern)

**What:** Services own domains and communicate via typed `vscode.EventEmitter` events. No service directly calls methods on another service's internals. The Agent Manager fires `onAgentCreated`, the Terminal Manager subscribes and creates a terminal. The Sidebar Tree Provider subscribes and refreshes.

**When to use:** Always. This is the core pattern for the entire extension.

**Trade-offs:** Slight indirection makes debugging event chains harder, but prevents the spaghetti coupling that kills extensions at this complexity level.

**Example:**
```typescript
// Agent Manager fires events
class AgentManager {
  private _onAgentCreated = new vscode.EventEmitter<Agent>();
  readonly onAgentCreated = this._onAgentCreated.event;

  private _onAgentSuspended = new vscode.EventEmitter<Agent>();
  readonly onAgentSuspended = this._onAgentSuspended.event;

  async createAgent(repo: Repo, name: string): Promise<Agent> {
    const agent = new Agent(repo, name);
    // ... create worktree, persist state
    this._onAgentCreated.fire(agent);
    return agent;
  }
}

// Terminal Manager reacts
class TerminalManager {
  constructor(agentManager: AgentManager) {
    agentManager.onAgentCreated((agent) => {
      // Lazy: don't create terminal yet, wait until focus
    });
  }
}

// Tree provider reacts
class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeItem> {
  constructor(agentManager: AgentManager) {
    agentManager.onAgentCreated(() => {
      this._onDidChangeTreeData.fire();
    });
  }
}
```

### Pattern 2: Lazy Terminal Pool

**What:** Terminals are expensive (each is a shell process). Only create a terminal when the user actually focuses an agent. When an agent is not focused, its terminal can be hidden. When suspended, the terminal is disposed entirely and state is saved for restoration.

**When to use:** Terminal management. This directly addresses the RAM optimization requirement.

**Trade-offs:** Adds complexity to terminal lifecycle, but essential for handling 2-5+ concurrent agents without exhausting memory.

**Example:**
```typescript
class TerminalManager {
  private terminals = new Map<string, vscode.Terminal>(); // agentId -> Terminal

  async focusAgent(agent: Agent): Promise<void> {
    let terminal = this.terminals.get(agent.id);
    if (!terminal) {
      terminal = vscode.window.createTerminal({
        name: `Agent: ${agent.name}`,
        cwd: agent.worktreePath,
        env: { /* agent-specific env */ },
      });
      this.terminals.set(agent.id, terminal);
      // Start Claude Code CLI in the terminal
      terminal.sendText(`claude --resume ${agent.sessionId || ''}`);
    }
    terminal.show(true); // preserveFocus = true
  }

  async suspendAgent(agent: Agent): Promise<void> {
    const terminal = this.terminals.get(agent.id);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(agent.id);
    }
  }
}
```

### Pattern 3: Disposable Collection for Lifecycle Management

**What:** Every subscription, terminal, watcher, and event listener is tracked as a `vscode.Disposable` and cleaned up on deactivation. VS Code extensions that leak disposables cause memory issues and ghost processes.

**When to use:** Always. Every `registerCommand`, `onDid*` listener, terminal, and file watcher must be tracked.

**Trade-offs:** None -- this is mandatory, not optional.

**Example:**
```typescript
export function activate(context: vscode.ExtensionContext) {
  const container = new ServiceContainer(context);

  // All service disposables flow into context.subscriptions
  context.subscriptions.push(
    container.agentManager,
    container.terminalManager,
    container.worktreeManager,
    container.gitService,
    ...container.commands,
  );
}
```

### Pattern 4: State Persistence via Memento

**What:** Agent definitions, repo configurations, and session metadata are persisted using `ExtensionContext.workspaceState` (per-workspace) and `ExtensionContext.globalState` (cross-workspace). This survives VS Code restarts.

**When to use:** For all data that must survive between sessions -- agent list, repo-to-staging-branch mappings, agent suspension state.

**Trade-offs:** Memento API is key-value only with JSON serialization. Fine for metadata. Not suitable for terminal scroll-back or large binary state.

**Example:**
```typescript
class StateStore {
  constructor(private state: vscode.Memento) {}

  getAgents(): Agent[] {
    return this.state.get<Agent[]>('agents', []);
  }

  async saveAgents(agents: Agent[]): Promise<void> {
    await this.state.update('agents', agents);
  }

  getRepoConfig(repoPath: string): RepoConfig | undefined {
    const configs = this.state.get<Record<string, RepoConfig>>('repoConfigs', {});
    return configs[repoPath];
  }
}
```

## Data Flow

### Agent Creation Flow

```
User clicks "New Agent" in sidebar
    |
    v
Command: agentic.createAgent
    |
    v
AgentManager.createAgent(repo, name)
    |
    +---> WorktreeManager.createWorktree(repo, branchName)
    |         |
    |         v
    |     git worktree add ../worktrees/<name> -b <name>
    |         |
    |         v
    |     Returns worktree path
    |
    +---> StateStore.saveAgents(updatedList)
    |
    +---> fires onAgentCreated event
              |
              +---> AgentTreeProvider refreshes sidebar
              +---> (Terminal NOT created yet -- lazy)
```

### Agent Focus/Switch Flow

```
User clicks agent tile in sidebar
    |
    v
AgentTreeProvider.onItemClicked(agentItem)
    |
    v
LayoutManager.switchToAgent(agent)
    |
    +---> Is agent in same repo as current?
    |         |
    |     YES: Switch only agent panel + code view
    |         |
    |         +---> TerminalManager.focusAgent(agent)
    |         |         |
    |         |         v
    |         |     Create terminal if needed (lazy)
    |         |     terminal.show()
    |         |     sendText("claude ...") if new
    |         |
    |         +---> Open worktree folder in editor
    |
    |     NO: Switch everything
    |         |
    |         +---> workspace.updateWorkspaceFolders() (swap to new repo worktree)
    |         +---> TerminalManager.focusAgent(agent) (terminal for this agent)
    |         +---> Update bottom repo terminal cwd
    |         +---> Open worktree folder in file explorer
```

### Agent Suspend/Resume Flow

```
AgentManager.suspendAgent(agent)
    |
    +---> Save agent session metadata to StateStore
    +---> TerminalManager.suspendAgent(agent)
    |         |
    |         v
    |     terminal.dispose()  // Kills the shell process, frees RAM
    |     Remove from terminal map
    |
    +---> fires onAgentSuspended event
              |
              +---> AgentTreeProvider updates tile (dimmed/suspended icon)

AgentManager.resumeAgent(agent)
    |
    +---> fires onAgentResumed event
              |
              +---> TerminalManager.focusAgent(agent)
                        |
                        v
                    Creates fresh terminal
                    Launches Claude Code in worktree dir
```

### Merge/PR Flow

```
User clicks merge button on agent tile
    |
    v
GitService.getDiff(agentBranch, stagingBranch)
    |
    v
Opens VS Code diff view (vscode.commands.executeCommand('vscode.diff', ...))
    |
    v
User reviews, confirms
    |
    v
GitService.createPR(agentBranch, stagingBranch)
    |
    v
(Uses VS Code diff view for review; actual PR creation is out of scope for v1)
```

### State Management

```
                 +------------------+
                 | workspaceState   |  (persisted per-workspace, survives restart)
                 |  - agents[]      |
                 |  - repoConfigs{} |
                 |  - sessionMeta{} |
                 +--------+---------+
                          |
                    read / write
                          |
                 +--------v---------+
                 | StateStore       |  (in-memory cache + persistence)
                 +--------+---------+
                          |
              +-----------+-----------+
              |           |           |
              v           v           v
        AgentManager  ConfigService  TerminalManager
              |           |           |
              +-----+-----+-----+----+
                    |           |
                    v           v
              EventEmitters   TreeProvider
                              (reads from AgentManager)
```

### Key Data Flows

1. **Agent lifecycle:** User action -> Command -> AgentManager -> WorktreeManager + StateStore -> Events -> UI refresh. All agent state changes flow through AgentManager which is the single source of truth.

2. **Terminal lifecycle:** Decoupled from agent lifecycle via events. Terminals are created lazily on focus, disposed on suspend. The TerminalManager owns the terminal-to-agent mapping but does not own agent state.

3. **Git operations:** GitService wraps all git CLI calls. WorktreeManager uses GitService for worktree operations. The merge flow uses GitService to detect diffs and VS Code's built-in diff command for review.

4. **UI updates:** The TreeDataProvider subscribes to AgentManager events and calls `_onDidChangeTreeData.fire()` to trigger VS Code tree refresh. This is pull-based (VS Code calls `getChildren`/`getTreeItem` when it needs to render) triggered by push events.

## Scaling Considerations

This is a local VS Code extension, not a server. "Scaling" means handling more concurrent agents and repos without degrading the editor experience.

| Concern | 1-2 Agents | 3-5 Agents | 5-10 Agents |
|---------|------------|------------|-------------|
| Terminal processes | All active, no issues | Lazy creation helps; suspend idle ones | Must suspend aggressively; only 1-2 active terminals |
| Git worktrees | Negligible disk overhead | Shared object store keeps it light | May need periodic `git worktree prune` |
| Memory (extension host) | < 50MB | State maps grow linearly, still fine | EventEmitter listener counts should be monitored |
| Tree view rendering | Instant | Still fast with proper data structure | Flat list within groups, no deep nesting needed |
| File watcher load | Minimal | Each worktree can trigger watchers | May need to exclude worktree dirs from VS Code watchers |

### Scaling Priorities

1. **First bottleneck: Terminal process count.** Each active terminal is a shell process running Claude Code (which itself spawns subprocesses). At 5+ active terminals, memory pressure is real. Fix: aggressive lazy creation + suspend/resume. Only the focused agent's terminal should be active.

2. **Second bottleneck: File watchers on worktrees.** VS Code watches workspace folders for changes. Multiple worktrees in the same repo means multiple watched directories. Fix: exclude non-focused worktree directories from file watching via `files.watcherExclude` settings, or avoid adding all worktrees as workspace folders simultaneously.

3. **Third bottleneck: Git operations blocking UI.** Git CLI calls (status, diff, worktree list) are synchronous processes. Fix: all git operations must be async (use `child_process.execFile` with promises), with timeouts, and never block the extension host thread.

## Anti-Patterns

### Anti-Pattern 1: God Extension Entry Point

**What people do:** Put all logic in `extension.ts` -- command handlers, terminal management, git operations, state management, all in one 1000+ line file.
**Why it's wrong:** Becomes unmaintainable fast. VS Code's own Git extension has 20+ files for good reason. Testing is impossible. Changes to terminal logic break git logic.
**Do this instead:** `extension.ts` should only bootstrap the service container and register top-level disposables. 50 lines max.

### Anti-Pattern 2: Direct Service-to-Service Method Calls

**What people do:** `terminalManager.createTerminal()` called directly inside `agentManager.createAgent()`, creating tight coupling between services.
**Why it's wrong:** Makes testing impossible without mocking everything. Creates hidden dependencies. Adding a new reaction to agent creation requires modifying AgentManager.
**Do this instead:** Fire events. AgentManager fires `onAgentCreated`, TerminalManager subscribes independently. New reactions (e.g., status bar update) just add another subscriber.

### Anti-Pattern 3: Eager Terminal Creation

**What people do:** Create a terminal for every agent on extension activation or agent creation.
**Why it's wrong:** 5 agents = 5 shell processes = 5 Claude Code instances consuming RAM even when the user is focused on just one.
**Do this instead:** Lazy terminal pool. Create terminal only when user focuses the agent. Dispose when suspended.

### Anti-Pattern 4: Using workspace.updateWorkspaceFolders for Every Agent Switch

**What people do:** Add/remove workspace folders every time the user switches between agents within the same repo.
**Why it's wrong:** `updateWorkspaceFolders()` can terminate and restart the extension host. Calling it frequently causes reloads and lost state.
**Do this instead:** Only call `updateWorkspaceFolders()` when switching between repos. For same-repo agent switches, just open the worktree directory in the editor via `vscode.workspace.openTextDocument()` and point the terminal to the right cwd.

### Anti-Pattern 5: Synchronous Git Operations

**What people do:** Use `child_process.execSync()` for git commands.
**Why it's wrong:** Blocks the extension host thread. On large repos, `git status` or `git diff` can take seconds. The entire VS Code UI freezes.
**Do this instead:** Always use `child_process.execFile()` wrapped in Promises. Set reasonable timeouts. Show progress indicators for long operations.

### Anti-Pattern 6: Storing Terminal Scrollback for Suspend/Restore

**What people do:** Try to capture and restore the full terminal scrollback buffer when suspending/resuming an agent.
**Why it's wrong:** VS Code's Terminal API does not expose scrollback content. There is no `terminal.getContent()` method. Attempting workarounds (screen scraping, Pseudoterminal capture) adds massive complexity for a feature that barely works.
**Do this instead:** Accept that suspend/resume loses terminal history. When resuming, create a fresh terminal and re-launch Claude Code. If Claude Code supports session resumption (`--resume`), use that. The agent's work is in git (commits, branches) -- that is the real state, not the terminal scrollback.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Git CLI | `child_process.execFile('git', args, { cwd })` | Requires git 2.5+ for worktree support. Wrap in async. Parse output as text. |
| Claude Code CLI | `vscode.window.createTerminal({ name, cwd })` then `terminal.sendText('claude ...')` | Extension does NOT manage Claude's process directly -- it runs inside the terminal. |
| VS Code Remote SSH | No custom integration needed | VS Code Remote runs the extension host on the remote machine. Extension code works identically. Worktrees exist on the remote filesystem. |
| VS Code SCM API | Optional: register as SCM provider for custom merge UI | v1 can skip this and use `vscode.diff` command directly. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| AgentManager <-> WorktreeManager | Direct method calls (creation dependency) | WorktreeManager is a dependency of AgentManager. Agent creation requires worktree creation. |
| AgentManager -> TerminalManager | Events only (`onAgentCreated`, `onAgentSuspended`, `onAgentResumed`) | Terminal lifecycle is decoupled from agent lifecycle. |
| AgentManager -> AgentTreeProvider | Events only (`onAgentCreated`, `onAgentDeleted`, `onAgentStatusChanged`) | UI updates are reactive, not imperative. |
| TerminalManager <-> VS Code Terminal API | Direct API calls | TerminalManager is the only component that touches `vscode.window.createTerminal()`. |
| GitService <-> Git CLI | `child_process.execFile` | GitService is the only component that spawns git processes. |
| StateStore <-> Memento API | Direct API calls | StateStore is the only component that touches `workspaceState` / `globalState`. |
| LayoutManager -> VS Code Window API | `commands.executeCommand`, `window.showTextDocument` | Orchestrates editor splits, panel focus, workspace folder changes. |

## Build Order (Dependencies Between Components)

Components must be built in this order because of hard dependencies:

```
Phase 1: Foundation (no VS Code API dependencies between components)
  models/           -- Pure data types: Agent, Repo, RepoConfig
  types.ts          -- Shared interfaces
  constants.ts      -- IDs and keys
  utils/git-cli.ts  -- Low-level git command runner
  utils/process.ts  -- Async child_process wrappers

Phase 2: Core Services (depend on Foundation)
  state/store.ts         -- Depends on: models, Memento API
  state/persistence.ts   -- Depends on: store
  services/git-service.ts    -- Depends on: utils/git-cli
  services/config-service.ts -- Depends on: VS Code config API

Phase 3: Domain Services (depend on Core Services)
  services/worktree-manager.ts  -- Depends on: git-service, models
  services/terminal-manager.ts  -- Depends on: models, VS Code Terminal API
  services/agent-manager.ts     -- Depends on: worktree-manager, state/store, models
                                   Fires events consumed by terminal-manager and providers

Phase 4: UI Layer (depends on Domain Services)
  views/agent-tree-item.ts       -- Depends on: models
  views/repo-tree-item.ts        -- Depends on: models
  providers/agent-tree-provider.ts -- Depends on: agent-manager (events), models
  services/layout-manager.ts      -- Depends on: terminal-manager, agent-manager

Phase 5: Integration (wires everything)
  container.ts     -- Creates all services, wires events
  extension.ts     -- Calls container, registers commands, pushes disposables
```

This order means each phase is testable in isolation. Phase 1 has zero VS Code API dependency. Phase 2 has minimal API surface. Phase 3 is where the real logic lives. Phase 4 is pure UI. Phase 5 is glue.

## Sources

- [VS Code Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy) -- Official activation/deactivation pattern, disposables, ExtensionContext
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) -- TreeDataProvider, TreeItem, view containers, menus
- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api) -- Terminal, Pseudoterminal, workspace APIs
- [VS Code UX Guidelines: Sidebars](https://code.visualstudio.com/api/ux-guidelines/sidebars) -- View container placement
- [VS Code UX Guidelines: Views](https://code.visualstudio.com/api/ux-guidelines/views) -- Tree view patterns
- [VS Code Git Extension Architecture (DeepWiki)](https://deepwiki.com/microsoft/vscode/5.2-git-extension) -- Model/Repository/CommandCenter pattern
- [GitHub Actions Extension Architecture](https://github.com/github/vscode-github-actions/blob/main/docs/project-architecture.md) -- Client-server pattern
- [OpenCode VS Code Extension (DeepWiki)](https://deepwiki.com/sst/opencode/6.6-vs-code-extension) -- Lightweight launcher pattern for CLI agents
- [VS Code Extension DI Patterns](https://rpeshkov.net/blog/vscode-extension-di/) -- Service injection approaches
- [VS Code Event System](https://dev.to/ryankolter/vscode-3-event-system-from-emitters-to-disposables-3292) -- EventEmitter + Disposable patterns
- [VS Code State Management](https://www.eliostruyf.com/devhack-code-extension-storage-options/) -- globalState, workspaceState, storageUri
- [VS Code Multi-Root Workspaces](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces) -- updateWorkspaceFolders API
- [VS Code Terminal Advanced](https://code.visualstudio.com/docs/terminal/advanced) -- Terminal persistence, reconnection
- [simple-git npm](https://www.npmjs.com/package/simple-git) -- Git CLI wrapper for Node.js
- [git-worktree npm](https://www.npmjs.com/package/git-worktree) -- Worktree-specific wrapper
- [VS Code Terminal Restore Issue #44302](https://github.com/microsoft/vscode/issues/44302) -- Terminal state restoration limitations
- [Building VS Code Extensions in 2026](https://abdulkadersafi.com/blog/building-vs-code-extensions-in-2026-the-complete-modern-guide) -- Modern tooling guide

---
*Architecture research for: VS Code multi-repo multi-agent workspace manager*
*Researched: 2026-03-04*
