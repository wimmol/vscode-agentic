# Roadmap: VS Code Agentic

## Overview

VS Code Agentic goes from empty folder to a shipping multi-agent workspace manager in 7 phases. The build follows a strict dependency chain: git infrastructure first (worktrees are the isolation primitive), then agent lifecycle on top of it, then UI to expose agents, then the git-based PR workflow that ties it all together. The final three phases layer on resilience (persistence, suspend/restore) and scale (remote, performance). Each phase delivers an observable capability that builds on the previous -- nothing ships half-finished.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Extension Foundation and Git Infrastructure** - Project scaffold, async git operations, worktree management with hard limits, per-repo staging branch configuration
- [ ] **Phase 2: Agent Lifecycle and Terminal Management** - Create/delete agents with worktrees and branches, launch Claude Code CLI sessions, track agent status, run concurrent agents

## Phase Details

### Phase 1: Extension Foundation and Git Infrastructure
**Goal**: User can add a repository to the extension and configure its staging branch, with all git worktree infrastructure operational and safe from day one
**Depends on**: Nothing (first phase)
**Requirements**: GIT-01, GIT-02, GIT-05, GIT-06, PERF-04
**Success Criteria** (what must be TRUE):
  1. User can add a repository and set a staging branch name (defaults to "staging") via the extension
  2. Extension creates git worktrees in the repo without blocking the VS Code UI (all git operations are async)
  3. Worktree creation is refused when the per-repo hard limit is reached, with a clear message to the user
  4. On extension activation, orphaned worktrees (in manifest but not on disk, or on disk but not in manifest) are detected and reconciled
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md -- Project scaffold, build pipeline, type definitions, and Vitest test infrastructure
- [ ] 01-02-PLAN.md -- GitService async wrapper, worktree parser, WorktreeService with limits and reconciliation
- [ ] 01-03-PLAN.md -- RepoConfigService, command handlers, gitignore utility, extension wiring

### Phase 2: Agent Lifecycle and Terminal Management
**Goal**: User can create named agents that run Claude Code CLI in isolated worktrees, run multiple agents concurrently, and delete agents cleanly
**Depends on**: Phase 1
**Requirements**: AGENT-01, AGENT-02, AGENT-05, TERM-01, TERM-02, PERF-01, UI-06
**Success Criteria** (what must be TRUE):
  1. User can create an agent by naming it, which creates a git branch and worktree and launches Claude Code CLI in a VS Code terminal
  2. User can delete an agent, which kills the terminal process, removes the worktree, and deletes the branch
  3. User can see each agent's current status (running, idle, finished, error) at a glance
  4. User can run 2-5 agents simultaneously across the same repo without conflicts or performance degradation
  5. Terminals are created only when an agent is focused (lazy creation), not on agent creation
  6. All commands are hidden from the Command Palette -- interactions happen exclusively through the sidebar UI
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md -- Agent model, branch validation utility, TerminalService with terminal lifecycle management
- [ ] 02-02-PLAN.md -- AgentService lifecycle orchestration, agent commands, extension wiring

### Phase 3: Agent dashboard UI with tiles, buttons, and pickers

**Goal:** User sees a Webview sidebar dashboard with agent tiles grouped by repository, each tile showing name, status, metrics, and action buttons, with auto-refresh on data changes and full workspace context switching on tile click
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-06
**Depends on:** Phase 2
**Success Criteria** (what must be TRUE):
  1. Right sidebar shows a Webview panel with agent tiles grouped by repository sections
  2. Each agent tile displays name, animated status icon, repo, elapsed time, initial prompt, and placeholder metrics
  3. Clicking an agent tile switches workspace folders to the agent's worktree and focuses the terminal
  4. Tile action buttons (Stop, Reset Changes, Delete, Clear Context) have correct disabled states per agent status
  5. Sidebar auto-refreshes when agents are created, deleted, or change status
  6. All interactions happen through sidebar UI -- no Command Palette entries
**Plans:** 3 plans

Plans:
- [ ] 03-01-PLAN.md -- Backend contracts: AgentService EventEmitter, finishedAt field, stopAgent/removeRepo commands, focusAgent workspace switching
- [ ] 03-02-PLAN.md -- Webview sidebar: SidebarViewProvider, HTML generation with tiles and CSS, extension wiring, package.json updates
- [ ] 03-03-PLAN.md -- Gap closure: Fix workspace-scoped storage bug (workspaceState to globalState)
