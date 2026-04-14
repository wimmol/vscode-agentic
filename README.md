# Agentic

Work on multiple repositories using AI agents, each in its own git worktree.

## Features

- **Multi-repo agent management** — Create and manage AI agents across multiple repositories from a single sidebar panel.
- **Git worktree isolation** — Each agent runs in its own worktree, keeping work isolated and parallel.
- **Live agent status** — Real-time status tracking (running, idle, error) with task timers, powered by session file monitoring.
- **Agentic Explorer** — Browse files scoped to branches and worktrees with full file operations (create, rename, delete, copy, cut, paste). Live file watching keeps the tree in sync with disk changes automatically.
- **Source Control** — Commit, push, and pull directly from the sidebar, scoped to the current repo or worktree. View changed files and open diffs with one click. Auto-suggest commit messages from your changes.
- **AI-powered actions** — Right-click files in the explorer to Send to Claude, Generate Documentation, or Refactor.
- **Worktree sync** — Keep worktrees in sync across your repositories.
- **Configurable agent command** — Set the CLI command used to launch agents (default: `claude`).

## Getting Started

1. Install the extension from the VS Code Marketplace.
2. Open the **Agentic** sidebar (robot icon in the activity bar).
3. Add repositories and create agents to start working.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `vscode-agentic.dangerouslyBypassPermissions` | `false` | Run agents with --dangerously-skip-permissions flag (no confirmation prompts) |
| `vscode-agentic.generateMdPrompt` | `""` | Additional instructions appended to the Generate Documentation agent prompt |
| `vscode-agentic.refactorPrompt` | `""` | Additional instructions appended to the Refactor agent prompt |

## Requirements

- Git 2.15+
- VS Code 1.74+

## License

[MIT](LICENSE.md)
