## Save Data

### Overview

All extension state lives in an in-memory SQLite database (via Sequelize ORM), scoped to the current workspace.
If no workspace is open, the extension shows a hint to create one — no DB is initialized.

### Storage

- **Runtime store:** In-memory SQLite via Sequelize (async, models define schema)
- **Durable backup:** `context.workspaceState` (VS Code Memento, persists across sessions)
- **On startup:** Sequelize syncs models to in-memory SQLite, data is restored from `workspaceState`
- **On every write:** Sequelize mutates DB, then affected tables are serialized to `workspaceState`

### Data Flow

```
[UI] ──postMessage──> [Extension] ──write──> [SQLite (in-memory)]
                                                │
                                          EventEmitter + workspaceState backup
                                                │
[UI] <──postMessage── [Extension] <──listen─────┘
```

1. UI sends a command via `postMessage` (e.g. "create agent").
2. Extension calls a `StateStorage` method (e.g. `addAgent`).
3. Method validates input, writes via Sequelize, emits a change event, and persists to `workspaceState`.
4. Webview provider listens to `onDidChange`, reads updated state, pushes it to UI.

### StateStorage

Located in `src/db/StateStorage.ts`. Single class that owns the Sequelize instance and EventEmitter.

Created via async factory `createStateStorage(context)` in `src/db/index.ts`.

Rules:
- All write methods are async (Sequelize is async).
- Every write method emits a change event via `vscode.EventEmitter`.
- Every write method persists affected tables to `workspaceState`.
- Read methods do not emit events.
- Implements `vscode.Disposable` — must be pushed into `context.subscriptions`.

### Schema

Models defined in `src/db/models.ts` using Sequelize `Model.init()`. Associations set up via `initModels()`.

Agent types (`Agent`, `AgentStatus`, `AgentCli`) in `src/types/agent.ts`.
DB row types (`Repository`, `Worktree`) in `src/db/models.ts`.

#### `repositories`

| Field         | Type    | Constraints      | Note                    |
|---------------|---------|------------------|-------------------------|
| repositoryId  | TEXT    | PK               | UUID                    |
| name          | TEXT    | NOT NULL         |                         |
| localPath     | TEXT    | NOT NULL, UNIQUE | absolute path to repo   |
| stagingBranch | TEXT    | NOT NULL         | e.g. `staging`          |
| createdAt     | INTEGER | NOT NULL         | unix ms                 |

#### `agents`

| Field      | Type    | Constraints                | Note                          |
|------------|---------|----------------------------|-------------------------------|
| agentId    | TEXT    | PK                         | UUID                          |
| repoId     | TEXT    | NOT NULL, FK → repositories | ON DELETE CASCADE             |
| name       | TEXT    | NOT NULL                   |                               |
| cli        | TEXT    | NOT NULL                   | `claude-code` for now         |
| status     | TEXT    | NOT NULL                   | `created` / `running` / `completed` / `error` |
| sessionId  | TEXT    |                            | CLI session id to resume      |
| lastPrompt | TEXT    |                            | last prompt sent              |
| startedAt  | INTEGER |                            | unix ms, when last task started |
| createdAt  | INTEGER | NOT NULL                   | unix ms                       |

#### `worktrees`

| Field      | Type | Constraints                   | Note                                   |
|------------|------|-------------------------------|-----------------------------------------|
| worktreeId | TEXT | PK                            | UUID                                   |
| agentId    | TEXT | NOT NULL, UNIQUE, FK → agents | ON DELETE CASCADE (1:1 with agent)     |
| path       | TEXT | NOT NULL                      | e.g. `repo_path/.worktrees/agent_name` |

### Relations

```
repositories 1───∞ agents 1───1ü worktrees
```

- One repository has many agents.
- One agent belongs to one repository.
- One agent has one worktree.
- Deleting a repository cascades to its agents and their worktrees.
