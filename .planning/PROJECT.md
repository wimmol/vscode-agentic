# VS Code Agentic

## What This Is

A VS Code extension that serves as a multi-repo, multi-agent workspace manager. Users can run multiple AI agent CLI sessions (Claude Code) across multiple repositories simultaneously, each in its own git worktree and branch. The extension provides a unified layout with agent tiles for fast switching, integrated terminals, and a git-based PR workflow from agent branches to a configurable staging branch.

## Core Value

Fast, isolated multi-agent development — switch between AI coding agents and repos instantly, with each agent working in its own worktree so nothing conflicts.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-panel layout: left file explorer (VS Code default), center-left code editor, center-right agent CLI panel, bottom repo terminal, right sidebar with agent tiles
- [ ] Right sidebar shows agent tiles grouped by project/repo
- [ ] Clicking an agent from the same repo switches only the agent CLI panel and code view to that agent's worktree
- [ ] Clicking an agent from a different repo switches everything — file tree, code editor, bottom terminal, and agent CLI
- [ ] Each agent session is a Claude Code CLI instance running in its own terminal
- [ ] Multiple agents can run simultaneously per repo (2-5 agents typical)
- [ ] Each agent gets its own git worktree and branch (branch named after the agent)
- [ ] User names the agent when creating it; branch uses that name
- [ ] Agent sessions stay alive in background when not focused
- [ ] Finished/idle agents can be suspended — terminal state saved, process removed from RAM, restored on demand
- [ ] Connect to remote repos via VS Code Remote SSH integration
- [ ] When a repo is first added, user configures a staging branch name (default: "staging")
- [ ] When an agent branch has diffs vs staging, show a merge button on the agent tile
- [ ] Merge button opens VS Code's built-in diff view for review
- [ ] After review, user can create PR from agent branch to staging branch
- [ ] User can delete an agent only if its branch is merged; deletes the worktree and branch
- [ ] User can start a new session with an existing (previously finished) agent, reusing its branch/worktree
- [ ] RAM optimization: lazy terminal management, suspend idle agent processes, efficient handling of large codebases
- [ ] Smooth, fast UX even with multiple terminals and large projects open

### Out of Scope

- Support for AI agents other than Claude Code — v1 is Claude Code only
- Mobile or web-based interface — VS Code desktop extension only
- Built-in code review / PR creation via GitHub/GitLab API — uses VS Code diff view instead
- Real-time collaboration between agents — agents work independently

## Context

- This is a greenfield VS Code extension project (empty folder)
- Target users: developers who use Claude Code CLI and work across multiple repos or features simultaneously
- Claude Code CLI is the agent runtime — the extension manages terminal sessions running `claude` commands
- Git worktrees are the isolation mechanism — each agent works on its own copy of the repo without affecting others
- VS Code Remote SSH is the mechanism for remote repo access (no custom SSH implementation needed)
- RAM is a real concern: multiple terminal processes + large codebases + VS Code itself can consume significant memory

## Constraints

- **Platform**: VS Code Extension API — must work within its webview, tree view, and terminal APIs
- **Agent runtime**: Claude Code CLI only for v1
- **Git**: Requires git worktree support (git 2.5+)
- **Performance**: Must remain responsive with 2-5 concurrent agent sessions and large repos

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Git worktrees for agent isolation | Each agent needs its own working directory to avoid conflicts; worktrees share the git object store so they're lightweight | — Pending |
| VS Code Remote SSH for remote repos | Leverages VS Code's built-in capability instead of custom SSH implementation | — Pending |
| Staging branch per repo | Provides a consistent merge target for agent work; configurable name per repo | — Pending |
| Suspend/restore for idle agents | Save terminal state and kill process to free RAM; restore when user switches back | — Pending |
| Claude Code CLI only for v1 | Focused scope; other agents can be added later with a provider pattern | — Pending |

---
*Last updated: 2026-03-04 after initialization*
