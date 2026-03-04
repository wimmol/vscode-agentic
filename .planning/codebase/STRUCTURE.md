# Codebase Structure

**Analysis Date:** 2026-03-04

## Directory Layout

```
vscode-agentic/
├── src/                        # All production TypeScript source
│   ├── extension.ts            # Extension entry point (activate/deactivate)
│   ├── commands/               # VS Code command registrations (UI interaction)
│   │   ├── agent.commands.ts   # createAgent, deleteAgent, focusAgent, suspendAgent, suspendAllIdle
│   │   ├── diff.commands.ts    # reviewChanges, createPR
│   │   ├── repo.commands.ts    # addRepo
│   │   ├── sidebar.commands.ts # focusAgentFromTile, deleteAgentFromTile, copyBranchName, createAgentInRepo, suspendAgentFromTile, restoreAgentFromTile
│   │   └── worktree.commands.ts # handleWorktreeLimitError helper
│   ├── models/                 # TypeScript interfaces and Memento key constants (no logic)
│   │   ├── agent.ts            # AgentEntry, AgentStatus, AGENT_REGISTRY_KEY, PID_REGISTRY_KEY, LAST_FOCUSED_KEY
│   │   ├── repo.ts             # RepoConfig, REPO_CONFIGS_KEY, DEFAULT_STAGING_BRANCH
│   │   └── worktree.ts         # WorktreeEntry, WorktreeOnDisk, WORKTREE_MANIFEST_KEY, WORKTREE_DIR_NAME
│   ├── providers/              # VS Code content providers
│   │   └── git-content.provider.ts  # TextDocumentContentProvider for agentic-git: scheme
│   ├── services/               # Business logic (all domain operations)
│   │   ├── agent.service.ts    # Agent lifecycle: create, delete, focus, suspend, reconcile
│   │   ├── diff.service.ts     # Git diff queries (unmerged changes, changed file lists)
│   │   ├── git.service.ts      # Raw git CLI wrapper (execFile)
│   │   ├── repo-config.service.ts  # Repository configuration CRUD + interactive addRepo flow
│   │   ├── terminal.service.ts # VS Code terminal lifecycle for Claude CLI sessions
│   │   ├── workspace-switch.service.ts  # Workspace folder + explorer + terminal focus on agent click
│   │   └── worktree.service.ts # Git worktree CRUD + reconciliation + per-repo mutex
│   ├── utils/                  # Pure stateless helpers
│   │   ├── branch-validation.ts # isValidBranchName (git check-ref-format rules)
│   │   ├── gitignore.ts        # ensureGitignoreEntry (.worktrees/ entry)
│   │   └── worktree-parser.ts  # parseWorktreeList (git worktree list --porcelain parser)
│   └── views/                  # Sidebar TreeDataProvider and TreeItem classes
│       ├── agent-tree-items.ts  # RepoGroupItem, AgentTreeItem, getStatusIcon
│       └── agent-tree-provider.ts  # AgentTreeProvider (vscode.TreeDataProvider), diff TTL cache
├── test/
│   ├── __mocks__/
│   │   └── vscode.ts           # Full vscode module mock for unit tests (vitest)
│   ├── integration/
│   │   └── extension.test.ts   # Integration test (vscode-test-electron runner)
│   └── unit/                   # Unit tests (vitest, one file per source module)
│       ├── agent.commands.test.ts
│       ├── agent.service.test.ts
│       ├── agent-tree-items.test.ts
│       ├── agent-tree-provider.test.ts
│       ├── branch-validation.test.ts
│       ├── diff.commands.test.ts
│       ├── diff.service.test.ts
│       ├── git-content.provider.test.ts
│       ├── git.service.test.ts
│       ├── gitignore.test.ts
│       ├── repo-config.service.test.ts
│       ├── sidebar.commands.test.ts
│       ├── terminal.service.test.ts
│       ├── workspace-switch.service.test.ts
│       ├── worktree-parser.test.ts
│       ├── worktree.commands.test.ts
│       └── worktree.service.test.ts
├── dist/                       # Compiled output (esbuild bundle, not committed)
│   └── extension.js            # Single bundled CJS file (entrypoint for VS Code)
├── resources/
│   └── icon.svg                # Activity bar icon
├── .planning/                  # GSD planning documents (committed)
│   ├── codebase/               # This directory — codebase analysis docs
│   ├── phases/                 # Phase planning and execution docs
│   └── ...
├── .vscode/                    # Editor settings
├── package.json                # Extension manifest + npm scripts + devDependencies
├── tsconfig.json               # TypeScript config (module: Node16, target: ES2022, noEmit)
├── esbuild.js                  # Bundle script (entry: src/extension.ts → dist/extension.js)
├── biome.json                  # Linting and formatting config
└── vitest.config.ts            # Vitest unit test config
```

## Directory Purposes

**`src/commands/`:**
- Purpose: VS Code command handlers — owns all user-facing UI interaction (QuickPick, InputBox, confirmations, notifications)
- Contains: One file per command group, each exporting a `register*Commands(context, ...services)` function
- Key files: `src/commands/agent.commands.ts` (most complex — full agent lifecycle UI), `src/commands/sidebar.commands.ts` (tile click handlers)

**`src/models/`:**
- Purpose: Shared TypeScript types and constants — the vocabulary of the domain
- Contains: Interfaces, type aliases, Memento key string constants
- Key files: `src/models/agent.ts` (core domain object `AgentEntry`, `AgentStatus`)

**`src/providers/`:**
- Purpose: VS Code provider implementations for custom URI schemes
- Contains: `GitContentProvider` — serves `agentic-git://` URIs for VS Code's built-in diff editor
- Key files: `src/providers/git-content.provider.ts`

**`src/services/`:**
- Purpose: All business logic — no VS Code UI calls except `showMessage` for non-interactive notifications; no direct rendering
- Contains: Seven service classes, each injected with dependencies via constructor
- Key files: `src/services/agent.service.ts` (central orchestrator), `src/services/worktree.service.ts` (git worktree ops), `src/services/terminal.service.ts` (Claude CLI terminal management)

**`src/utils/`:**
- Purpose: Pure functions with no side effects on VS Code state — parsing and validation only
- Contains: Three utility modules, each exporting one or two functions
- Key files: `src/utils/worktree-parser.ts` (parses `git worktree list --porcelain` output)

**`src/views/`:**
- Purpose: Sidebar panel rendering — implements `vscode.TreeDataProvider` for the Agents activity bar view
- Contains: `AgentTreeProvider` (data provider with debounced refresh and TTL diff cache), `AgentTreeItem`/`RepoGroupItem` (tree item classes)
- Key files: `src/views/agent-tree-provider.ts` (primary view logic)

**`test/unit/`:**
- Purpose: Vitest unit tests — one test file mirrors each source file
- Contains: All unit tests; uses `test/__mocks__/vscode.ts` to mock the VS Code API
- Key files: `test/unit/agent.service.test.ts` (34KB, most comprehensive), `test/unit/terminal.service.test.ts` (17KB)

**`test/__mocks__/`:**
- Purpose: Manual mock for the `vscode` module, enabling unit tests to run outside VS Code
- Generated: No — hand-authored
- Committed: Yes

**`dist/`:**
- Purpose: esbuild output — single bundled CommonJS file loaded by VS Code
- Generated: Yes (by `npm run compile` or `npm run package`)
- Committed: No (in `.vscodeignore` / `.gitignore`)

## Key File Locations

**Entry Points:**
- `src/extension.ts`: Extension lifecycle (`activate`, `deactivate`) — all wiring happens here

**Configuration:**
- `package.json`: Extension manifest, `contributes.commands`, `contributes.views`, `contributes.configuration` settings schema, `contributes.menus` (context menu visibility rules)
- `tsconfig.json`: TypeScript compiler config
- `biome.json`: Linter/formatter config
- `vitest.config.ts`: Test runner config
- `esbuild.js`: Build script

**Core Logic:**
- `src/services/agent.service.ts`: Agent lifecycle (create, delete, focus, suspend, reconcile, orphan cleanup)
- `src/services/worktree.service.ts`: Git worktree management with per-repo mutex
- `src/services/terminal.service.ts`: Claude CLI terminal lifecycle and PID tracking
- `src/services/git.service.ts`: Raw git command execution

**Domain Models:**
- `src/models/agent.ts`: `AgentEntry`, `AgentStatus`, all agent-related Memento keys
- `src/models/worktree.ts`: `WorktreeEntry`, `WorktreeOnDisk`, worktree Memento keys
- `src/models/repo.ts`: `RepoConfig`, repo Memento key

**Testing:**
- `test/unit/`: Unit tests (vitest)
- `test/integration/`: Integration tests (vscode-test-electron)
- `test/__mocks__/vscode.ts`: VS Code API mock

## Naming Conventions

**Files:**
- Services: `<domain>.service.ts` (e.g., `agent.service.ts`, `worktree.service.ts`)
- Commands: `<domain>.commands.ts` (e.g., `agent.commands.ts`, `diff.commands.ts`)
- Models: `<domain>.ts` (e.g., `agent.ts`, `worktree.ts`)
- Views: `<domain>-<type>.ts` (e.g., `agent-tree-provider.ts`, `agent-tree-items.ts`)
- Providers: `<domain>-<type>.provider.ts` (e.g., `git-content.provider.ts`)
- Utils: `<domain-kebab>.ts` (e.g., `branch-validation.ts`, `worktree-parser.ts`)
- Tests: `<source-filename>.test.ts` mirroring source filename exactly

**Classes:**
- Services: `PascalCase` + `Service` suffix (e.g., `AgentService`, `WorktreeService`)
- Commands: no class; exported as `register*Commands` function
- Providers: `PascalCase` + `Provider` suffix (e.g., `GitContentProvider`, `AgentTreeProvider`)
- Models: `PascalCase` interface names (e.g., `AgentEntry`, `WorktreeEntry`)
- Error classes: `PascalCase` + `Error` suffix (e.g., `AgentLimitError`, `WorktreeLimitError`, `GitError`)

**VS Code command IDs:**
- Pattern: `vscode-agentic.<camelCaseAction>` (e.g., `vscode-agentic.createAgent`, `vscode-agentic.focusAgentFromTile`)

**Memento keys:**
- Pattern: `vscode-agentic.<camelCaseKey>` (e.g., `vscode-agentic.agentRegistry`, `vscode-agentic.pidRegistry`)
- Defined as exported constants in model files

**Compound keys (in-memory):**
- Pattern: `${repoPath}::${agentName}` — used as Map keys in `TerminalService` and as the last-focused key stored in Memento

## Where to Add New Code

**New VS Code Command:**
1. Add command to `package.json` `contributes.commands` (and `contributes.menus` if context menu)
2. Implement handler in the appropriate `src/commands/<domain>.commands.ts` file (or create a new `<domain>.commands.ts`)
3. Register in the corresponding `register*Commands` call in `src/extension.ts`
4. Add unit test to `test/unit/<domain>.commands.test.ts`

**New Service:**
1. Create `src/services/<domain>.service.ts`
2. Accept dependencies via constructor injection
3. Instantiate singleton in `src/extension.ts` `activate()`, passing to command registrars as needed
4. Add to `context.subscriptions` if it needs `dispose()`
5. Add unit test to `test/unit/<domain>.service.test.ts`

**New Domain Model / Type:**
- Add to `src/models/<domain>.ts` (or create new file)
- Export interface and any associated Memento key constants from same file

**New Utility Function:**
- Add to `src/utils/<domain>.ts` (or create new file)
- Keep pure: no side effects, no VS Code API calls, no service dependencies
- Add unit test to `test/unit/<domain>.test.ts`

**New TreeItem Type (sidebar):**
- Add class extending `vscode.TreeItem` in `src/views/agent-tree-items.ts`
- Update `AgentTreeProvider.getChildren()` in `src/views/agent-tree-provider.ts` to return new type
- Add `contextValue` for menu visibility rules, update `package.json` menus if needed

**New VS Code Setting:**
- Add to `package.json` `contributes.configuration.properties`
- Read in the relevant service via `vscode.workspace.getConfiguration("vscode-agentic").get<T>("settingName", default)` — do not cache the value

## Special Directories

**`.planning/`:**
- Purpose: GSD planning and execution documents (PROJECT.md, ROADMAP.md, STATE.md, phase plans, codebase analysis)
- Generated: No — human/AI authored
- Committed: Yes

**`dist/`:**
- Purpose: esbuild output bundle (`dist/extension.js`) loaded by VS Code at runtime
- Generated: Yes — by `npm run compile` / `npm run package`
- Committed: No (listed in `.vscodeignore`)

**`.worktrees/` (in managed repos, not this repo):**
- Purpose: Git worktrees for each agent, created at `<repoPath>/.worktrees/<agentName>/`
- Generated: Yes — by `WorktreeService.addWorktree`
- Committed: No — automatically added to `.gitignore` of managed repo when it is configured

---

*Structure analysis: 2026-03-04*
