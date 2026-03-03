# Technology Stack

**Project:** VS Code Agentic (Multi-Repo Multi-Agent Workspace Manager)
**Researched:** 2026-03-04

## Critical Context: VS Code 1.109+ Multi-Agent Landscape

**This changes everything.** As of VS Code 1.109 (January 2026), VS Code itself has become a "multi-agent development platform" with:
- Built-in Agent Sessions view for managing local, background, and cloud agents
- Native git worktree support for background agent isolation (`git.worktreeIncludeFiles`)
- Claude Agent preview integrated directly into VS Code via GitHub Copilot
- The official Claude Code VS Code extension (by Anthropic) already provides a graphical panel, multiple conversation tabs, and `claude --worktree` for isolated sessions

**Implication:** This extension must differentiate from built-in VS Code agent management AND the official Claude Code extension. The value proposition is NOT "run Claude Code in VS Code" (that exists). It IS "manage a fleet of Claude Code CLI agents across multiple repos with a unified dashboard, custom tiling layout, and PR workflow." The extension is an orchestration layer, not a Claude Code wrapper.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TypeScript | ^5.6 | Extension language | Required for VS Code extension development. Type safety is essential for the complex state management (agents, repos, worktrees, terminals). All VS Code APIs have TypeScript definitions. | HIGH |
| VS Code Extension API | ^1.96.0 (`@types/vscode`) | Extension host APIs | Target engine `^1.96.0` in `package.json` to support VS Code 1.96+. This gives access to all terminal, webview, and tree view APIs we need while covering 95%+ of users. Do NOT target 1.109 -- we want broad compatibility. | HIGH |
| Node.js | 20+ (LTS) | Runtime | VS Code's extension host runs on Node.js. Node 20 is the current LTS baseline VS Code targets. | HIGH |

### Build & Bundling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| esbuild | ^0.24.0 | Bundler | Official VS Code recommendation. 10-100x faster than webpack. The `yo code` generator now scaffolds esbuild by default. Two build targets needed: extension host (Node/CJS) and webview (browser/ESM). | HIGH |
| TypeScript Compiler (tsc) | ^5.6 | Type checking only | esbuild strips types without checking them. Run `tsc --noEmit` separately for type safety. This is the standard VS Code extension pattern. | HIGH |

### UI Components

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| VS Code TreeView API (native) | Built-in | Right sidebar agent tiles | Agent tiles grouped by repo are a tree structure. TreeDataProvider is lightweight, native-feeling, and zero-dependency. Use TreeView for the agent list -- it matches VS Code UX patterns and avoids webview overhead. | HIGH |
| VS Code Webview API (native) | Built-in | Agent detail panels, dashboard | For richer UI (agent status cards, merge buttons, config forms). Use WebviewViewProvider for sidebar panels and webview panels for the main dashboard view. | HIGH |
| @vscode-elements/elements | ^2.5 | Webview UI components | The replacement for the deprecated `@vscode/webview-ui-toolkit` (sunset Jan 2025). Framework-agnostic web components that match VS Code's native look. 40+ components including buttons, badges, trees, tabs, progress indicators. Use VS Code's 400+ CSS custom properties (`--vscode-*`) for theme consistency. | MEDIUM |
| Vanilla HTML/CSS + VS Code theme vars | N/A | Webview styling fallback | For simple webviews, plain HTML with `var(--vscode-editor-foreground)` etc. is sufficient and zero-dependency. Reserve `@vscode-elements` for complex forms/interactions. | HIGH |

**Why NOT React/Preact for webviews:** The agent tiles sidebar is best served by native TreeView (zero bundle size, native UX). The detail panels are relatively simple (status, buttons, config). Using React would add 40KB+ to the webview bundle for marginal benefit. If webview complexity grows in v2+, Preact (3KB) is the right upgrade path, not React.

### Terminal Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `vscode.window.createTerminal()` | Built-in | Creating agent terminal sessions | The standard API for creating integrated terminals. Each Claude Code agent gets its own terminal via `createTerminal({ name, cwd, shellPath, shellArgs })`. The `cwd` parameter points to the agent's worktree directory. | HIGH |
| `Terminal.sendText()` | Built-in | Sending commands to agent terminals | Used to launch `claude` CLI in each terminal. For terminals with shell integration, prefer `shellIntegration.executeCommand()` for exit code tracking. Fall back to `sendText()` when shell integration unavailable. | HIGH |
| `vscode.window.onDidCloseTerminal` | Built-in | Terminal lifecycle tracking | Essential for knowing when an agent process exits (user closed it, crashed, or completed). Update agent status in the sidebar accordingly. | HIGH |
| `vscode.window.onDidChangeActiveTerminal` | Built-in | Focus tracking | Track which agent terminal is active to sync the sidebar selection and code editor view. | HIGH |

**Why NOT Pseudoterminal:** Pseudoterminals (`ExtensionTerminalOptions`) run in the extension host process and do NOT survive window reloads. Since Claude Code sessions are long-running (minutes to hours), losing state on reload is unacceptable. Real terminals (`createTerminal`) persist across reloads via VS Code's built-in terminal reconnection (`terminal.integrated.persistentSessionScrollback`). Use real terminals.

**Why NOT node-pty + xterm.js in a webview:** Dramatically more complex, requires native module compilation, and reinvents what VS Code's integrated terminal already does well. This would only make sense if we needed pixel-perfect terminal rendering in a custom layout -- but VS Code's terminal grid is sufficient for v1.

### Git Operations

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `child_process.execFile` | Built-in (Node.js) | Git CLI wrapper | Direct git CLI invocation. Simpler and more predictable than `simple-git` for worktree operations. Git worktree commands (`git worktree add/list/remove/prune`) are straightforward enough that a thin wrapper around `execFile` is superior to a dependency. | HIGH |
| Custom git wrapper module | N/A | Typed git operations | Build a thin `GitService` class that wraps `execFile('git', [...args])` with TypeScript types. Methods: `worktreeAdd()`, `worktreeList()`, `worktreeRemove()`, `branchCreate()`, `diffStat()`, `mergeBase()`. Parsing git output is trivial for these commands. | HIGH |
| VS Code SCM API (`vscode.scm`) | Built-in | Diff view integration | Use VS Code's built-in diff editor (`vscode.commands.executeCommand('vscode.diff', ...)`) for reviewing agent changes before merging. Do NOT build a custom diff viewer. | HIGH |

**Why NOT simple-git:** simple-git (v3.32) is a solid library, but its worktree support is limited -- it has config scoping for worktrees but no dedicated `worktree add/list/remove` methods. You'd use `git.raw()` anyway, which is just `child_process` with extra abstraction. For an extension where git is a core concern and worktrees are the primary operation, owning the git layer gives better error handling and zero dependency risk. simple-git's 50+ transitive dependencies are unnecessary baggage.

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `ExtensionContext.workspaceState` | Built-in | Per-workspace agent config | Stores agent definitions, repo configurations, staging branch names per workspace. Survives VS Code restarts. Backed by SQLite internally. | HIGH |
| `ExtensionContext.globalState` | Built-in | Cross-workspace settings | Stores global preferences (default staging branch name, layout preferences). | HIGH |
| In-memory state with EventEmitter | Built-in (Node.js) | Runtime agent state | Agent status (running/idle/suspended), terminal references, active focus -- these are runtime-only and don't need persistence. Use a central `AgentStateManager` class with EventEmitter for reactive updates to the TreeView and webviews. | HIGH |

**Why NOT a state management library (MobX, Zustand, etc.):** The state shape is simple -- a map of repos, each with a list of agents. VS Code's Memento API + EventEmitter pattern is the standard for extensions. Adding a state library adds bundle size and complexity without solving a real problem at this scale.

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @vscode/test-cli | ^0.0.12 | Test runner CLI | Official VS Code test runner. Runs tests inside a real VS Code instance (Extension Development Host). Required for testing anything that touches the VS Code API. | HIGH |
| @vscode/test-electron | ^2.5.2 | VS Code instance for testing | Downloads and launches VS Code for integration tests. Used by `@vscode/test-cli` under the hood. | HIGH |
| Mocha | ^10 | Test framework | `@vscode/test-cli` uses Mocha internally. Do not fight it -- use Mocha for integration tests. | HIGH |
| Vitest | ^3 | Unit tests (non-VS Code code) | For testing pure logic (git parsing, state management, utility functions) that doesn't need a VS Code instance. Faster iteration than the full Extension Development Host. Keep a clear boundary: Vitest for logic, Mocha/@vscode/test-cli for integration. | MEDIUM |

### Packaging & Publishing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @vscode/vsce | Latest | Package & publish | Official CLI for creating `.vsix` packages and publishing to the VS Code Marketplace. Use `vsce package` for local testing, `vsce publish` for releases. | HIGH |

### Code Quality

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ESLint | ^9 | Linting | Flat config format (eslint.config.js) is now standard. Use `@typescript-eslint/eslint-plugin` for TS-specific rules. | HIGH |
| Prettier | ^3 | Formatting | Consistent code style. Integrate with ESLint via `eslint-config-prettier`. | HIGH |

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| VS Code Extension API (activation events) | Built-in | Lazy loading | Use `onView:agentSidebar` and `onCommand:*` activation events. Do NOT use `*` activation. The extension should load only when the user interacts with the agent sidebar or runs a command. | HIGH |
| VS Code `workspace.fs` | Built-in | File operations | For any file operations in worktrees (checking existence, reading configs). Prefer over Node.js `fs` for remote workspace compatibility (VS Code Remote SSH). | HIGH |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Bundler | esbuild | webpack | Slower by 10-100x. webpack is legacy for new VS Code extensions. |
| Bundler | esbuild | Vite | Vite is great for web apps but adds complexity for VS Code extensions. esbuild is simpler for the dual-target build (node + browser). |
| UI Framework | TreeView + vanilla webview | React | Overkill for the UI complexity. Adds 40KB+ bundle. TreeView handles the primary UI (agent list). |
| UI Framework | @vscode-elements | @vscode/webview-ui-toolkit | Deprecated Jan 2025. The FAST Foundation dependency was sunset. vscode-elements is the community successor. |
| UI Framework | @vscode-elements | Lit | Lit is solid but vscode-elements already wraps VS Code-specific styling. Using Lit means rebuilding all the VS Code theme integration yourself. |
| Git Library | child_process wrapper | simple-git | No dedicated worktree methods. Would use `raw()` anyway. 50+ deps for something achievable in ~200 lines of typed wrapper code. |
| Git Library | child_process wrapper | isomorphic-git | Pure JS git implementation. No worktree support. Designed for browsers, not Node.js extension hosts with git already available on PATH. |
| State Management | Memento + EventEmitter | MobX/Zustand | Unnecessary complexity. VS Code's built-in state + events handles this scale. |
| Terminal | createTerminal (real) | Pseudoterminal | Does not survive window reloads. Claude Code sessions are long-running. |
| Terminal | createTerminal (real) | node-pty + xterm.js webview | Massively more complex. Requires native module compilation. VS Code's terminal is already xterm.js. |
| Testing | Mocha + Vitest split | Jest | @vscode/test-cli uses Mocha. Using Jest fights the toolchain. |
| Testing | Vitest (unit) | Mocha (unit) | Vitest is faster for pure logic tests. Mocha is only needed when VS Code APIs are involved. |

## Installation

```bash
# Scaffold with official generator
npx --package yo --package generator-code -- yo code

# Core dependencies (none needed for production -- VS Code API is provided at runtime)

# Dev dependencies
npm install -D typescript @types/vscode @types/node esbuild \
  @vscode/test-cli @vscode/test-electron @vscode/vsce \
  eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-config-prettier prettier

# Optional: webview UI components (add when building webview panels)
npm install @vscode-elements/elements

# Optional: unit testing (add when writing pure logic tests)
npm install -D vitest
```

## Key package.json Configuration

```jsonc
{
  "engines": {
    "vscode": "^1.96.0"
  },
  "activationEvents": [
    "onView:vscodagentic.agentSidebar"
  ],
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "vscode-agentic",
          "title": "Agentic",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "vscode-agentic": [
        {
          "id": "vscodagentic.agentSidebar",
          "name": "Agents",
          "type": "tree"
        }
      ]
    },
    "commands": [
      // Agent CRUD, repo management, merge workflow commands
    ]
  }
}
```

## Version Compatibility Matrix

| Component | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| VS Code | 1.96.0 | 1.108+ | 1.96 gives us all needed APIs. Broader compat = more users. |
| Node.js | 18 | 20 LTS | Extension host uses VS Code's bundled Node. We don't control this. |
| Git | 2.5 | 2.40+ | git worktree was added in 2.5. 2.40+ for better worktree features. |
| Claude Code CLI | Latest | Latest | User must have `claude` on PATH. Extension spawns it as a subprocess. |

## Sources

- [VS Code Extension API Reference](https://code.visualstudio.com/api/references/vscode-api) - HIGH confidence
- [VS Code Extension Bundling Guide](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) - HIGH confidence
- [VS Code Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview) - HIGH confidence
- [VS Code Tree View API Guide](https://code.visualstudio.com/api/extension-guides/tree-view) - HIGH confidence
- [VS Code Terminal Advanced Docs](https://code.visualstudio.com/docs/terminal/advanced) - HIGH confidence
- [VS Code Activation Events Reference](https://code.visualstudio.com/api/references/activation-events) - HIGH confidence
- [VS Code Testing Extensions Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension) - HIGH confidence
- [VS Code Publishing Extensions Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) - HIGH confidence
- [VS Code 1.109 Release Notes (Jan 2026)](https://code.visualstudio.com/updates/v1_109) - HIGH confidence
- [VS Code Multi-Agent Development Blog Post](https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development) - HIGH confidence
- [Claude Code VS Code Extension Docs](https://code.claude.com/docs/en/vs-code) - HIGH confidence
- [vscode-elements Library](https://github.com/vscode-elements/elements) - MEDIUM confidence
- [Webview UI Toolkit Deprecation (Issue #561)](https://github.com/microsoft/vscode-webview-ui-toolkit/issues/561) - HIGH confidence
- [simple-git npm](https://www.npmjs.com/package/simple-git) - HIGH confidence
- [@vscode/test-electron npm](https://www.npmjs.com/package/@vscode/test-electron) - HIGH confidence
- [@vscode/test-cli npm](https://www.npmjs.com/@vscode/test-cli) - HIGH confidence
- [Building VS Code Extensions in 2026](https://abdulkadersafi.com/blog/building-vs-code-extensions-in-2026-the-complete-modern-guide) - MEDIUM confidence
- [Git Worktree Manager Extension](https://github.com/jackiotyu/git-worktree-manager) - MEDIUM confidence
