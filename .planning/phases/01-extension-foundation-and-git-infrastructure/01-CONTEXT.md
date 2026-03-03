# Phase 1: Extension Foundation and Git Infrastructure - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffold for a VS Code extension + async git worktree management with hard limits + per-repo staging branch configuration + worktree manifest tracking with reconciliation on activation. This is pure infrastructure — the foundation that Phases 2-7 build on.

</domain>

<decisions>
## Implementation Decisions

### Repo Management
- Auto-detect VS Code workspace folders as available repos AND allow manual "Add Repo" for external repos (both modes)
- When repo is added, prompt user immediately for staging branch name (default: "staging")
- If a branch named "staging" (or the configured name) already exists, ask user to confirm: use existing or pick a different name
- Store repo config (staging branch name, worktree limit) in VS Code's Memento API (extension state) — invisible to user, no file clutter

### Worktree Limits
- Default max worktrees per repo: configurable, default 5
- When limit reached: suggest cleanup — show which agents are finished/idle and offer to delete one to make room
- On activation, if orphaned worktrees found: notify user what was found, then auto-clean up

### Worktree Location
- Worktrees created in a sibling folder: `/path/to/repo/.worktrees/agent-name/`
- Auto-add `.worktrees/` to `.gitignore` silently so worktrees aren't committed

### Extension Scaffold
- Package manager: Claude's discretion (npm or pnpm — whichever works best for VS Code extension tooling)
- Code quality: Claude's discretion (ESLint+Prettier or Biome)
- Testing: Vitest for unit tests + @vscode/test-cli for integration tests (research recommended split)
- Minimal test setup in Phase 1 — framework configured but extensive tests come in later phases

### Claude's Discretion
- Package manager choice (npm vs pnpm)
- Linting/formatting tooling choice (ESLint+Prettier vs Biome)
- Exact project structure and folder layout
- esbuild configuration details
- TypeScript strict mode settings
- Activation event strategy

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Research recommends:
- TypeScript 5.6+ with esbuild bundler
- VS Code engine `^1.96.0` for broadest compatibility
- Service-event architecture pattern (from VS Code's own Git extension)
- Zero production dependencies — VS Code API provides everything at runtime

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, empty folder

### Established Patterns
- None yet — Phase 1 establishes the patterns all subsequent phases follow

### Integration Points
- VS Code Extension API: `vscode.workspace.workspaceFolders` for repo detection
- VS Code Memento API: `context.workspaceState` / `context.globalState` for config persistence
- Git CLI: `child_process.execFile('git', ['worktree', ...])` for all worktree operations
- VS Code activation: `onView:` activation event for sidebar (avoid `*`)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-extension-foundation-and-git-infrastructure*
*Context gathered: 2026-03-04*
