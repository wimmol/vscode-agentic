# Coding Conventions

**Analysis Date:** 2026-03-04

## Naming Patterns

**Files:**
- Services: `kebab-case.service.ts` — e.g., `agent.service.ts`, `git.service.ts`
- Commands: `kebab-case.commands.ts` — e.g., `agent.commands.ts`, `diff.commands.ts`
- Models: `kebab-case.ts` — e.g., `agent.ts`, `repo.ts`, `worktree.ts`
- Utils: `kebab-case.ts` — e.g., `branch-validation.ts`, `worktree-parser.ts`
- Views: `kebab-case.ts` — e.g., `agent-tree-provider.ts`, `agent-tree-items.ts`
- Tests: mirror source path with `.test.ts` suffix — `test/unit/agent.service.test.ts`

**Classes:**
- PascalCase — `AgentService`, `GitService`, `WorktreeService`, `AgentTreeProvider`
- Custom errors are PascalCase extending `Error` — `GitError`, `AgentLimitError`, `WorktreeLimitError`

**Functions:**
- camelCase — `isValidBranchName`, `parseWorktreeList`, `getStatusIcon`
- Command registration functions prefixed with `register` — `registerAgentCommands`, `registerDiffCommands`

**Variables and Parameters:**
- camelCase — `agentName`, `repoPath`, `worktreeEntry`
- Private class fields use `_` prefix for event emitters only — `_onDidChangeAgents`, `_onDidChangeTreeData`
- Private readonly fields use `readonly` keyword, no underscore prefix — `private readonly git`

**Types and Interfaces:**
- PascalCase — `AgentEntry`, `AgentStatus`, `RepoConfig`, `WorktreeEntry`
- Union type aliases for status enums — `type AgentStatus = "created" | "running" | "finished" | "error" | "suspended"`
- Interfaces prefixed with nothing (no `I` prefix) — `AgentEntry`, `RepoConfig`
- QuickPick item interfaces suffixed with `PickItem` — `AgentPickItem`, `RepoPickItem`

**Constants:**
- SCREAMING_SNAKE_CASE for Memento keys — `AGENT_REGISTRY_KEY`, `PID_REGISTRY_KEY`, `WORKTREE_MANIFEST_KEY`
- camelCase for non-exported module-level constants — `const STATUS_PRIORITY`
- Numeric literals use underscore separators — `30_000`, `10_000`, `10 * 1024 * 1024`

## Code Style

**Formatting:**
- Tool: Biome v2.4.5
- Indent: tabs (not spaces)
- Line width: 100 characters
- Config: `biome.json`

**Linting:**
- Tool: Biome (`biome check .`)
- Recommended ruleset enabled
- `noExplicitAny` is warn-only (not error)
- Fix command: `biome check --write .`
- Format command: `biome format --write .`

**TypeScript:**
- Strict mode enabled (`"strict": true`)
- Target ES2022, module Node16
- `esModuleInterop: true`, `skipLibCheck: true`
- No `any` in new code — use `unknown` and narrow, or typed generics
- Use `type` imports for type-only imports: `import type { AgentEntry } from "../models/agent.js"`
- Always use `.js` extension in relative imports (Node16 module resolution requirement)

## Import Organization

Biome `organizeImports` is enabled. Order enforced automatically:

1. Node built-ins (`node:path`, `node:child_process`, `node:util`)
2. External packages (`vscode`)
3. Internal relative imports (models, services, utils, views)

**Path Aliases:**
- None — all imports use relative paths
- `.js` extension required on all relative imports (`./agent.service.js`)

**Example:**
```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";
import type { AgentEntry } from "../models/agent.js";
import { AGENT_REGISTRY_KEY } from "../models/agent.js";
import type { WorktreeService } from "./worktree.service.js";
```

## Error Handling

**Custom Error Classes:**
- Extend `Error` with `this.name = "ClassName"` pattern
- Add typed readonly properties for structured error data
- Used for expected domain errors that callers must handle

```typescript
export class AgentLimitError extends Error {
    constructor(
        public readonly repoPath: string,
        public readonly limit: number,
        public readonly limitType: "per-repo" | "global",
        public readonly existingAgents: AgentEntry[],
    ) {
        super(`${scope} reached. Suspend or delete an agent to make room.`);
        this.name = "AgentLimitError";
    }
}
```

**Graceful Degradation:**
- Operations that call git or external processes catch errors and return safe defaults (`false`, `[]`, `undefined`)
- `try/catch` with empty catch blocks are used to swallow expected failures (worktree already removed, branch already gone)

```typescript
// Pattern: try/catch with empty body for expected failures
try {
    await this.git.exec(repoPath, ["worktree", "remove", "--force", entry.path]);
} catch {
    // Worktree already gone from disk -- that's fine
}
```

**Typed Error Casting:**
- `unknown` is the default catch type; cast with `as { stderr?: string; code?: number }` to access properties
- `instanceof` checks for typed error handling in command handlers

```typescript
} catch (err) {
    if (err instanceof AgentLimitError) {
        const handled = await handleAgentLimitError(err, agentService);
    } else {
        throw err; // re-throw unexpected errors
    }
}
```

## Logging

**Framework:** None — uses `vscode.window.show*Message` for user-facing notifications

**Patterns:**
- `vscode.window.showErrorMessage()` — hard errors (git not found, reconciliation failure)
- `vscode.window.showWarningMessage()` — soft warnings (agent limit, unmerged changes)
- `vscode.window.showInformationMessage()` — success confirmations (agent created/deleted)
- No `console.log` in production code

## Comments

**When to Comment:**
- JSDoc on all public class methods — explains purpose, preconditions, and special behavior
- Inline comments for non-obvious logic (mutex patterns, circular dependency resolution)
- Section dividers with `// ---` before each command registration block

**JSDoc Pattern:**
```typescript
/**
 * Creates a new agent: creates a git worktree+branch, persists the agent entry.
 * Does NOT create a terminal -- that happens lazily on focusAgent.
 * Checks per-repo and global agent limits before proceeding.
 */
async createAgent(repoPath: string, agentName: string, initialPrompt?: string): Promise<AgentEntry>
```

**Inline comment style:**
```typescript
// Step 1: Worktree reconciliation per repo (removes disk/manifest orphans)
// AgentService and TerminalService have a circular dependency:
// - TerminalService needs a status change callback that calls agentService.updateStatus
// - AgentService needs TerminalService for focusAgent/deleteAgent
// Resolved via setTerminalService() setter after both are constructed.
```

## Function Design

**Size:** Functions are focused and single-purpose. Command handler functions can be longer (50-100 lines) as they manage a full user interaction flow.

**Parameters:** Consistently ordered as `(repoPath, agentName, ...rest)` for all methods dealing with agents.

**Return Values:**
- Async operations return `Promise<T>` with explicit return types
- Void operations return `Promise<void>` explicitly
- Query methods return typed values or `undefined` (never null, except parsed git output)

**Optional Parameters:**
- Trailing optional params use `?` — `initialPrompt?: string`, `startPoint?: string`
- Internal-only params use leading `_` underscore prefix: `_terminalService: TerminalService`

## Module Design

**Exports:**
- Named exports only — no default exports in source files
- Models export interfaces, type aliases, and constants
- Services export the class and any associated error classes
- Commands export a single `register*Commands` function

**Class Structure Pattern:**
1. Static/class-level constants at top
2. Private fields (EventEmitters, caches)
3. `constructor` with dependency injection
4. Public methods (lifecycle operations)
5. Private helper methods at bottom prefixed `private`

**Barrel Files:**
- Not used — direct imports only

**Dependency Injection:**
- All services receive dependencies via constructor parameters typed as `readonly`
- Circular dependencies broken via post-construction setter (`setTerminalService`)
- VS Code APIs (`vscode.Memento`, `vscode.ExtensionContext`) injected — not imported directly

---

*Convention analysis: 2026-03-04*
