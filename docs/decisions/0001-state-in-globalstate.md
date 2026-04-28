# ADR 0001 — Agent and repo state lives in `globalState`

- Status: Accepted
- Date: 2026-04-18

## Context

The extension previously stored all persistent data (repositories, agents,
worktrees, templates) in VS Code's `workspaceState`, which is scoped per
workspace file. This meant an agent created in one workspace was invisible
from another, and switching folders made the sidebar appear empty.

## Decision

Move all cross-workspace data (`repositories`, `agents`, `worktrees`,
`templates`, `zoneExpanded`, `schemaVersion`) to `globalState`. Keep
per-workspace UI state (`explorerState` — which folders the user has
expanded in the sidebar tree) in `workspaceState`, because that state
is inherently tied to the folder set the user is viewing.

On extension activation, any legacy data still present in
`workspaceState` is migrated to `globalState` by
`migrateWorkspaceToGlobal`, and the workspaceState key is cleared so
the migration is idempotent.

## Consequences

- Agents survive workspace switches. (Previously they did not.)
- Explorer expand/collapse state remains per-workspace, matching the
  set of folders visible.
- A schema-version marker (`STORE_SCHEMA_VERSION`) is introduced so
  future shape changes can migrate safely.
