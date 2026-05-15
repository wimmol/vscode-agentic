# ADR 0002 — Agent and repo state moves back to `workspaceState`

- Status: Accepted
- Date: 2026-05-15
- Supersedes: [ADR 0001](./0001-state-in-globalstate.md)

## Context

ADR 0001 moved `repositories`, `agents`, `worktrees`, `templates`, and
`schemaVersion` to `globalState` so agents persisted across workspace
switches. In practice this conflated unrelated projects: opening any
workspace surfaced every agent the user had ever created, and a "fresh
workspace = fresh slate" mental model became impossible.

## Decision

Move `repositories`, `agents`, `worktrees`, `schemaVersion`, and
`explorerState` back to `workspaceState`. Each workspace now owns its
own set of repos/agents/worktrees.

Keep `templates` in `globalState` — templates are reusable launch
presets, not tied to a single project.

A one-shot `migrateGlobalToWorkspace` in `src/db/index.ts` copies the
four workspace-scoped keys from `globalState` to the current
`workspaceState` (only when the workspace doesn't already have data for
that key) and clears the `globalState` entries. The first workspace to
activate under the new code claims the pre-existing global data;
subsequent workspaces start empty.

## Consequences

- Opening a new workspace shows an empty Agentic tab.
- The same repo opened under two different workspace files gets two
  independent agent lists.
- Templates remain shared, so launch presets do not need to be
  recreated per workspace.
- Existing users with pre-migration data see their agents land in
  whichever workspace they open first after the update.
