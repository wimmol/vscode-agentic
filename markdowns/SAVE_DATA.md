## Save Data

### Overview

All extension state is persisted via VS Code's `Memento` API.

- **Cross-workspace data** (repositories, agents, worktrees, templates, zone
  expand state, schema version) lives in `context.globalState`. This means
  agents created in one workspace are visible when the extension reopens in
  another.
- **Per-workspace UI state** (which explorer folders are expanded for each
  scope) lives in `context.workspaceState`, since it's inherently tied to
  the folder set currently open.

See `docs/decisions/0001-state-in-globalstate.md` for the rationale.

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
references (`state` for cross-workspace data, `uiState` for per-workspace
UI state) and an `EventEmitter` for change notifications.

Created via `createStateStorage(context)` in `src/db/index.ts`, which is
async because it runs the legacy-data migration (from `workspaceState` to
`globalState`) before returning.

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
| `agentic.repositories`        | globalState      | `Repository[]`                              |
| `agentic.agents`              | globalState      | `Agent[]`                                   |
| `agentic.worktrees`           | globalState      | `Worktree[]`                                |
| `agentic.templates`           | globalState      | `AgentTemplate[]`                           |
| `agentic.zoneExpanded`        | globalState      | `Record<\`${repoId}::${branch}\`, boolean>` |
| `agentic.schemaVersion`       | globalState      | `number` (current: `CURRENT_SCHEMA_VERSION`)|
| `agentic.explorerState`       | workspaceState   | `Record<scopeKey, string[]>`                |

### Models

Pure TypeScript interfaces in `src/db/models.ts`. No ORM, no SQLite —
just JSON-serializable value objects. Agent types (`Agent`,
`AgentStatus`, `AgentCli`) live in `src/types/agent.ts`.
