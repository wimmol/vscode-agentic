# Agentic

Work on multiple repositories using AI agents, each in its own git worktree.

## Features

- **Multi-repo agent management** — Create and manage AI agents across multiple repositories from a single sidebar panel.
- **Git worktree isolation** — Each agent runs in its own worktree, keeping work isolated and parallel.
- **Configurable agent command** — Set the CLI command used to launch agents (default: `claude`).
- **Sidebar UI** — View and control all agents from the Agentic sidebar tab.

## Getting Started

1. Install the extension from the VS Code Marketplace.
2. Open the **Agentic** sidebar (robot icon in the activity bar).
3. Add repositories and create agents to start working.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `vscode-agentic.dangerouslyBypassPermissions` | `false` | Run agents with --dangerously-skip-permissions flag (no confirmation prompts) |

## Requirements

- Git 2.15+
- VS Code 1.74+
