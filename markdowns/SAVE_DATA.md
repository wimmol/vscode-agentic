## Save Data

### Overview

All extension state is persisted via VS Code's `Memento` API.

- **Workspace-scoped data** (repositories, agents, worktrees, schema
  version, explorer expand state) lives in `context.workspaceState`. Each
  workspace has its own agent list — a fresh workspace starts empty, and
  agents created in one workspace are not visible in another.
- **Global data** (templates) lives in `context.globalState` so templates
  are reusable across workspaces.

### Data Flow

```
[UI] ──postMessage──> [Extension] ──write──> [Memento]
                                                │
                                          EventEmitter
                                                │
[UI] <──postMessage── [Extension] <──listen─────┘
```

1. UI sends a command via `postMessage` (e.g. "create agent").
2. The extension calls a `StateStorage` method (e.g. `addAgent`).
3. The method validates input, writes via `Memento.update`, and fires a
   change event via `vscode.EventEmitter`.
4. `AgentPanelProvider` listens to `onDidChange`, reads the full state,
   and pushes it to the webview.

### StateStorage

Located in `src/db/StateStorage.ts`. Single class that owns two `Memento`
references (`workspaceStore` for workspace-scoped data, `globalStore` for
templates) and an `EventEmitter` for change notifications.

Created via `createStateStorage(context)` in `src/db/index.ts`, which is
async because it runs a one-shot legacy migration (`globalState` →
`workspaceState` for repos / agents / worktrees / schema version) before
returning. The first workspace to activate under the new code claims any
pre-existing global data; subsequent workspaces start empty. Templates are
left in `globalState`.

Rules:

- All write methods are async and run inside `runExclusive`, which
  serializes writes so read-then-write sequences cannot interleave.
- Every write method fires `_onDidChange` (except `setExpandedPaths`,
  which writes UI-only state).
- Read methods do not fire events.
- Implements `vscode.Disposable` — must be pushed into
  `context.subscriptions`.

### Schema versioning

A single `agentic.schemaVersion` key (see `src/constants/db.ts`) tracks
the on-disk shape. `StateStorage.runMigrations` runs on activation; bump
`CURRENT_SCHEMA_VERSION` and add a migration branch when a stored shape
changes in a backwards-incompatible way.

### Keys

| Key                           | Memento          | Shape                                       |
|-------------------------------|------------------|---------------------------------------------|
| `agentic.repositories`        | workspaceState   | `Repository[]`                              |
| `agentic.agents`              | workspaceState   | `Agent[]`                                   |
| `agentic.worktrees`           | workspaceState   | `Worktree[]`                                |
| `agentic.schemaVersion`       | workspaceState   | `number` (current: `CURRENT_SCHEMA_VERSION`)|
| `agentic.explorerState`       | workspaceState   | `Record<scopeKey, string[]>`                |
| `agentic.templates`           | globalState      | `AgentTemplate[]`                           |

### Models

Pure TypeScript interfaces in `src/db/models.ts`. No ORM, no SQLite —
just JSON-serializable value objects. Agent types (`Agent`,
`AgentStatus`, `AgentCli`) live in `src/types/agent.ts`.
