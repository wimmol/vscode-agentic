## Save Data

### Storage Types

| Storage | Scope | Use For |
|---------|-------|---------|
| `globalState` | Cross-workspace | Agent configs, repo paths |
| `workspaceState` | Current workspace | Collapsed sections, UI preferences |
| `SecretStorage` | Encrypted, cross-workspace | Tokens, credentials |

### Rules

- Always provide defaults: `globalState.get(key, defaultValue)`.
- Never mutate stored objects directly — clone, modify, then save.
- Fire change events after every store mutation via `vscode.EventEmitter`.
- Call `globalState.setKeysForSync` to enable Settings Sync.
- Version stored data schema — add a version number, migrate on activation if old.

### Schema Versioning

```ts
interface StoredData<T> {
  version: number;
  data: T;
}
```

On activation, read the version. If it's older than current, run the migration and save.

### Keys

| Key | Storage | Type | Description |
|-----|---------|------|-------------|
| TBD | — | — | — |
