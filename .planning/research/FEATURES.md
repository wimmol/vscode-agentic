# Feature Landscape

**Domain:** VS Code extension for multi-repo, multi-agent workspace management (Claude Code CLI)
**Researched:** 2026-03-04
**Overall Confidence:** MEDIUM-HIGH

## Context

This feature landscape maps what VS Code users expect from extensions that manage multiple repositories, multiple AI agent sessions, terminal management, and git-based workflows. The primary competitors and reference points are:

- **VS Code built-in Agent Sessions / Agent HQ** (v1.107-1.109): Native multi-agent orchestration with background agents, subagents, and session management
- **Cline** (1.6M+ installs): Single-agent-per-session VS Code extension with CLI multi-instance support
- **Roo Code**: Multi-mode (Architect/Code/Debug) agent with orchestrator pattern
- **Git Worktree Manager** extensions: Several existing extensions for worktree CRUD
- **Claude Code VS Code Extension**: Official Anthropic extension with sidebar panel, multiple sessions via separate tabs

The key insight: VS Code itself (v1.107+) now has Agent HQ, background agents with worktree isolation, and multi-agent session management built in. Our extension must differentiate by solving the **specific multi-repo, multi-agent orchestration workflow** that VS Code's generic agent platform does not address -- namely, the tight coupling of agent lifecycle, worktree management, PR workflow, and cross-repo context switching.

---

## Table Stakes

Features users expect. Missing any of these and the extension feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Agent session creation** -- name an agent, create worktree + branch, launch Claude Code CLI | Core value proposition. Every competing tool lets you start an agent session with one action. | Medium | Must automate: `git worktree add`, branch creation, terminal spawn, `claude` command launch |
| **Agent tile sidebar** -- visual list of all agents grouped by repo with status indicators | VS Code Agent HQ already shows sessions in sidebar. Users expect at-a-glance status. Roo Code and Cline both have sidebar presence. | Medium | Tree view or webview in Activity Bar. Must show: agent name, repo, status (running/idle/finished/suspended), unread indicator |
| **One-click agent switching** -- click tile to focus that agent's terminal, code view, and file tree | Core UX promise. VS Code multi-root workspaces already switch file trees. Git Worktree Manager already switches worktrees. Users expect instant context switch. | High | Same-repo switch (terminal + editor only) vs cross-repo switch (everything) is a critical UX distinction from PROJECT.md |
| **Multiple concurrent agents** -- 2-5 agents running simultaneously without conflicts | Cline CLI supports isolated instances. VS Code background agents run in parallel. This is the baseline expectation for a "multi-agent" tool. | Medium | Each agent = separate terminal process. Git worktrees provide filesystem isolation. Main challenge is RAM management. |
| **Agent status visibility** -- running, idle, waiting for input, finished, error states | VS Code Agent HQ shows in-progress/unread badges. Status bar indicators are standard. Users need to know which agents need attention without clicking into each one. | Low | Poll terminal output or use Claude Code CLI status signals. Badge counts on sidebar icon. |
| **Terminal integration** -- each agent runs in a VS Code integrated terminal | Every AI agent extension uses VS Code's terminal API. Claude Code VS Code extension already runs in integrated terminal. | Low | Use `vscode.window.createTerminal()` with specific cwd set to worktree path |
| **Agent lifecycle management** -- create, restart, delete agents | Basic CRUD. Git Worktree Manager has create/delete. Users expect clean lifecycle management. | Medium | Delete must clean up: kill process, remove worktree, optionally delete branch. Must guard against deleting unmerged work. |
| **Per-repo configuration** -- staging branch name, default agent settings | Multi-root workspace config is standard in VS Code. Per-folder settings are a well-understood pattern. | Low | Store in `.code-workspace` or extension-specific config per repo root |
| **Persistent sessions across VS Code restarts** -- agents survive window reload | VS Code has built-in terminal persistence (`terminal.integrated.persistentSessionReviveProcess`). Users expect extension state to survive restarts. | Medium | Must persist: agent metadata, terminal sessions (via VS Code API), worktree mappings. Terminal content restoration uses VS Code's native persistent sessions. |
| **OS notifications** -- alert when background agent finishes or needs input | VS Code v1.105+ shows OS badge and notification toast when chat responses arrive while window unfocused. Users will expect the same from CLI agents. | Low | Use `vscode.window.showInformationMessage()` with `modal: false` or VS Code notification API. Detect agent completion by monitoring terminal output. |

---

## Differentiators

Features that set this extension apart from VS Code's built-in Agent HQ, Cline, Roo Code, and standalone worktree managers. These create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Cross-repo context switching** -- clicking agent from different repo switches entire VS Code context (file tree, editor, terminal, agent panel) | No existing tool does this seamlessly. VS Code multi-root workspaces show all repos but don't "focus" one. Git Worktree extensions switch worktrees but not the full IDE context. This is the killer feature. | High | Requires coordinating: `vscode.workspace.updateWorkspaceFolders()`, editor group management, terminal focus, sidebar state. Must feel instant (<200ms perceived). |
| **Suspend/restore agent sessions** -- save terminal state, kill process, free RAM, restore on demand | No VS Code extension does this. VS Code background agents use worktree isolation but don't suspend processes. tmux has detach/attach but isn't integrated into VS Code UX. With 2-5 agents per repo, RAM is a real constraint. | High | Options: (1) tmux-backed terminals with detach/attach, (2) terminal scrollback serialization + process restart, (3) VS Code's persistent session API with custom suspend logic. tmux approach is most robust but adds dependency. |
| **Agent-to-staging PR workflow** -- visual merge button on tile when agent branch has diffs vs staging, opens diff view, creates PR | Combines git awareness with agent lifecycle. No existing tool ties agent completion to PR creation. Compare Branch extension does diffs but not agent-aware PRs. This closes the loop from "agent did work" to "work is reviewed and merged." | Medium | Use VS Code's built-in diff editor (`vscode.commands.executeCommand('vscode.diff', ...)`) for review. PR creation can use VS Code SCM API or shell out to `gh`/`git`. |
| **Intelligent layout management** -- preset layout with agent CLI panel, code editor, file explorer, repo terminal all in defined positions | VS Code's Custom Layout API exists but no extension auto-arranges for the agent workflow. Workspace Layout extension requires manual config. Auto-arranging the IDE for agent work is a significant DX win. | Medium | Use `vscode.commands.executeCommand('vscode.setEditorLayout', ...)` for editor groups. Sidebar and panel positioning via `workbench.action.*` commands. Save/restore layout per mode (coding vs reviewing). |
| **Agent resource monitoring** -- show per-agent memory/CPU usage, total extension footprint | Resource Monitor extension exists but is system-wide. No agent-specific resource tracking exists. Critical for users running 5+ agents who need to know which to suspend. | Medium | Monitor child process PIDs via Node.js `process` APIs. Display in agent tile as small indicator. Threshold warnings for high memory. |
| **Smart agent naming with branch convention** -- user names agent, branch auto-created with convention (e.g., `agent/feature-name`), worktree auto-provisioned | Git Worktree Manager requires manual branch specification. Automating the naming-to-branch-to-worktree pipeline removes friction from the most common action. | Low | Template: `agent/{agent-name}` or configurable pattern. Validate branch name (sanitize special chars). Check for existing branches. |
| **Agent reuse** -- restart a previously finished agent with its existing branch/worktree intact | No existing tool treats agents as resumable entities. Cline and Roo Code start fresh sessions. Being able to say "resume the auth-refactor agent" and get back the full context is powerful. | Low | Keep agent metadata after completion. On resume: recreate terminal in worktree directory, optionally re-launch Claude Code with conversation context. |
| **Merge protection** -- prevent agent deletion if branch has unmerged changes | Safety net that no existing tool provides in this context. Protects against accidentally destroying agent work. | Low | `git log staging..agent-branch --oneline` to check for unmerged commits. Disable delete button or show confirmation with diff summary. |

---

## Anti-Features

Features to explicitly NOT build. These are tempting but would dilute focus, increase complexity, or compete with existing tools that do them better.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Built-in chat/conversation UI for Claude Code** | Claude Code VS Code extension already has a sidebar panel with rich chat UI. Cline and Roo Code have polished chat interfaces. Building another one duplicates effort and will always be worse than the official extension. | Use Claude Code's CLI in a terminal. The terminal IS the chat interface. Focus on orchestrating terminals, not replacing them. |
| **Support for multiple AI agent providers (v1)** | Scope creep. Each provider (Copilot, Cline, Codex, Gemini) has different CLI interfaces, output formats, and lifecycle patterns. Supporting all dilutes every feature. | Claude Code CLI only for v1. Design with a provider abstraction so v2 can add others, but don't build the abstraction prematurely. |
| **Built-in code review / PR creation via GitHub/GitLab API** | GitHub Pull Requests extension (Microsoft, 20M+ installs) already does this excellently. GitLab Workflow extension covers GitLab. Reimplementing API-level PR management is a massive surface area. | Open VS Code's diff view for review. For PR creation, shell out to `gh pr create` or provide a button that launches the GitHub PR extension's flow. |
| **Real-time agent collaboration / inter-agent communication** | Architectural complexity explodes. Agents sharing context creates race conditions, merge conflicts within worktrees, and unpredictable behavior. VS Code's subagent pattern solves orchestration differently. | Agents work independently in isolated worktrees. User is the orchestrator. If coordination is needed, user reviews and merges via staging branch. |
| **Custom editor / IDE chrome replacement** | Fighting VS Code's native UX patterns leads to maintenance nightmares and user confusion. Extensions that try to replace core VS Code UX (editors, file tree, SCM) feel foreign and break with updates. | Use VS Code's native views (TreeView, WebviewView), native diff editor, native SCM, native terminal. Compose existing primitives. |
| **Agent task queuing / scheduling** | Premature optimization. Users don't need to schedule agents -- they need to manage running ones. Task queuing adds state machine complexity without clear user demand. | Let users manually start/stop agents. If queuing demand emerges from real usage, add it in a later version. |
| **File synchronization between agent worktrees** | Git worktrees share the object store but have independent working directories by design. Syncing files between worktrees defeats the isolation purpose and creates merge conflicts. | Each agent works in its isolated worktree. Changes flow through git (commit, push, merge to staging). |
| **Mobile or web interface** | PROJECT.md explicitly scopes to VS Code desktop. Web/mobile adds deployment complexity, different UI framework, auth concerns. | VS Code Desktop extension only. Remote SSH support covers "remote" use case. |

---

## Feature Dependencies

```
Agent Session Creation
  |-> Git Worktree Management (must create worktree before agent can start)
  |-> Terminal Management (must create terminal in worktree directory)
  |-> Agent Naming/Branch Convention (branch must exist before worktree)

Agent Tile Sidebar
  |-> Agent Status Tracking (tiles need status to display)
  |-> Agent Session Creation (must have agents to show)

One-Click Agent Switching
  |-> Agent Tile Sidebar (switching is triggered from tiles)
  |-> Terminal Management (must switch terminal focus)
  |-> Layout Management (must rearrange panels on switch)

Cross-Repo Context Switching
  |-> One-Click Agent Switching (extends same-repo switching)
  |-> Multi-Root Workspace Management (must change active workspace folder)

Suspend/Restore
  |-> Agent Status Tracking (must track suspended state)
  |-> Terminal Management (must save/restore terminal state)
  |-> Agent Lifecycle Management (suspend is a lifecycle event)

Agent-to-Staging PR Workflow
  |-> Agent Status Tracking (trigger merge button when agent has diffs)
  |-> Git Integration (must diff agent branch vs staging)
  |-> Agent Lifecycle Management (merged agents can be deleted)

Merge Protection
  |-> Agent-to-Staging PR Workflow (check merge status before delete)
  |-> Agent Lifecycle Management (guard the delete action)

Persistent Sessions
  |-> Agent Session Creation (must serialize/deserialize agent metadata)
  |-> Terminal Management (must reconnect to persisted terminals)
```

---

## MVP Recommendation

### Phase 1: Core Agent Lifecycle (Table Stakes)
Prioritize these to have a usable product:

1. **Agent session creation** -- name agent, create branch + worktree, launch Claude Code CLI terminal
2. **Agent tile sidebar** -- tree view showing agents grouped by repo with basic status
3. **One-click agent switching** (same-repo only first) -- switch terminal and editor to agent's worktree
4. **Agent lifecycle management** -- create and delete agents with worktree cleanup
5. **Per-repo configuration** -- staging branch name

### Phase 2: Full Workflow
6. **Cross-repo context switching** -- full IDE context switch when clicking agent from different repo
7. **Agent-to-staging PR workflow** -- diff view + merge button
8. **Merge protection** -- prevent deletion of unmerged agents
9. **Agent reuse** -- restart finished agents

### Phase 3: Performance and Polish
10. **Suspend/restore** -- save RAM by suspending idle agents
11. **OS notifications** -- alert on agent completion
12. **Persistent sessions** -- survive VS Code restarts
13. **Agent resource monitoring** -- per-agent memory tracking

### Phase 4: Advanced UX
14. **Intelligent layout management** -- auto-arrange IDE for agent workflow
15. **Smart agent naming** -- configurable branch naming patterns

**Defer:** Multi-provider support, task queuing, inter-agent communication, custom chat UI.

**Rationale:** Phase 1 delivers the core "create agent, see agents, switch between them" loop. Phase 2 closes the git workflow loop. Phase 3 addresses the RAM/reliability concerns that become critical at scale (5+ agents). Phase 4 is polish that makes power users faster.

---

## Competitive Positioning

| Capability | VS Code Agent HQ | Cline | Roo Code | This Extension |
|------------|-----------------|-------|----------|----------------|
| Multi-agent sessions | Yes (v1.107+) | CLI only | Single (modes) | Yes (core feature) |
| Worktree isolation | Background agents | Manual | No | Automated per-agent |
| Cross-repo switching | No | No | No | **Yes (differentiator)** |
| Agent-aware PR workflow | No | No | No | **Yes (differentiator)** |
| Suspend/restore | No | No | No | **Yes (differentiator)** |
| Agent resource monitoring | No | No | No | **Yes (differentiator)** |
| Custom chat UI | Yes | Yes | Yes | No (uses CLI terminal) |
| Multiple LLM providers | Yes | Yes | Yes | No (Claude Code only, v1) |
| Background/cloud agents | Yes | No | Cloud sync | No (local only, v1) |

The extension's competitive moat is the **tight integration between agent lifecycle, git worktree management, and PR workflow** -- a specific workflow that no existing tool handles end-to-end.

---

## Sources

- [VS Code Multi-Root Workspaces Documentation](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces)
- [VS Code Unified Agent Experience Blog](https://code.visualstudio.com/blogs/2025/11/03/unified-agent-experience)
- [VS Code Multi-Agent Development Blog (Feb 2026)](https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development)
- [VS Code Agent HQ / v1.107 Release](https://visualstudiomagazine.com/articles/2025/12/12/vs-code-1-107-november-2025-update-expands-multi-agent-orchestration-model-management.aspx)
- [VS Code Custom Layout Documentation](https://code.visualstudio.com/docs/configure/custom-layout)
- [VS Code Terminal Advanced Documentation](https://code.visualstudio.com/docs/terminal/advanced)
- [VS Code Persistent Terminal Sessions](https://medium.com/@joaomoreno/persistent-terminal-sessions-in-vs-code-8fc469ed6b41)
- [Git Worktree Manager Extension](https://marketplace.visualstudio.com/items?itemName=jackiotyu.git-worktree-manager)
- [VS Code Git Branches and Worktrees](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees)
- [Claude Code VS Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
- [Claude Code VS Code Docs](https://code.claude.com/docs/en/vs-code)
- [Running Multiple Claude Instances](https://www.arsturn.com/blog/how-to-run-multiple-claude-instances-in-vs-code-a-developers-guide)
- [Cline VS Code Extension](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)
- [Cline CLI 2.0 Multi-Agent](https://devops.com/cline-cli-2-0-turns-your-terminal-into-an-ai-agent-control-plane/)
- [Roo Code Extension](https://roocode.com)
- [Roo Code Multi-Agent Workflow](https://xebia.com/blog/multi-agent-workflow-with-roo-code/)
- [VS Code Sidebar UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/sidebars)
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Notifications UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/notifications)
- [Compare Branch Extension](https://marketplace.visualstudio.com/items?itemName=goodfoot.compare-branch)
- [Sidebar Terminal Extension](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [Workspace Layout Extension](https://marketplace.visualstudio.com/items?itemName=lostintangent.workspace-layout)
- [tmux VS Code Integration](https://george.honeywood.org.uk/blog/vs-code-and-tmux/)
