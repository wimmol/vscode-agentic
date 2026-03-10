## Save Data

### Overview

All extension state is persisted in a SQLite database, scoped to the current workspace.
If no workspace is open, the extension shows a hint to create one — no DB is initialized.

### Storage

- **Location:** `context.storageUri` (VS Code-managed, workspace-scoped, persists across sessions)
- **Database:** SQLite via `better-sqlite3` (synchronous, lightweight, no native module issues)
- **File:** `agentic.db` inside `context.storageUri`

### Data Flow

```
[UI] ──postMessage──> [Extension] ──write──> [SQLite]
                                                │
                                          EventEmitter
                                                │
[UI] <──postMessage── [Extension] <──listen─────┘
```

1. UI sends a command via `postMessage` (e.g. "create agent").
2. Extension calls a data access function (e.g. `addAgent`).
3. Function writes to SQLite and emits a change event.
4. Webview provider listens to the event, reads updated state, pushes it to UI.

### Data Access Functions

Located in `services/`. One function per operation, raw SQL via `better-sqlite3`.

```ts
// Examples
const addAgent = (agent: Agent) => { /* INSERT, emit change */ };
const getAgent = (id: string) => { /* SELECT */ };
const getAllAgents = () => { /* SELECT * */ };
const updateAgent = (id: string, data: Partial<Agent>) => { /* UPDATE, emit change */ };
const deleteAgent = (id: string) => { /* DELETE, emit change */ };
```

Rules:
- Every write function emits a change event via `vscode.EventEmitter`.
- Read functions do not emit events.
- Functions are plain arrow functions, not class methods.

### Schema Versioning

```ts
// Stored in a `meta` table
// | key            | value |
// |----------------|-------|
// | schema_version | 1     |
```

On DB initialization, check `schema_version`. If older than current, run migrations sequentially.

### Tables

| Table | Description |
|-------|-------------|
| `meta` | Schema version and metadata |
| TBD | — |
