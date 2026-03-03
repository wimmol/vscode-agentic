# Phase 1: Extension Foundation and Git Infrastructure - Research

**Researched:** 2026-03-04
**Domain:** VS Code Extension Development + Git Worktree Management
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield scaffold of a VS Code extension with three core capabilities: (1) adding/configuring repositories with a staging branch name, (2) async git worktree management with hard limits, and (3) manifest-based worktree tracking with reconciliation on activation. The extension has zero production dependencies -- everything needed (child_process, vscode API, fs) is available at runtime. The build toolchain is TypeScript + esbuild, which is Microsoft's officially recommended bundler for VS Code extensions.

The git worktree subsystem is the most architecturally significant piece. It wraps `child_process.execFile` in a promisified async layer and must handle real failure modes: "branch already checked out" errors, orphaned worktrees (directory exists but no manifest entry, or manifest entry but no directory), and the one-branch-per-worktree invariant enforced by git. The worktree manifest lives in VS Code's Memento API (workspaceState), not on disk, keeping the user's repo clean.

**Primary recommendation:** Use `npm` (not pnpm) for zero-friction `vsce` compatibility, Biome for linting/formatting (single tool, 25x faster, new project with no migration cost), and Vitest for unit tests with `@vscode/test-cli` reserved for integration tests in later phases. Structure the extension as a service-layer architecture where `GitService`, `WorktreeService`, and `RepoConfigService` are singletons created in `activate()` and passed by reference -- no DI framework needed at this scale.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auto-detect VS Code workspace folders as available repos AND allow manual "Add Repo" for external repos (both modes)
- When repo is added, prompt user immediately for staging branch name (default: "staging")
- If a branch named "staging" (or the configured name) already exists, ask user to confirm: use existing or pick a different name
- Store repo config (staging branch name, worktree limit) in VS Code's Memento API (extension state) -- invisible to user, no file clutter
- Default max worktrees per repo: configurable, default 5
- When limit reached: suggest cleanup -- show which agents are finished/idle and offer to delete one to make room
- On activation, if orphaned worktrees found: notify user what was found, then auto-clean up
- Worktrees created in a sibling folder: `/path/to/repo/.worktrees/agent-name/`
- Auto-add `.worktrees/` to `.gitignore` silently so worktrees aren't committed
- Testing: Vitest for unit tests + @vscode/test-cli for integration tests (research recommended split)
- Minimal test setup in Phase 1 -- framework configured but extensive tests come in later phases

### Claude's Discretion
- Package manager choice (npm vs pnpm)
- Linting/formatting tooling choice (ESLint+Prettier vs Biome)
- Exact project structure and folder layout
- esbuild configuration details
- TypeScript strict mode settings
- Activation event strategy

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GIT-01 | When a repo is first added, user configures a staging branch name (default: "staging") | Memento API (workspaceState) for config persistence; InputBox API for user prompt; branch existence check via `git branch --list` |
| GIT-02 | Each agent works in its own git worktree, isolated from other agents and the main working directory | `git worktree add -b <branch> <path>` creates isolated worktrees; promisified `child_process.execFile` for async operations |
| GIT-05 | Worktree creation is capped with hard limits per repo to prevent disk explosion | Manifest count check before `git worktree add`; configurable limit stored in workspaceState; error message via `vscode.window.showWarningMessage` |
| GIT-06 | Extension tracks worktrees in a manifest and reconciles against actual state on activation | Manifest in workspaceState; `git worktree list --porcelain` for disk state; diff algorithm to find orphans in both directions |
| PERF-04 | All git operations are async -- no synchronous calls that block the VS Code UI | `util.promisify(child_process.execFile)` wraps all git calls; never use `execFileSync` |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@types/vscode` | `^1.96.0` | VS Code API type definitions | Match minimum engine version; do NOT use latest (1.109.0) to maximize compatibility |
| `typescript` | `~5.8.0` | Type checking and compilation | Stable release; 5.9 is too bleeding-edge for project start |
| `esbuild` | `^0.27.0` | Bundling extension to single file | Microsoft-recommended bundler for VS Code extensions |
| `@vscode/vsce` | `^3.7.0` | Packaging and publishing | Official VS Code extension packaging tool |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@biomejs/biome` | `^2.4.0` | Linting + formatting (single tool) | Every file save; replaces ESLint+Prettier |
| `vitest` | `^4.0.0` | Unit test framework | Testing non-VS Code logic (services, utilities) |
| `@vscode/test-cli` | `^0.0.12` | Integration test runner | Testing code that requires VS Code runtime (Phase 1: config only) |
| `@vscode/test-electron` | `^2.5.0` | VS Code test environment | Required by @vscode/test-cli |
| `npm-run-all2` | `^8.0.0` | Parallel script runner | Running esbuild watch + tsc watch simultaneously |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| npm | pnpm | pnpm is faster but requires `--no-dependencies` workaround with vsce; npm works out of the box |
| Biome | ESLint + Prettier | ESLint+Prettier has deeper plugin ecosystem but requires 3+ config files and 127+ npm packages; Biome is a single binary with 97% Prettier compatibility |
| Vitest | Jest | Jest works fine but Vitest is faster, has native TS support, and better ESM handling |
| Vitest | Mocha | @vscode/test-cli uses Mocha internally for integration tests; Vitest is better for pure unit tests |

**Installation:**
```bash
# Initialize
npm init -y

# Production dependencies: NONE (zero runtime deps)

# Dev dependencies
npm install --save-dev @types/vscode@1.96.0 typescript@~5.8.0 esbuild@^0.27.0
npm install --save-dev @biomejs/biome@^2.4.0
npm install --save-dev vitest@^4.0.0
npm install --save-dev @vscode/test-cli@^0.0.12 @vscode/test-electron@^2.5.0
npm install --save-dev @vscode/vsce@^3.7.0 npm-run-all2@^8.0.0
```

## Architecture Patterns

### Recommended Project Structure
```
vscode-agentic/
├── .vscode/
│   ├── launch.json          # Extension debug + test debug configs
│   ├── tasks.json           # Build tasks with esbuild problem matcher
│   └── settings.json        # Biome as default formatter
├── src/
│   ├── extension.ts         # activate() and deactivate() entry point
│   ├── services/
│   │   ├── git.service.ts       # Low-level async git command execution
│   │   ├── worktree.service.ts  # Worktree CRUD, limit enforcement, reconciliation
│   │   └── repo-config.service.ts  # Repo registration, staging branch config
│   ├── models/
│   │   ├── repo.ts              # RepoConfig interface (path, stagingBranch, worktreeLimit)
│   │   └── worktree.ts          # WorktreeEntry interface (path, branch, agentName, createdAt)
│   ├── commands/
│   │   └── repo.commands.ts     # "Add Repo", "Configure Staging Branch" command handlers
│   └── utils/
│       └── gitignore.ts         # .gitignore entry management
├── test/
│   ├── unit/
│   │   ├── git.service.test.ts
│   │   ├── worktree.service.test.ts
│   │   └── repo-config.service.test.ts
│   ├── integration/
│   │   └── .vscode-test.mjs     # Integration test config (Phase 1: minimal)
│   └── __mocks__/
│       └── vscode.ts            # Manual mock of the vscode module for Vitest
├── dist/                    # esbuild output (gitignored)
├── .vscodeignore            # Exclude src/, test/, node_modules/ from VSIX
├── biome.json               # Biome config
├── esbuild.js               # Build script
├── package.json             # Extension manifest + scripts
├── tsconfig.json            # TypeScript config
└── vitest.config.ts         # Vitest config
```

### Pattern 1: Service-Layer Architecture
**What:** All business logic lives in service classes. `activate()` creates service singletons and wires them together. Commands are thin handlers that call services.
**When to use:** Always -- this is the foundational pattern for the entire extension.
**Example:**
```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { GitService } from './services/git.service';
import { WorktreeService } from './services/worktree.service';
import { RepoConfigService } from './services/repo-config.service';

export function activate(context: vscode.ExtensionContext): void {
  const gitService = new GitService();
  const worktreeService = new WorktreeService(gitService, context.workspaceState);
  const repoConfigService = new RepoConfigService(context.workspaceState, worktreeService);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agentic.addRepo', () =>
      repoConfigService.addRepo()
    )
  );

  // Reconcile worktrees on activation
  worktreeService.reconcileAll().catch(err =>
    vscode.window.showErrorMessage(`Worktree reconciliation failed: ${err.message}`)
  );
}

export function deactivate(): void {
  // Cleanup if needed
}
```

### Pattern 2: Async Git Command Wrapper
**What:** A thin async wrapper around `child_process.execFile` that handles git commands, error parsing, and timeout.
**When to use:** Every git operation in the extension.
**Example:**
```typescript
// src/services/git.service.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitService {
  private readonly timeout = 30_000; // 30s timeout for git operations

  async exec(repoPath: string, args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: repoPath,
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB for large outputs
      });
      return stdout.trim();
    } catch (error: unknown) {
      const err = error as { stderr?: string; code?: number; message: string };
      throw new GitError(
        `git ${args[0]} failed: ${err.stderr?.trim() || err.message}`,
        args,
        err.code
      );
    }
  }

  async branchExists(repoPath: string, branchName: string): Promise<boolean> {
    try {
      await this.exec(repoPath, ['rev-parse', '--verify', `refs/heads/${branchName}`]);
      return true;
    } catch {
      return false;
    }
  }
}

export class GitError extends Error {
  constructor(
    message: string,
    public readonly args: string[],
    public readonly exitCode?: number
  ) {
    super(message);
    this.name = 'GitError';
  }
}
```

### Pattern 3: Worktree Manifest with Reconciliation
**What:** A manifest (array of WorktreeEntry objects) stored in workspaceState, reconciled against `git worktree list --porcelain` on activation.
**When to use:** Extension activation and after any worktree CRUD operation.
**Example:**
```typescript
// src/services/worktree.service.ts
interface WorktreeEntry {
  path: string;           // absolute path to worktree directory
  branch: string;         // branch name (without refs/heads/)
  agentName: string;      // display name
  repoPath: string;       // parent repo path
  createdAt: string;      // ISO timestamp
}

interface WorktreeOnDisk {
  path: string;
  head: string;
  branch: string | null;  // null if detached HEAD
  locked: boolean;
  prunable: boolean;
}

// Parse `git worktree list --porcelain` output
function parseWorktreeList(output: string): WorktreeOnDisk[] {
  const entries: WorktreeOnDisk[] = [];
  const blocks = output.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n');
    const entry: Partial<WorktreeOnDisk> = { locked: false, prunable: false };

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        entry.path = line.slice('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        entry.head = line.slice('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        entry.branch = line.slice('branch '.length).replace('refs/heads/', '');
      } else if (line === 'detached') {
        entry.branch = null;
      } else if (line.startsWith('locked')) {
        entry.locked = true;
      } else if (line.startsWith('prunable')) {
        entry.prunable = true;
      }
    }

    if (entry.path) {
      entries.push(entry as WorktreeOnDisk);
    }
  }

  return entries;
}
```

### Pattern 4: Memento-Based Config Storage
**What:** Repo configs stored in VS Code's workspaceState using typed get/update wrappers.
**When to use:** All persistent extension state.
**Example:**
```typescript
// src/services/repo-config.service.ts
interface RepoConfig {
  path: string;
  stagingBranch: string;
  worktreeLimit: number;
}

const REPO_CONFIGS_KEY = 'vscode-agentic.repoConfigs';

class RepoConfigService {
  constructor(private readonly state: vscode.Memento) {}

  getAll(): RepoConfig[] {
    return this.state.get<RepoConfig[]>(REPO_CONFIGS_KEY, []);
  }

  async save(configs: RepoConfig[]): Promise<void> {
    await this.state.update(REPO_CONFIGS_KEY, configs);
  }

  getForRepo(repoPath: string): RepoConfig | undefined {
    return this.getAll().find(c => c.path === repoPath);
  }
}
```

### Anti-Patterns to Avoid
- **Synchronous git calls:** Never use `execFileSync` or `spawnSync`. Every git operation must be async. A single synchronous git call on a large repo can freeze VS Code for seconds.
- **Storing config in files:** Do not write JSON/YAML config files to the user's repo. Use Memento API. The user's repo should only get `.worktrees/` added to `.gitignore`.
- **Global singleton module pattern:** Do not use `export const service = new MyService()` at module level. Services need `ExtensionContext` which is only available in `activate()`. Create instances in `activate()` and pass them down.
- **Catching and swallowing errors:** Git operations fail for real reasons. Catch, wrap in a meaningful message, and show to the user via `vscode.window.showErrorMessage`.
- **Using `*` activation event:** This loads the extension on every VS Code startup. Use `onView:` or `onCommand:` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git command execution | Custom spawn/exec wrapper with streaming | `promisify(execFile)` with error handling | execFile is simpler than spawn for command-response patterns; handles buffer, timeout, and error codes natively |
| Worktree list parsing | Regex-based stdout parsing | `git worktree list --porcelain` + line-based parser | Porcelain format is stable across git versions; human-readable format is not |
| .gitignore manipulation | Full .gitignore parser/writer | Read file, check if entry exists, append if not | Simple append with existence check covers 99% of cases; no need for comment-aware parsing |
| Config persistence | JSON files on disk | VS Code Memento API (workspaceState) | Survives workspace reloads, no file clutter, no merge conflicts, backed by SQLite |
| User input collection | Custom webview forms | `vscode.window.showInputBox` + `showQuickPick` | Native VS Code UX, zero UI code needed for Phase 1 |
| File existence checks | Custom fs utilities | `vscode.workspace.fs.stat` for remote compat, `fs.promises.access` for local | VS Code's fs API works across local and remote; falls back to Node fs for local-only ops |

**Key insight:** VS Code's extension API is rich enough that Phase 1 needs zero production dependencies. The only npm packages are dev tooling (TypeScript, esbuild, Biome, Vitest). This drastically reduces bundle size and attack surface.

## Common Pitfalls

### Pitfall 1: Branch Already Checked Out
**What goes wrong:** `git worktree add` fails with "fatal: 'branch-name' is already checked out at '/path/to/other/worktree'" when trying to create a worktree for a branch that is already active in another worktree.
**Why it happens:** Git enforces a one-branch-per-worktree invariant to prevent data corruption from concurrent edits.
**How to avoid:** Always create worktrees with a new branch: `git worktree add -b <new-branch> <path> <start-point>`. Never try to check out an existing branch into a new worktree unless you know it's not checked out elsewhere.
**Warning signs:** GitError with "already checked out" in stderr.

### Pitfall 2: Orphaned Worktrees After Crash
**What goes wrong:** If VS Code crashes or the extension is force-killed, worktrees may exist on disk but not in the manifest (or vice versa).
**Why it happens:** The manifest update (workspaceState) and the git operation are not atomic. The git operation succeeds but the manifest write never completes.
**How to avoid:** Two-phase reconciliation on activation: (1) diff manifest against `git worktree list --porcelain`, (2) for entries in manifest but not on disk, remove from manifest; (3) for entries on disk but not in manifest, either adopt or remove with user notification.
**Warning signs:** Agent tiles showing for worktrees that don't exist; worktrees on disk that no agent owns.

### Pitfall 3: Blocking the Extension Host
**What goes wrong:** A synchronous git operation on a large repo (100k+ files) freezes the entire VS Code UI for 3-10 seconds.
**Why it happens:** VS Code extensions run on a single extension host thread. Synchronous I/O blocks that thread.
**How to avoid:** Use only async git operations (`promisify(execFile)`). Set reasonable timeouts (30s). For operations that might be slow, show a progress notification via `vscode.window.withProgress`.
**Warning signs:** VS Code "Extension Host unresponsive" dialog.

### Pitfall 4: .worktrees Inside Repo Getting Committed
**What goes wrong:** The `.worktrees/` directory (containing full repo checkouts) gets committed to git, massively bloating the repo.
**Why it happens:** Developer forgets to add `.worktrees/` to `.gitignore` before the first worktree is created.
**How to avoid:** The extension MUST check for and add `.worktrees/` to `.gitignore` BEFORE creating the first worktree. Check if the entry already exists to avoid duplicates.
**Warning signs:** `git status` showing thousands of untracked files under `.worktrees/`.

### Pitfall 5: workspaceState vs globalState Confusion
**What goes wrong:** Repo configs stored in globalState are shared across all workspaces, causing one workspace's config to appear in another.
**Why it happens:** Mixing up workspaceState (per-workspace) and globalState (per-extension, all workspaces).
**How to avoid:** Use `workspaceState` for per-workspace data (repo configs, worktree manifest). Use `globalState` only for data that should persist across all workspaces (user preferences, first-run flags).
**Warning signs:** Repo configs appearing for repos that aren't in the current workspace.

### Pitfall 6: Missing Error Handling for git Not Installed
**What goes wrong:** Extension silently fails or crashes if git is not installed or not in PATH.
**Why it happens:** Assumes git is always available.
**How to avoid:** On activation, run `git --version` as a health check. If it fails, show a clear error message and disable worktree-related features.
**Warning signs:** Cryptic ENOENT errors in the extension host log.

### Pitfall 7: Race Conditions in Concurrent Worktree Operations
**What goes wrong:** Two concurrent `addWorktree` calls both pass the limit check, then both create worktrees, exceeding the limit.
**Why it happens:** Async operations create a time-of-check-time-of-use (TOCTOU) gap between reading the count and creating the worktree.
**How to avoid:** Use a per-repo mutex/semaphore for worktree operations. A simple queue (array of promises) is sufficient -- no need for a full concurrency library.
**Warning signs:** Worktree count exceeding the configured limit.

## Code Examples

### esbuild Configuration
```javascript
// esbuild.js
// Source: https://code.visualstudio.com/api/working-with-extensions/bundling-extension
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`> ${location.file}:${location.line}:${location.column}: error: ${text}`);
      }
      console.log('[watch] build finished');
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### package.json (Extension Manifest)
```json
{
  "name": "vscode-agentic",
  "displayName": "VS Code Agentic",
  "description": "Multi-repo, multi-agent workspace manager for Claude Code",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.96.0"
  },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "vscode-agentic.addRepo",
        "title": "Add Repository",
        "category": "Agentic"
      }
    ],
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
          "id": "vscode-agentic.agents",
          "name": "Agents"
        }
      ]
    }
  },
  "scripts": {
    "compile": "npm run check-types && node esbuild.js",
    "check-types": "tsc --noEmit",
    "watch": "npm-run-all -p watch:*",
    "watch:esbuild": "node esbuild.js --watch",
    "watch:tsc": "tsc --noEmit --watch --project tsconfig.json",
    "package": "npm run check-types && node esbuild.js --production",
    "vscode:prepublish": "npm run package",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vscode-test",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### biome.json
```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.5/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "files": {
    "ignore": ["dist", "node_modules", ".worktrees"]
  }
}
```

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    globals: true,
    environment: 'node',
    alias: {
      // Resolve the virtual 'vscode' module to our manual mock
      vscode: new URL('./test/__mocks__/vscode.ts', import.meta.url).pathname,
    },
  },
});
```

### .gitignore Entry Management
```typescript
// src/utils/gitignore.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const WORKTREE_DIR_ENTRY = '.worktrees/';

export async function ensureGitignoreEntry(repoPath: string): Promise<void> {
  const gitignorePath = path.join(repoPath, '.gitignore');

  let content = '';
  try {
    content = await fs.readFile(gitignorePath, 'utf-8');
  } catch {
    // File doesn't exist, will create it
  }

  // Check if entry already exists (with or without trailing newline variations)
  const lines = content.split('\n');
  if (lines.some(line => line.trim() === WORKTREE_DIR_ENTRY || line.trim() === '.worktrees')) {
    return; // Already present
  }

  // Append with proper newline handling
  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  const addition = `${separator}# VS Code Agentic worktrees\n${WORKTREE_DIR_ENTRY}\n`;
  await fs.appendFile(gitignorePath, addition, 'utf-8');
}
```

### Worktree Reconciliation
```typescript
// Reconciliation logic (inside WorktreeService)
async reconcile(repoPath: string): Promise<ReconciliationResult> {
  const manifest = this.getManifestForRepo(repoPath);
  const onDisk = await this.listWorktreesOnDisk(repoPath);

  const result: ReconciliationResult = {
    orphanedInManifest: [], // in manifest but not on disk
    orphanedOnDisk: [],     // on disk but not in manifest
    healthy: [],            // present in both
  };

  const diskPaths = new Set(onDisk.map(w => w.path));
  const manifestPaths = new Set(manifest.map(w => w.path));

  for (const entry of manifest) {
    if (!diskPaths.has(entry.path)) {
      result.orphanedInManifest.push(entry);
    } else {
      result.healthy.push(entry);
    }
  }

  // Skip the main worktree (first entry from git worktree list)
  for (const entry of onDisk.slice(1)) {
    if (!manifestPaths.has(entry.path) && entry.path.includes('.worktrees')) {
      result.orphanedOnDisk.push(entry);
    }
  }

  return result;
}
```

### Activation Event Strategy
```json
// In package.json contributes section
// Since VS Code 1.74+, views auto-register activation events.
// The extension activates when the sidebar view is first expanded.
// No explicit activationEvents needed for view-based activation.
"activationEvents": []
```

Note: With VS Code 1.74+, contributed views automatically trigger activation without explicit `onView:` entries in `activationEvents`. Contributed commands also auto-register `onCommand:` events. An empty `activationEvents` array is correct -- VS Code infers the events from `contributes`.

## Validation Architecture

This section defines how to test and validate every Phase 1 success criterion. The strategy splits into two tiers: **Vitest unit tests** (fast, no VS Code runtime, mock everything) and **@vscode/test-cli integration tests** (slow, real VS Code runtime, minimal in Phase 1).

### Test Framework

| Property | Value |
|----------|-------|
| Unit Framework | Vitest ^4.0.0 |
| Integration Framework | @vscode/test-cli ^0.0.12 (Mocha under the hood) |
| Config files | `vitest.config.ts` (unit), `.vscode-test.mjs` (integration) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test && npm run test:integration` |

### Mocking Strategy: VS Code API

The `vscode` module is virtual -- it only exists inside the VS Code extension host runtime. For Vitest unit tests, it must be mocked. Use the **alias approach** in `vitest.config.ts` to resolve `vscode` to a manual mock file.

**vitest.config.ts alias** (shown above in Code Examples) resolves `import * as vscode from 'vscode'` to `test/__mocks__/vscode.ts`.

**Manual mock file:**
```typescript
// test/__mocks__/vscode.ts
// Minimal mock of VS Code API surfaces used by Phase 1 services
import { vi } from 'vitest';

// Memento mock -- the core persistence API used by services
export function createMockMemento(): any {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      return store.has(key) ? store.get(key) : defaultValue;
    }),
    update: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    keys: vi.fn(() => [...store.keys()]),
    // Expose store for test assertions
    _store: store,
  };
}

// Window API mocks
export const window = {
  showInputBox: vi.fn(),
  showQuickPick: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  withProgress: vi.fn((_options: unknown, task: (progress: unknown) => Promise<unknown>) => {
    return task({ report: vi.fn() });
  }),
};

// Workspace API mocks
export const workspace = {
  workspaceFolders: undefined as unknown[] | undefined,
  getConfiguration: vi.fn(() => ({
    get: vi.fn(),
    update: vi.fn(),
  })),
  fs: {
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
};

// Commands API mock
export const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
};

// URI mock
export const Uri = {
  file: vi.fn((path: string) => ({ fsPath: path, scheme: 'file' })),
  parse: vi.fn((str: string) => ({ fsPath: str, scheme: 'file' })),
};

// ProgressLocation enum mock
export const ProgressLocation = {
  Notification: 15,
  SourceControl: 1,
  Window: 10,
};
```

**Why this approach over `vi.mock('vscode')`:** Vitest needs to resolve the module at import time. Since `vscode` is not an installable package, using `vi.mock('vscode')` alone causes a resolution error. The alias approach in `vitest.config.ts` redirects the import to a real file on disk, avoiding the issue entirely. This is the pattern recommended in the [Vitest issue #993](https://github.com/vitest-dev/vitest/issues/993) discussion and in the [official Vitest mocking modules docs](https://vitest.dev/guide/mocking/modules).

### Mocking Strategy: child_process (Git Commands)

The `GitService` wraps `promisify(execFile)`. For unit tests, mock `node:child_process` at the module level using `vi.mock`:

```typescript
// test/unit/git.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the child_process module BEFORE importing GitService
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { GitService, GitError } from '../../src/services/git.service';

// Helper to make the mocked execFile resolve/reject
function mockExecFileResult(stdout: string, stderr = '') {
  vi.mocked(execFile).mockImplementation(
    (_cmd: string, _args: unknown, _opts: unknown, callback: Function) => {
      callback(null, stdout, stderr);
      return {} as any; // ChildProcess return value (unused by promisify)
    }
  );
}

function mockExecFileError(stderr: string, code = 1) {
  vi.mocked(execFile).mockImplementation(
    (_cmd: string, _args: unknown, _opts: unknown, callback: Function) => {
      const err = Object.assign(new Error(stderr), { stderr, code });
      callback(err, '', stderr);
      return {} as any;
    }
  );
}

describe('GitService', () => {
  let gitService: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    gitService = new GitService();
  });

  it('executes git commands and returns trimmed stdout', async () => {
    mockExecFileResult('  abc123  \n');
    const result = await gitService.exec('/repo', ['rev-parse', 'HEAD']);
    expect(result).toBe('abc123');
    expect(execFile).toHaveBeenCalledWith(
      'git',
      ['rev-parse', 'HEAD'],
      expect.objectContaining({ cwd: '/repo' }),
      expect.any(Function)
    );
  });

  it('throws GitError with stderr on failure', async () => {
    mockExecFileError("fatal: not a git repository");
    await expect(gitService.exec('/repo', ['status']))
      .rejects.toThrow(GitError);
  });

  it('branchExists returns true for existing branch', async () => {
    mockExecFileResult('abc123');
    expect(await gitService.branchExists('/repo', 'main')).toBe(true);
  });

  it('branchExists returns false for non-existing branch', async () => {
    mockExecFileError("fatal: Needed a single revision");
    expect(await gitService.branchExists('/repo', 'nonexistent')).toBe(false);
  });
});
```

**Key pattern:** Vitest hoists `vi.mock()` calls above all imports regardless of where they appear in the file. The mock replaces the `execFile` export with a `vi.fn()`. Since `promisify(execFile)` wraps the callback-style function, the mock must implement the callback signature `(cmd, args, opts, callback) => ...` to make the promisified version resolve or reject.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Needed |
|--------|----------|-----------|-------------------|-------------|
| GIT-01 | User adds repo, configures staging branch name (default "staging") | unit | `npx vitest run test/unit/repo-config.service.test.ts` | `test/unit/repo-config.service.test.ts` |
| GIT-01 | Prompt user when staging branch already exists | unit | `npx vitest run test/unit/repo-config.service.test.ts` | (same file) |
| GIT-02 | Worktree created with isolated branch via `git worktree add` | unit | `npx vitest run test/unit/worktree.service.test.ts` | `test/unit/worktree.service.test.ts` |
| GIT-02 | Worktree path follows `.worktrees/<agent-name>/` convention | unit | `npx vitest run test/unit/worktree.service.test.ts` | (same file) |
| GIT-05 | Worktree creation refused when limit reached | unit | `npx vitest run test/unit/worktree.service.test.ts` | (same file) |
| GIT-05 | Warning message shown to user at limit | unit | `npx vitest run test/unit/worktree.service.test.ts` | (same file) |
| GIT-06 | Manifest tracks worktree entries in workspaceState | unit | `npx vitest run test/unit/worktree.service.test.ts` | (same file) |
| GIT-06 | Reconciliation detects orphaned-in-manifest (entry but no directory) | unit | `npx vitest run test/unit/worktree.service.test.ts` | (same file) |
| GIT-06 | Reconciliation detects orphaned-on-disk (directory but no entry) | unit | `npx vitest run test/unit/worktree.service.test.ts` | (same file) |
| GIT-06 | Reconciliation auto-cleans and notifies user | unit | `npx vitest run test/unit/worktree.service.test.ts` | (same file) |
| PERF-04 | All git operations are async (no execFileSync anywhere) | static | `npx vitest run test/unit/git.service.test.ts` + grep check | `test/unit/git.service.test.ts` |
| PERF-04 | Git operations do not block event loop | unit | `npx vitest run test/unit/git.service.test.ts` | (same file) |
| -- | .gitignore entry added before first worktree | unit | `npx vitest run test/unit/gitignore.test.ts` | `test/unit/gitignore.test.ts` |
| -- | Porcelain worktree list parsed correctly | unit | `npx vitest run test/unit/worktree-parser.test.ts` | `test/unit/worktree-parser.test.ts` |

### Test Scenarios for Worktree Operations

These are the critical test scenarios that validate worktree behavior:

**Worktree Creation (GIT-02):**
1. Happy path: create worktree with new branch, verify `git worktree add -b` called with correct args
2. Path convention: verify worktree path is `<repoPath>/.worktrees/<agentName>/`
3. .gitignore guard: verify `ensureGitignoreEntry` called before `git worktree add`
4. Branch collision: mock git returning "already checked out" error, verify graceful error message
5. Repo path validation: reject if path is not a git repository

**Worktree Limit Enforcement (GIT-05):**
1. Under limit: 3 worktrees with limit 5 -- creation succeeds
2. At limit: 5 worktrees with limit 5 -- creation refused with warning message
3. Custom limit: verify configurable limit from RepoConfig is respected (not just default 5)
4. Concurrent guard: two simultaneous create calls should not both pass the limit check (mutex test)

**Worktree Reconciliation (GIT-06):**
1. Clean state: manifest matches disk -- no changes, no notifications
2. Orphaned in manifest: manifest has entry, disk does not -- entry removed from manifest, user notified
3. Orphaned on disk: disk has `.worktrees/` entry, manifest does not -- worktree removed with `git worktree remove`, user notified
4. Mixed orphans: both types simultaneously -- both handled correctly
5. Main worktree skipped: reconciliation ignores the main repo worktree (first entry in `git worktree list`)
6. Non-extension worktrees ignored: worktrees outside `.worktrees/` directory are not touched

**Worktree List Parsing:**
1. Single worktree (main only)
2. Multiple worktrees with branches
3. Detached HEAD worktree
4. Locked worktree
5. Prunable worktree
6. Empty output

**Repo Config (GIT-01):**
1. Add repo with default staging branch "staging"
2. Add repo with custom staging branch name
3. Staging branch already exists -- user confirms to use it
4. Staging branch already exists -- user picks different name
5. Multiple repos stored independently
6. Retrieve config for specific repo path

**Gitignore Management:**
1. No .gitignore exists -- creates one with `.worktrees/` entry
2. .gitignore exists, no entry -- appends `.worktrees/` entry
3. .gitignore already has `.worktrees/` -- no duplicate added
4. .gitignore has `.worktrees` (no trailing slash) -- recognized as existing
5. .gitignore does not end with newline -- proper separator added

### Static Analysis Check for PERF-04

In addition to unit tests, add a static grep check to CI to verify no synchronous git calls exist anywhere in source:

```bash
# In package.json scripts or CI pipeline:
# Fail if any synchronous child_process calls are found in src/
! grep -rn 'execFileSync\|execSync\|spawnSync' src/ || (echo "PERF-04 VIOLATION: synchronous git calls found" && exit 1)
```

This can also be a Vitest test:
```typescript
// test/unit/perf-04.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('PERF-04: No synchronous git calls', () => {
  it('should not contain execFileSync, execSync, or spawnSync in src/', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const files = getAllTsFiles(srcDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/execFileSync|execSync|spawnSync/.test(content)) {
        violations.push(path.relative(srcDir, file));
      }
    }

    expect(violations).toEqual([]);
  });
});

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllTsFiles(fullPath));
    else if (entry.name.endsWith('.ts')) files.push(fullPath);
  }
  return files;
}
```

### Integration Test Config (Phase 1: Minimal)

Phase 1 integration tests are minimal -- just verifying the extension activates and registers its commands. Extensive integration tests come in later phases.

```javascript
// .vscode-test.mjs
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  version: 'stable',
  mocha: {
    timeout: 60_000,
  },
});
```

```typescript
// test/integration/extension.test.ts (minimal Phase 1)
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation', () => {
  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('vscode-agentic.vscode-agentic'));
  });

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('vscode-agentic.vscode-agentic');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    assert.ok(ext?.isActive);
  });

  test('addRepo command should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('vscode-agentic.addRepo'));
  });
});
```

### Sampling Rate

- **Per task commit:** `npm test` (Vitest unit tests only -- runs in < 5 seconds)
- **Per wave merge:** `npm test && npm run test:integration` (full suite including VS Code integration)
- **Phase gate:** Full suite green + PERF-04 static check before `/gsd:verify-work`

### Wave 0 Test Infrastructure Gaps

These files must be created during the scaffolding task (Wave 0) before any service implementation:

- [ ] `vitest.config.ts` -- with `vscode` alias pointing to mock file
- [ ] `test/__mocks__/vscode.ts` -- manual mock of VS Code API (Memento, window, workspace, commands)
- [ ] `test/unit/git.service.test.ts` -- skeleton with `vi.mock('node:child_process')` pattern
- [ ] `test/unit/worktree.service.test.ts` -- skeleton with mock GitService and mock Memento
- [ ] `test/unit/repo-config.service.test.ts` -- skeleton with mock Memento
- [ ] `test/unit/gitignore.test.ts` -- skeleton (uses real fs via `node:fs/promises` on temp dirs)
- [ ] `test/unit/worktree-parser.test.ts` -- skeleton for `parseWorktreeList` pure function
- [ ] `.vscode-test.mjs` -- integration test config
- [ ] `test/integration/extension.test.ts` -- minimal activation test
- [ ] Framework install: `npm install --save-dev vitest@^4.0.0 @vscode/test-cli@^0.0.12 @vscode/test-electron@^2.5.0`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| webpack bundler | esbuild bundler | 2023 (VS Code generator update) | 10-100x faster builds; simpler config |
| ESLint + Prettier (separate tools) | Biome (unified tool) | 2024 (Biome 1.0 stable) | Single config, 25x faster, no plugin conflicts |
| `vscode` npm module for types | `@types/vscode` | 2020 | Decoupled types from runtime; lighter installs |
| Manual activation events | Auto-inferred from contributes | VS Code 1.74 (2022) | Simpler package.json; fewer activation bugs |
| `vsce` package | `@vscode/vsce` package | 2023 | Scoped package; same tool, new name |
| Mocha for all tests | Vitest for unit + Mocha for integration | 2023-2024 | Faster unit tests; Mocha still required for integration by @vscode/test-cli |
| `child_process.exec` | `promisify(child_process.execFile)` | Always preferred | execFile avoids shell injection; promisify enables async/await |
| Jest `__mocks__/vscode.js` | Vitest `test.alias` config | 2024+ | Vitest resolves virtual modules via Vite alias; __mocks__ dir not needed for resolution |

**Deprecated/outdated:**
- `vscode` npm package: Deprecated. Use `@types/vscode` for types and `@vscode/test-electron` for test runtime.
- `vsce` (unscoped): Use `@vscode/vsce` instead.
- Explicit `onView:` activation events: Not needed since VS Code 1.74; views auto-register.

## Open Questions

1. **Worktree location: inside repo vs sibling**
   - What we know: CONTEXT.md says `/path/to/repo/.worktrees/agent-name/` (inside repo as subdirectory). Git best practices generally recommend sibling directories. However, inside-repo with `.gitignore` is a valid pattern documented by the community.
   - What's unclear: Whether git has any issues with worktrees inside the parent repo's working directory. Since `.worktrees/` will be gitignored, git should treat it as untracked and ignore it completely.
   - Recommendation: Follow the user decision (inside repo at `.worktrees/`). This keeps everything contained and is simpler for the user. Ensure `.worktrees/` is in `.gitignore` before any worktree is created.

2. **Mutex strategy for concurrent worktree operations**
   - What we know: TOCTOU race conditions are possible when multiple async worktree operations run concurrently (e.g., two agents being created simultaneously for the same repo).
   - What's unclear: Whether VS Code extension commands can truly fire concurrently in the extension host (they can -- async commands yield the event loop).
   - Recommendation: Implement a simple per-repo promise queue. Before any worktree mutation, acquire the queue for that repo. This prevents the limit check from being stale.

3. **Staging branch creation**
   - What we know: User configures the staging branch name. If it already exists, prompt to confirm.
   - What's unclear: Should the extension CREATE the staging branch if it doesn't exist? Or just record the name and let the user create it?
   - Recommendation: The extension should create it if it doesn't exist (from the current HEAD), since the extension is the one that needs it. Show an info message: "Created staging branch 'staging' from current HEAD."

## Sources

### Primary (HIGH confidence)
- [VS Code Extension Bundling Docs](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) - esbuild configuration, scripts, externals
- [VS Code Activation Events](https://code.visualstudio.com/api/references/activation-events) - Event types, onView auto-registration (1.74+), onStartupFinished
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree) - Complete command reference, porcelain format, error conditions
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension) - @vscode/test-cli setup, .vscode-test.mjs config
- [VS Code Common Capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities) - Memento API, storage options
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) - execFile, promisify, async patterns
- [Microsoft esbuild-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/esbuild-sample) - Official reference project structure
- npm registry (live queries) - Verified current versions: @types/vscode@1.109.0, typescript@5.9.3, vitest@4.0.18, @biomejs/biome@2.4.5, esbuild@0.27.3
- [Vitest Module Mocking Docs](https://vitest.dev/guide/mocking/modules) - vi.mock with factory functions, alias-based virtual module resolution, __mocks__ directory patterns
- [Vitest Issue #993](https://github.com/vitest-dev/vitest/issues/993) - Mocking uninstalled modules (vscode) -- confirmed fixed in latest Vitest with Vite plugin or alias approach
- [@vscode/test-cli README](https://github.com/microsoft/vscode-test-cli) - Configuration-driven CLI runner, .vscode-test.mjs format, Mocha integration

### Secondary (MEDIUM confidence)
- [Biome vs ESLint comparison articles](https://medium.com/@harryespant/biome-vs-eslint-the-ultimate-2025-showdown) - Performance claims (25x faster), feature coverage (97% Prettier compatible)
- [pnpm + vsce compatibility](https://opensciencelabs.org/blog/packaging-a-vs-code-extension-using-pnpm-and-vsce/) - --no-dependencies workaround required for pnpm
- [Git worktree best practices](https://devtoolbox.dedyn.io/blog/git-worktrees-complete-guide) - Community patterns for worktree organization
- [Mock VS Code API pattern (Jest)](https://www.richardkotze.com/coding/unit-test-mock-vs-code-extension-api-jest) - Manual mock pattern adapted to Vitest; Memento mock structure
- [Mock child_process.exec in Vitest (Gist)](https://gist.github.com/joemaller/f9171aa19a187f59f406ef1ffe87d9ac) - Callback-style mock pattern for promisified execFile

### Tertiary (LOW confidence)
- Service architecture patterns for VS Code extensions: Derived from VS Code's own Git extension patterns and general TypeScript architecture. No single authoritative source for "the right way" to structure a VS Code extension's internal services.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm registry and official VS Code docs. Version numbers are current as of 2026-03-04.
- Architecture: HIGH - Service-layer pattern is derived from VS Code's own extensions and Microsoft's samples. The async git wrapper is a well-established Node.js pattern.
- Pitfalls: HIGH - All pitfalls are derived from git documentation (branch-already-checked-out, worktree pruning) or well-known VS Code extension development issues (extension host blocking, workspaceState vs globalState).
- Code examples: HIGH - esbuild config and package.json scripts come directly from Microsoft's official documentation and sample repos.
- Validation architecture: HIGH - Vitest mocking patterns verified via official Vitest docs and confirmed issue resolutions. VS Code mock approach verified via Vitest issue #993 (resolved). child_process mocking pattern verified via multiple community sources and Vitest docs.

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days - stable technologies, slow-moving APIs)
