# Requirements: VS Code Agentic

**Defined:** 2026-03-04
**Core Value:** Fast, isolated multi-agent development -- switch between AI coding agents and repos instantly, with each agent working in its own worktree so nothing conflicts.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Agent Lifecycle

- [ ] **AGENT-01**: User can create an agent by naming it, which auto-creates a git branch with that name and a worktree, then launches Claude Code CLI in the worktree
- [ ] **AGENT-02**: User can delete an agent, which kills the process, removes the worktree, and deletes the branch
- [ ] **AGENT-03**: User can restart a previously finished agent, reusing its existing branch and worktree
- [ ] **AGENT-04**: User cannot delete an agent whose branch has unmerged changes vs staging (merge protection)
- [ ] **AGENT-05**: Agent status is tracked and visible (running, idle, finished, error, suspended)

### Sidebar & UI

- [ ] **UI-01**: Right sidebar shows agent tiles in a TreeView grouped by repository
- [ ] **UI-02**: Each agent tile displays name, repo, and current status indicator
- [ ] **UI-03**: Clicking an agent tile from the same repo switches only the agent CLI panel and code editor to that agent's worktree
- [ ] **UI-04**: Clicking an agent tile from a different repo switches the entire VS Code context -- file tree, code editor, bottom terminal, and agent CLI panel
- [ ] **UI-05**: Agent tile shows a merge button when the agent's branch has diffs vs the staging branch

### Terminal & Sessions

- [ ] **TERM-01**: Each agent runs as a Claude Code CLI session in a VS Code integrated terminal
- [ ] **TERM-02**: User can run 2-5 agent sessions concurrently without conflicts
- [ ] **TERM-03**: Agent sessions persist across VS Code restarts -- agent metadata and terminal sessions are restored
- [ ] **TERM-04**: User can suspend an idle/finished agent to free RAM -- terminal state is saved and process is killed
- [ ] **TERM-05**: User can restore a suspended agent -- process relaunches in the same worktree context
- [ ] **TERM-06**: User receives OS notification when a background agent finishes work or needs input

### Git Workflow

- [ ] **GIT-01**: When a repo is first added, user configures a staging branch name (default: "staging")
- [ ] **GIT-02**: Each agent works in its own git worktree, isolated from other agents and the main working directory
- [ ] **GIT-03**: User can open VS Code's native diff view to review changes between an agent's branch and the staging branch
- [ ] **GIT-04**: User can create a PR from an agent branch to the staging branch after reviewing diffs
- [ ] **GIT-05**: Worktree creation is capped with hard limits per repo to prevent disk explosion
- [ ] **GIT-06**: Extension tracks worktrees in a manifest and reconciles against actual state on activation

### Remote

- [ ] **REMOTE-01**: User can connect to remote repos via VS Code Remote SSH and manage agents on the remote machine
- [ ] **REMOTE-02**: Resource limits are configurable for remote environments (max agents, max worktrees)

### Performance

- [ ] **PERF-01**: Terminals are created lazily (only when agent is focused) to minimize RAM usage
- [ ] **PERF-02**: Extension remains responsive with 5 concurrent agents and large repositories
- [ ] **PERF-03**: Orphan agent processes are detected and cleaned up on extension activation
- [x] **PERF-04**: All git operations are async -- no synchronous calls that block the VS Code UI

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-Provider Support

- **PROV-01**: User can select different AI agent providers (Copilot, Cline, Codex) per agent session
- **PROV-02**: Provider abstraction layer allows new agent CLIs to be added via configuration

### Advanced UX

- **UX-01**: Extension auto-arranges IDE layout (editor splits, panel positions) for the agent workflow
- **UX-02**: Configurable branch naming patterns (e.g., `agent/{repo}/{name}`, `feature/{name}`)
- **UX-03**: Agent resource monitoring -- per-agent memory/CPU usage displayed on tiles

### Collaboration

- **COLLAB-01**: Agent task queuing -- schedule agents to run sequentially on related tasks

## Out of Scope

| Feature | Reason |
|---------|--------|
| Built-in chat/conversation UI | Claude Code extension already provides rich chat UI; CLI terminal is the interface |
| Multiple LLM providers in v1 | Scope creep; each provider has different CLI interfaces; Claude Code only for v1 |
| GitHub/GitLab API integration for PR creation | GitHub Pull Requests extension (20M installs) covers this; use `gh` CLI instead |
| Real-time inter-agent communication | Architectural complexity, race conditions; agents work independently |
| File synchronization between worktrees | Defeats isolation purpose; changes flow through git |
| Mobile or web interface | VS Code desktop only; Remote SSH covers remote use case |
| Custom editor/IDE chrome replacement | Use VS Code native views, diff editor, SCM, terminal |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GIT-01 | Phase 1 | Planned |
| GIT-02 | Phase 1 | Planned |
| GIT-05 | Phase 1 | Planned |
| GIT-06 | Phase 1 | Planned |
| PERF-04 | Phase 1 | Planned |
| AGENT-01 | Phase 2 | Planned |
| AGENT-02 | Phase 2 | Planned |
| AGENT-05 | Phase 2 | Planned |
| TERM-01 | Phase 2 | Planned |
| TERM-02 | Phase 2 | Planned |
| PERF-01 | Phase 2 | Planned |
| UI-01 | Phase 3 | Planned |
| UI-02 | Phase 3 | Planned |
| UI-03 | Phase 3 | Planned |
| UI-04 | Phase 3 | Planned |
| GIT-03 | Phase 4 | Planned |
| GIT-04 | Phase 4 | Planned |
| AGENT-04 | Phase 4 | Planned |
| UI-05 | Phase 4 | Planned |
| TERM-03 | Phase 5 | Planned |
| AGENT-03 | Phase 5 | Planned |
| PERF-03 | Phase 5 | Planned |
| TERM-04 | Phase 6 | Planned |
| TERM-05 | Phase 6 | Planned |
| TERM-06 | Phase 6 | Planned |
| REMOTE-01 | Phase 7 | Planned |
| REMOTE-02 | Phase 7 | Planned |
| PERF-02 | Phase 7 | Planned |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
