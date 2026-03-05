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
- [ ] **Phase 3: Sidebar UI and Agent Switching** - TreeView sidebar with agent tiles grouped by repo, same-repo and cross-repo context switching
- [ ] **Phase 4: Git Workflow and Merge Protection** - Diff review via VS Code native diff editor, PR creation from agent branch to staging, merge protection on deletion
- [ ] **Phase 5: Session Persistence and Agent Reuse** - Agent sessions survive VS Code restarts, restart finished agents in existing worktrees, orphan process cleanup
- [ ] **Phase 6: Suspend/Restore and Notifications** - Suspend idle agents to free RAM, restore on demand, OS notifications for background agent events
- [ ] **Phase 7: Remote Support and Performance at Scale** - Remote SSH agent management, configurable resource limits, responsive performance with 5 concurrent agents

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
**Requirements**: AGENT-01, AGENT-02, AGENT-05, TERM-01, TERM-02, PERF-01
**Success Criteria** (what must be TRUE):
  1. User can create an agent by naming it, which creates a git branch and worktree and launches Claude Code CLI in a VS Code terminal
  2. User can delete an agent, which kills the terminal process, removes the worktree, and deletes the branch
  3. User can see each agent's current status (running, idle, finished, error) at a glance
  4. User can run 2-5 agents simultaneously across the same repo without conflicts or performance degradation
  5. Terminals are created only when an agent is focused (lazy creation), not on agent creation
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md -- Agent model, branch validation utility, TerminalService with terminal lifecycle management
- [ ] 02-02-PLAN.md -- AgentService lifecycle orchestration, agent commands, extension wiring

### Phase 3: Sidebar UI and Agent Switching
**Goal**: User can see all agents in a sidebar and instantly switch between them -- within the same repo or across different repos -- with the IDE context updating accordingly
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Right sidebar displays agent tiles in a TreeView, grouped by repository
  2. Each agent tile shows the agent's name, repository, and a visual status indicator (running, idle, finished, error, suspended)
  3. Clicking any agent tile replaces the Explorer workspace folders with only that agent's worktree folder -- the file tree shows exclusively the selected agent's working directory
  4. Clicking an agent tile switches the full VS Code context -- Explorer shows only the agent's worktree, code editor opens a file from the worktree, and the agent CLI terminal is focused
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md -- AgentService change event, TreeDataProvider, and TreeItem classes (repo groups + agent tiles with status icons)
- [ ] 03-02-PLAN.md -- WorkspaceSwitchService, sidebar commands, package.json menus/welcome, extension wiring

### Phase 4: Git Workflow and Merge Protection
**Goal**: User can review agent work via VS Code's native diff editor and merge agent branches to staging, with protection against deleting agents that have unmerged work
**Depends on**: Phase 3
**Requirements**: GIT-03, GIT-04, AGENT-04, UI-05
**Success Criteria** (what must be TRUE):
  1. When an agent's branch has diffs vs the staging branch, a merge button appears on the agent's tile in the sidebar
  2. User can open VS Code's native diff view showing changes between the agent branch and the staging branch
  3. User can create a PR from the agent branch to the staging branch after reviewing diffs
  4. User cannot delete an agent whose branch has unmerged changes vs staging -- the extension blocks deletion with a clear explanation
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md -- DiffService (git diff detection, changed file listing) and GitContentProvider (file content at git refs)
- [ ] 04-02-PLAN.md -- Diff review commands, PR creation, merge guard on deletion, TreeView conditional UI, extension wiring

### Phase 5: Session Persistence and Agent Reuse
**Goal**: Agent sessions survive VS Code restarts and previously finished agents can be restarted in their existing context
**Depends on**: Phase 4
**Requirements**: TERM-03, AGENT-03, PERF-03
**Success Criteria** (what must be TRUE):
  1. After closing and reopening VS Code, all agent metadata and terminal sessions are restored -- agents appear in the sidebar with correct status
  2. User can restart a previously finished agent, which relaunches Claude Code CLI in the agent's existing branch and worktree
  3. On extension activation, orphan agent processes (from previous sessions that did not shut down cleanly) are detected and cleaned up
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md -- AgentEntry model update, TerminalService --continue and PID tracking, AgentService restart detection and last-focused storage
- [ ] 05-02-PLAN.md -- Enhanced reconciliation (agent-worktree cross-reference, orphan process cleanup), activation wiring, last-focused highlighting

### Phase 6: Suspend/Restore and Notifications
**Goal**: User can suspend idle agents to reclaim RAM and get notified when background agents need attention
**Depends on**: Phase 5
**Requirements**: TERM-04, TERM-05, TERM-06
**Success Criteria** (what must be TRUE):
  1. User can suspend an idle or finished agent -- terminal state is saved and the process is killed to free RAM
  2. User can restore a suspended agent -- the process relaunches in the same worktree context and the agent returns to an active state
  3. User receives an OS notification when a background (unfocused) agent finishes its work or requires input
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md -- AgentStatus "suspended" type, suspend/restore service methods, background exit notification callback, TreeView icon/sort/contextValue
- [ ] 06-02-PLAN.md -- Suspend/restore commands (palette + context menu), notification wiring in extension, package.json menus

### Phase 7: Remote Support and Performance at Scale
**Goal**: User can manage agents on remote machines via VS Code Remote SSH with configurable resource limits, and the extension remains responsive at scale
**Depends on**: Phase 6
**Requirements**: REMOTE-01, REMOTE-02, PERF-02
**Success Criteria** (what must be TRUE):
  1. User can connect to a remote machine via VS Code Remote SSH and create/manage agents on the remote repo as if it were local
  2. User can configure resource limits for remote environments (max agents, max worktrees) independently from local settings
  3. Extension remains responsive (sidebar updates, agent switching, terminal focus) with 5 concurrent agents and large repositories
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md -- VS Code settings migration, resource limit configuration, Claude CLI health check, agent limit enforcement
- [ ] 07-02-PLAN.md -- Targeted per-agent diff updates with TTL cache, auto-suspend UX on limit errors

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Extension Foundation and Git Infrastructure | 0/3 | Planning complete | - |
| 2. Agent Lifecycle and Terminal Management | 0/2 | Planning complete | - |
| 3. Sidebar UI and Agent Switching | 0/2 | Planning complete | - |
| 4. Git Workflow and Merge Protection | 0/2 | Planning complete | - |
| 5. Session Persistence and Agent Reuse | 0/2 | Planning complete | - |
| 6. Suspend/Restore and Notifications | 0/2 | Planning complete | - |
| 7. Remote Support and Performance at Scale | 0/2 | Planning complete | - |
