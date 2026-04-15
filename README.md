# Agentic

Convenient sidebar extension to keep all your agents in plain sight. Toggle between projects and worktrees in one click, develop specific agent prompts and fork context. The Agentic extension is a convenient wrapper of Claude Code TUI that brings no limitations and all improvements are optional to use.

### Why Agentic over other agent frameworks?

1. **Use your Claude Code subscription** instead of extra usage or API tokens.
2. **Use Claude Code CLI** with all skills, plugins, MCP servers, and settings of your Claude.
3. **Open source extension in an open source IDE.**
4. **Native terminal for agents** without any unexpected behavior.

## Features

- **Multi-repo agent management** — Create and manage AI agents across multiple repositories from a single sidebar panel.
- **Git worktree isolation** — Each agent runs in its own worktree, keeping work isolated and parallel.
- **Live agent status** — Real-time status tracking (running, idle, error) with task timers and context usage display.
- **Agent templates** — Create reusable prompt templates for common tasks. Pick a template when spawning an agent.
- **Prompt queue** — Stack multiple prompts for sequential execution. Auto-drains when agent finishes.
- **Session forking** — Fork an agent to a new branch with context carried over. Great for exploring alternatives.
- **Expandable agent tiles** — Click to expand inline details: branch, worktree, context usage, full prompt, queued prompts, and action buttons.
- **Context usage tracking** — See token usage (e.g. `47k / 1M`) with color thresholds and a thin progress bar per agent.
- **Output summaries** — See what the agent accomplished at a glance without opening the terminal.
- **Notifications** — VS Code notifications when agents finish or encounter errors.
- **Agentic Explorer** — Browse files scoped to branches and worktrees with full file operations. Live file watching keeps the tree in sync.
- **Source Control** — Commit, push, and pull directly from the sidebar. View changed files and open diffs. Auto-suggest commit messages.
- **Agent rename** — Rename agents from the expanded tile detail view.

## Getting Started

1. Install the extension from the VS Code Marketplace.
2. Open the **Agentic** sidebar (robot icon in the activity bar).
3. Add repositories and create agents to start working.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `vscode-agentic.dangerouslyBypassPermissions` | `false` | Run agents with `--dangerously-skip-permissions` flag (no confirmation prompts) |

## Requirements

- Git 2.15+
- VS Code 1.74+
- Claude Code CLI installed

## License

[MIT](LICENSE.md)
