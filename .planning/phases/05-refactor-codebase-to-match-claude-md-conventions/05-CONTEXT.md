# Phase 5: Refactor Codebase to Match CLAUDE.md Conventions - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the existing codebase to align with all rules in CLAUDE.md: migrate the sidebar webview to React, reorganize files into feature-based structure, replace Node.js fs/path with VS Code APIs, and expose hardcoded values as VS Code settings. No new features — same functionality, cleaner structure.

</domain>

<decisions>
## Implementation Decisions

### React migration
- Full React migration for the webview sidebar (replace 820-line HTML string generation)
- Set up React + bundler for webview
- All UI lives in `src/ui/` with structure: `atoms/`, `components/`, `styles/`, `view.ts`, `agenticTab.ts`
- Atoms: StatusIcon.tsx, ActionButton.tsx, ElapsedTimer.tsx
- Components: AgentTile.tsx, RepoSection.tsx, Dashboard.tsx
- Data flow: extension sends data via `webview.postMessage()`, React listens via `useEffect` + `useState`
- Styling: single CSS file (`styles/dashboard.css`) using VS Code theme CSS variables (`--vscode-editor-background`, etc.)
- Timer: custom `useElapsedTime` hook that takes startedAt/finishedAt and returns formatted string, updates every second for running agents
- No VS Code Webview UI Toolkit — plain React with theme CSS vars

### File consolidation (feature-based architecture)
- One file per feature in `src/features/`: create-agent.ts, delete-agent.ts, focus-agent.ts, stop-agent.ts, add-repo.ts, remove-repo.ts, root-global.ts, root-repo.ts
- Each feature file contains: command registration, handler, and all business logic for that feature
- Only truly shared code lives in services
- Shared services (kept): git.service.ts (async git wrapper), workspace.service.ts (workspace file + Explorer scope)
- Absorbed into features: agent.service.ts, terminal.service.ts, repo-config.service.ts, worktree.service.ts
- Thin data stores for shared state: agents-store.ts (Memento CRUD for agent registry), repos-store.ts (Memento CRUD for repo configs)
- Final `src/services/` contents: git.service.ts, workspace.service.ts, agents-store.ts, repos-store.ts

### Path & fs API migration
- All Node.js `fs` (node:fs/promises) replaced with `vscode.workspace.fs` — both workspace.service.ts and gitignore.ts
- All `path.join()` replaced with `vscode.Uri.joinPath()` or `vscode.Uri.file()`
- Internal APIs keep string paths — convert to Uri only at point of use (fs calls, workspace folder updates)
- git.service.ts stays string-based (git CLI requires string paths, no point wrapping/unwrapping Uri)
- Repo basename for UI: computed by extension host and sent as part of dashboard data (no `path` import in webview)

### Settings exposure
- Three new VS Code settings in `contributes.configuration` in package.json:
  - `vscode-agentic.maxWorktreesPerRepo` (number, default 5, min 1, max 20) — global only
  - `vscode-agentic.defaultStagingBranch` (string, default "staging") — per-repo overridable via Memento
  - `vscode-agentic.worktreeDirectoryName` (string, default ".worktrees") — global only
- Staging branch precedence: per-repo Memento override → VS Code setting → hardcoded "staging"
- Worktree limit and directory name: VS Code setting → hardcoded default (no per-repo override)

### Claude's Discretion
- React bundler choice for webview (esbuild plugin, webpack, etc.)
- Exact component boundaries and prop interfaces
- CSS class naming conventions
- How to handle webview initial state before first postMessage
- Feature file internal structure (export patterns, function organization)
- Migration order (which refactoring to do first for minimal breakage)

</decisions>

<specifics>
## Specific Ideas

- User wants feature-based file organization: "1 file for 1 feature. Only reusable code moves to a class or service. Name files as feature."
- Thin data stores should be pure CRUD — no business logic, just Memento read/write
- Keep console.log calls throughout (already present, matches CLAUDE.md "add console.log calls to see function call chains")

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `git.service.ts` (47 lines): Clean async git wrapper, stays as shared service
- `workspace.service.ts` (195 lines): Workspace file + Explorer scope management, stays as shared service
- `nonce.ts` utility: Used for webview CSP, stays as utility
- `branch-validation.ts` utility: Used by create-agent, stays as utility
- `worktree-parser.ts` utility: Used by worktree operations, may be absorbed into feature files

### Established Patterns
- Constructor injection: services created in activate() and injected — continues for shared services
- VS Code Memento for persistence: globalState for both agent and repo data
- Event delegation in webview: replaced by React event handling
- postMessage protocol: kept, React listens instead of manual DOM patcher
- Per-repo mutex via promise chain: migrates into relevant feature files or a shared utility

### Integration Points
- `extension.ts activate()`: simplified — creates shared services + stores, registers features, registers webview provider
- `package.json contributes.configuration`: new section for 3 settings
- `package.json contributes.views`: webview view stays as-is
- Webview bundling: new build step for React webview code

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-refactor-codebase-to-match-claude-md-conventions*
*Context gathered: 2026-03-10*
