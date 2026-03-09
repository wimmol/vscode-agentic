# Phase 5: Refactor Codebase to Match CLAUDE.md Conventions - Research

**Researched:** 2026-03-10
**Domain:** VS Code extension refactoring -- React webview migration, feature-based architecture, VS Code API migration, settings exposure
**Confidence:** HIGH

## Summary

Phase 5 is a pure refactoring phase that transforms the existing working codebase to match CLAUDE.md conventions. The codebase currently spans 2,464 lines across 19 source files organized by layer (commands/, services/, models/, utils/, views/). The refactoring touches four axes: (1) migrating the 820-line HTML string webview to React components, (2) consolidating commands+services into feature-based files, (3) replacing Node.js `fs`/`path` with VS Code APIs, and (4) exposing three hardcoded values as VS Code settings. No new user-facing features are introduced -- same functionality, cleaner structure.

The React webview migration is the largest technical change. It requires adding React 19.x + ReactDOM as dependencies, creating a second esbuild entry point targeting the browser platform, and building JSX/TSX components that communicate with the extension host via the existing `postMessage` protocol. The feature-based consolidation is mechanical but extensive -- four services (agent, terminal, repo-config, worktree) get absorbed into eight feature files, with only truly shared services and thin data stores remaining in `src/services/`. The `vscode.workspace.fs` migration affects two files (workspace.service.ts, gitignore.ts) and is straightforward. Settings exposure is a simple `contributes.configuration` addition.

**Primary recommendation:** Execute in 4 waves -- (1) React build pipeline + skeleton webview, (2) React component implementation with all UI migrated, (3) feature-based file consolidation + settings exposure, (4) `vscode.workspace.fs` + path migration + cleanup. This ordering ensures the hardest work (React) is done first while the codebase is still in its known-working state, and mechanical refactoring follows.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full React migration for the webview sidebar (replace 820-line HTML string generation)
- Set up React + bundler for webview
- All UI lives in `src/ui/` with structure: `atoms/`, `components/`, `styles/`, `view.ts`, `agenticTab.ts`
- Atoms: StatusIcon.tsx, ActionButton.tsx, ElapsedTimer.tsx
- Components: AgentTile.tsx, RepoSection.tsx, Dashboard.tsx
- Data flow: extension sends data via `webview.postMessage()`, React listens via `useEffect` + `useState`
- Styling: single CSS file (`styles/dashboard.css`) using VS Code theme CSS variables
- Timer: custom `useElapsedTime` hook that takes startedAt/finishedAt and returns formatted string, updates every second for running agents
- No VS Code Webview UI Toolkit -- plain React with theme CSS vars
- One file per feature in `src/features/`: create-agent.ts, delete-agent.ts, focus-agent.ts, stop-agent.ts, add-repo.ts, remove-repo.ts, root-global.ts, root-repo.ts
- Each feature file contains: command registration, handler, and all business logic for that feature
- Shared services (kept): git.service.ts, workspace.service.ts
- Absorbed into features: agent.service.ts, terminal.service.ts, repo-config.service.ts, worktree.service.ts
- Thin data stores: agents-store.ts, repos-store.ts
- Final `src/services/` contents: git.service.ts, workspace.service.ts, agents-store.ts, repos-store.ts
- All Node.js `fs` replaced with `vscode.workspace.fs`
- All `path.join()` replaced with `vscode.Uri.joinPath()` or `vscode.Uri.file()`
- Internal APIs keep string paths -- convert to Uri only at point of use
- git.service.ts stays string-based (git CLI requires string paths)
- Repo basename computed by extension host and sent as part of dashboard data
- Three new VS Code settings: maxWorktreesPerRepo, defaultStagingBranch, worktreeDirectoryName
- Staging branch precedence: per-repo Memento override -> VS Code setting -> hardcoded "staging"

### Claude's Discretion
- React bundler choice for webview (esbuild plugin, webpack, etc.)
- Exact component boundaries and prop interfaces
- CSS class naming conventions
- How to handle webview initial state before first postMessage
- Feature file internal structure (export patterns, function organization)
- Migration order (which refactoring to do first for minimal breakage)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.4 | UI component library for webview | Industry standard, user decision locked |
| react-dom | ^19.2.4 | React DOM renderer for webview | Required companion to React |
| esbuild | ^0.27.3 (existing) | Bundle both extension + webview entry points | Already in project, handles JSX natively |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/react | ^19.x | TypeScript types for React | Dev dependency for type checking |
| @types/react-dom | ^19.x | TypeScript types for ReactDOM | Dev dependency for type checking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate webpack for webview | esbuild with second entry point | esbuild already in project, handles JSX natively, no additional bundler needed |
| Preact | React | User locked on React; Preact would be smaller but diverges from CLAUDE.md |
| CSS Modules | Single CSS file | User locked on single dashboard.css with VS Code CSS variables |

**Installation:**
```bash
npm install react react-dom
npm install -D @types/react @types/react-dom
```

## Architecture Patterns

### Recommended Project Structure (After Refactoring)
```
src/
  features/              # One file per user-facing command
    create-agent.ts      # Command registration + handler + all create-agent logic
    delete-agent.ts      # Command registration + handler + all delete-agent logic
    focus-agent.ts       # Command registration + handler + focus/terminal logic
    stop-agent.ts        # Command registration + handler + stop logic
    add-repo.ts          # Command registration + handler + repo add flow
    remove-repo.ts       # Command registration + handler + repo remove flow
    root-global.ts       # Command registration + handler + reset Explorer
    root-repo.ts         # Command registration + handler + set Explorer scope
  services/              # Only truly shared services + thin stores
    git.service.ts       # Async git wrapper (unchanged, stays string-based)
    workspace.service.ts # Workspace file + Explorer scope (migrated to vscode.workspace.fs)
    agents-store.ts      # Memento CRUD for agent registry (thin, no logic)
    repos-store.ts       # Memento CRUD for repo configs (thin, no logic)
  ui/                    # React webview (separate esbuild entry point)
    atoms/
      StatusIcon.tsx     # Status codicon for agent states
      ActionButton.tsx   # Tile action button with disabled state
      ElapsedTimer.tsx   # Running timer / static elapsed display
    components/
      AgentTile.tsx      # Full agent tile with header, info, metrics, actions
      RepoSection.tsx    # Collapsible repo section with header + agent tiles
      Dashboard.tsx      # Top-level dashboard rendering all repo sections
    hooks/
      useElapsedTime.ts  # Hook: takes startedAt/finishedAt, returns formatted string
      useVsCodeApi.ts    # Hook: acquireVsCodeApi singleton + postMessage helper
    styles/
      dashboard.css      # Single CSS file with VS Code theme variables
    view.ts              # HTML shell provider (generates <html> wrapping React bundle)
    agenticTab.ts        # Entry point for React app (renders Dashboard, listens to messages)
  models/                # Type definitions (unchanged)
    agent.ts
    repo.ts
    worktree.ts
  utils/                 # Shared utilities (unchanged except gitignore.ts migration)
    branch-validation.ts
    gitignore.ts         # Migrated to vscode.workspace.fs
    nonce.ts
    worktree-parser.ts
  extension.ts           # Simplified activate() -- creates stores+services, registers features
```

### Pattern 1: Dual esbuild Entry Points
**What:** Two separate esbuild builds -- one for extension host (Node.js/CJS), one for webview (browser/IIFE)
**When to use:** VS Code extensions with React webviews
**Example:**
```javascript
// esbuild.js -- two builds in parallel
const extensionCtx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: "dist/extension.js",
  external: ["vscode"],
  minify: production,
  sourcemap: !production,
  plugins: [esbuildProblemMatcherPlugin],
});

const webviewCtx = await esbuild.context({
  entryPoints: ["src/ui/agenticTab.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: "dist/webview.js",
  minify: production,
  sourcemap: !production,
  // Note: jsx: 'automatic' for React 19 JSX transform
  jsx: "automatic",
  plugins: [esbuildProblemMatcherPlugin],
});

if (watch) {
  await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
} else {
  await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
  await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
}
```

### Pattern 2: React Webview Message Bridge
**What:** Extension host sends structured data via postMessage; React app listens via useEffect + useState
**When to use:** All webview data flow
**Example:**
```typescript
// src/ui/agenticTab.ts (webview entry point)
import { createRoot } from "react-dom/client";
import { Dashboard } from "./components/Dashboard";

const root = createRoot(document.getElementById("root")!);
root.render(<Dashboard />);

// src/ui/components/Dashboard.tsx
import { useState, useEffect } from "react";
import type { DashboardData } from "./types";

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "update") {
        setData(msg.data);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (!data) return null; // or loading state

  return (
    <div className="dashboard">
      {data.repos.map((repo) => (
        <RepoSection key={repo.path} repo={repo} scope={data.scope} />
      ))}
    </div>
  );
}
```

### Pattern 3: Feature File Structure
**What:** Single file contains command registration, handler logic, and all business logic for one feature
**When to use:** Every user-facing command
**Example:**
```typescript
// src/features/create-agent.ts
import * as vscode from "vscode";
import type { AgentsStore } from "../services/agents-store";
import type { ReposStore } from "../services/repos-store";
import type { GitService } from "../services/git.service";
import { isValidBranchName } from "../utils/branch-validation";

// All create-agent logic in one place -- command + handler + business logic
export function registerCreateAgent(
  context: vscode.ExtensionContext,
  agentsStore: AgentsStore,
  reposStore: ReposStore,
  gitService: GitService,
): void {
  const disposable = vscode.commands.registerCommand(
    "vscode-agentic.createAgent",
    async (repoPath?: string) => {
      console.log("[feature:createAgent]", { repoPath });
      // ... all logic here, not spread across service files
    },
  );
  context.subscriptions.push(disposable);
}
```

### Pattern 4: Thin Data Store
**What:** Pure CRUD wrapper around Memento -- no business logic, just read/write/fire
**When to use:** agents-store.ts, repos-store.ts
**Example:**
```typescript
// src/services/agents-store.ts
import * as vscode from "vscode";
import type { AgentEntry } from "../models/agent";
import { AGENT_REGISTRY_KEY } from "../models/agent";

export class AgentsStore {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly state: vscode.Memento) {}

  getAll(): AgentEntry[] {
    return this.state.get<AgentEntry[]>(AGENT_REGISTRY_KEY, []);
  }

  getForRepo(repoPath: string): AgentEntry[] {
    return this.getAll().filter((e) => e.repoPath === repoPath);
  }

  async save(entries: AgentEntry[]): Promise<void> {
    await this.state.update(AGENT_REGISTRY_KEY, entries);
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
```

### Pattern 5: vscode.workspace.fs Migration
**What:** Replace Node.js `fs` and `path` with VS Code filesystem API and Uri
**When to use:** All file I/O in workspace.service.ts and gitignore.ts
**Example:**
```typescript
// Before (Node.js):
import * as fs from "node:fs/promises";
import * as path from "node:path";
const content = await fs.readFile(path.join(repoPath, ".gitignore"), "utf-8");

// After (VS Code API):
import * as vscode from "vscode";
const uri = vscode.Uri.joinPath(vscode.Uri.file(repoPath), ".gitignore");
const rawBytes = await vscode.workspace.fs.readFile(uri);
const content = new TextDecoder().decode(rawBytes);

// Writing:
const encoded = new TextEncoder().encode(newContent);
await vscode.workspace.fs.writeFile(uri, encoded);

// Mkdir (createDirectory):
const dirUri = vscode.Uri.file(dirPath);
await vscode.workspace.fs.createDirectory(dirUri);
```

### Anti-Patterns to Avoid
- **Splitting feature logic across files:** CLAUDE.md says "Try not to split code of one feature across many separate files and functions." Each feature file should be self-contained.
- **Large service classes:** CLAUDE.md says "Do not create large classes." Keep stores thin, move business logic to feature files.
- **Over-engineering:** CLAUDE.md says "Do not overengineer. Write code as simple as possible." Don't add abstractions unless they solve a real problem.
- **Removing console.log calls:** CLAUDE.md explicitly wants "Add console.log calls to see function call chains." Keep all existing ones, add new ones in feature files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSX compilation | Custom JSX transform | esbuild `jsx: "automatic"` | esbuild handles JSX natively with React 19's transform |
| Webview HTML template | Complex template literals | Simple HTML shell that loads React bundle via `<script src>` | React takes over DOM rendering, HTML shell is minimal |
| State management | Custom pub/sub system | React's built-in useState + useEffect + postMessage | Webview state is simple (one data shape), no need for Redux/Zustand |
| Elapsed time formatting | Inline calculations in components | Custom `useElapsedTime` hook with setInterval | Isolates timer logic, testable, reusable across tiles |
| acquireVsCodeApi management | Multiple acquireVsCodeApi calls | Single-call wrapper hook/module | acquireVsCodeApi can only be called once; must be cached |
| CSS theming | Custom theme system | VS Code CSS variables (--vscode-*) | Already used in current code, works with all VS Code themes |

**Key insight:** The existing DOM patching logic (patchAgentTile, patchRepoSection, patchDashboard) becomes entirely unnecessary with React. React's virtual DOM handles all diffing and updates. The 400+ lines of JavaScript DOM patching code in sidebar-html.ts are replaced by React's reconciliation.

## Common Pitfalls

### Pitfall 1: acquireVsCodeApi Called Multiple Times
**What goes wrong:** The webview crashes with "acquireVsCodeApi can only be invoked once"
**Why it happens:** React re-renders cause the module to re-execute, or multiple components try to acquire the API
**How to avoid:** Call `acquireVsCodeApi()` exactly once at the top-level of the webview entry point (agenticTab.ts) and pass it down via React context or props. Alternatively, create a `useVsCodeApi.ts` module that caches the result.
**Warning signs:** Webview goes blank after first render

### Pitfall 2: esbuild Platform Mismatch
**What goes wrong:** React bundle fails in webview because it uses Node.js APIs, or extension bundle fails because it includes browser APIs
**Why it happens:** Both builds use the same esbuild config with platform: "node"
**How to avoid:** Extension build uses `platform: "node"`, webview build uses `platform: "browser"`. Extension externalizes `vscode`, webview does NOT externalize anything.
**Warning signs:** "process is not defined" errors in webview, or "require is not defined" in webview

### Pitfall 3: CSP Blocks React Bundle
**What goes wrong:** React code doesn't execute, console shows Content Security Policy violation
**Why it happens:** Webview CSP doesn't include the script source for the React bundle
**How to avoid:** The HTML shell must include the correct nonce in the `<script>` tag and the CSP meta tag must allow `script-src 'nonce-${nonce}'`. The current CSP pattern in sidebar-html.ts is correct -- just ensure the React bundle script tag uses the same nonce.
**Warning signs:** Empty webview, CSP errors in webview dev tools

### Pitfall 4: TypeScript Config Conflicts
**What goes wrong:** TSX files fail to compile, or extension .ts files get DOM types they shouldn't have
**Why it happens:** Single tsconfig.json has `"lib": ["ES2022"]` without DOM, or adding DOM affects extension code
**How to avoid:** Use a separate `tsconfig.webview.json` that extends the base and adds `"lib": ["ES2022", "DOM"]` and `"jsx": "react-jsx"`. The main tsconfig.json stays as-is for extension code. esbuild handles the actual compilation, but tsc needs the config for type checking.
**Warning signs:** TS errors about missing DOM types in .tsx files, or TS errors about unexpected DOM types in extension .ts files

### Pitfall 5: Feature File Circular Dependencies
**What goes wrong:** Feature files import each other, creating circular dependency chains
**Why it happens:** create-agent.ts needs terminal logic (currently in terminal.service.ts), which needs status update logic (currently in agent.service.ts)
**How to avoid:** Feature files import only from stores and services (which are dependency-free CRUD wrappers). Cross-feature logic goes through VS Code commands (`vscode.commands.executeCommand`) or is extracted to a shared utility. The terminal status callback pattern from Phase 2 (TerminalService constructor callback) continues to work -- it's passed from extension.ts at wiring time.
**Warning signs:** "Cannot access before initialization" errors at runtime

### Pitfall 6: Lost postMessage Initial State
**What goes wrong:** React renders empty dashboard because no postMessage arrives before first render
**Why it happens:** The React app mounts after the webview resolves, but the extension already sent initial data
**How to avoid:** Two approaches: (a) Extension sends initial data in `resolveWebviewView()` after setting HTML -- React's useEffect listener catches it. (b) Include initial data as a `<script>` global variable in the HTML shell (e.g., `window.__INITIAL_DATA__ = ${JSON.stringify(data)}`). Approach (a) is simpler and matches the existing pattern. The extension currently builds initial HTML with data baked in -- with React, it should send a postMessage immediately after setting the HTML.
**Warning signs:** Brief flash of empty content on sidebar open

### Pitfall 7: Test Breakage During Migration
**What goes wrong:** Existing 17 unit test files break because imports change
**Why it happens:** Service files are deleted/moved, function signatures change, new files aren't tested
**How to avoid:** Migrate tests in lockstep with source changes. When agent.service.ts is absorbed into feature files, agent.service.test.ts must be split/rewritten to test agents-store.ts and the feature files. The vscode mock already supports EventEmitter and Memento, which stores use.
**Warning signs:** Test suite goes red during intermediate migration steps

## Code Examples

### esbuild Configuration for Dual Builds
```javascript
// esbuild.js -- updated for extension + webview
const esbuild = require("esbuild");
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const esbuildProblemMatcherPlugin = { /* existing plugin */ };

async function main() {
  // Extension host (Node.js, CJS)
  const extensionCtx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
  });

  // Webview (Browser, IIFE, React JSX)
  const webviewCtx = await esbuild.context({
    entryPoints: ["src/ui/agenticTab.tsx"],
    bundle: true,
    format: "iife",
    platform: "browser",
    outfile: "dist/webview.js",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: "silent",
    jsx: "automatic",
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
    await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

### HTML Shell for React Webview
```typescript
// src/ui/view.ts -- minimal HTML shell that loads React bundle
import * as vscode from "vscode";
import { getNonce } from "../utils/nonce";

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview.js"),
  );
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"),
  );
  const stylesUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "src", "ui", "styles", "dashboard.css"),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link href="${codiconsUri}" rel="stylesheet" />
  <link href="${stylesUri}" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
```

### useElapsedTime Hook
```typescript
// src/ui/hooks/useElapsedTime.ts
import { useState, useEffect } from "react";

export function useElapsedTime(
  startedAt: string | undefined,
  finishedAt: string | undefined,
  isRunning: boolean,
): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!startedAt) return "--";
  const start = new Date(startedAt).getTime();
  const end = isRunning ? now : finishedAt ? new Date(finishedAt).getTime() : start;
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
```

### VS Code Settings in package.json
```json
{
  "contributes": {
    "configuration": {
      "title": "VS Code Agentic",
      "properties": {
        "vscode-agentic.maxWorktreesPerRepo": {
          "type": "number",
          "default": 5,
          "minimum": 1,
          "maximum": 20,
          "description": "Maximum number of agent worktrees allowed per repository."
        },
        "vscode-agentic.defaultStagingBranch": {
          "type": "string",
          "default": "staging",
          "description": "Default staging branch name for new repositories. Per-repo overrides take precedence."
        },
        "vscode-agentic.worktreeDirectoryName": {
          "type": "string",
          "default": ".worktrees",
          "description": "Name of the directory created inside repositories to hold agent worktrees."
        }
      }
    }
  }
}
```

### Reading Settings in Code
```typescript
// In feature file or service
function getWorktreeLimit(): number {
  const config = vscode.workspace.getConfiguration("vscode-agentic");
  return config.get<number>("maxWorktreesPerRepo", 5);
}

function getDefaultStagingBranch(): string {
  const config = vscode.workspace.getConfiguration("vscode-agentic");
  return config.get<string>("defaultStagingBranch", "staging");
}

function getWorktreeDirName(): string {
  const config = vscode.workspace.getConfiguration("vscode-agentic");
  return config.get<string>("worktreeDirectoryName", ".worktrees");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| String HTML generation + DOM patching | React components + virtual DOM | React 19 (2024) | Eliminates 400+ lines of manual DOM code |
| `require("node:fs/promises")` | `vscode.workspace.fs` | VS Code API stable since 1.37 | Works with remote/virtual file systems |
| `path.join()` for file paths | `vscode.Uri.joinPath()` | VS Code API stable since 1.45 | Platform-agnostic path handling |
| Hardcoded constants | `contributes.configuration` | VS Code API since 1.0 | User-configurable behavior |
| React 18 JSX transform | React 19 JSX transform | React 19.x (2024) | `jsx: "automatic"` in esbuild, no React import needed |

**Deprecated/outdated:**
- The VS Code Webview UI Toolkit (@vscode/webview-ui-toolkit) was deprecated in 2024. User decision correctly avoids it.
- React class components are obsolete for new code. All components should use function components with hooks.

## Open Questions

1. **CSS file loading in webview**
   - What we know: CSS can be loaded via `<link>` tag with webview URI, or inlined in HTML
   - What's unclear: Whether esbuild should bundle CSS alongside JS, or keep it separate
   - Recommendation: Keep CSS as a separate file loaded via `<link>` tag. This matches the user's "single CSS file" decision and avoids CSS-in-JS complexity. The webview `asWebviewUri()` handles the path.

2. **tsconfig.json split for webview TSX**
   - What we know: Extension code needs `"lib": ["ES2022"]` without DOM. Webview TSX code needs DOM + JSX.
   - What's unclear: Whether esbuild respects tsconfig paths for JSX or uses its own config
   - Recommendation: esbuild uses its own `jsx: "automatic"` setting, so tsconfig is only for tsc type checking. Create `tsconfig.webview.json` extending base with DOM lib. Update `check-types` script to run both: `tsc --noEmit && tsc --noEmit -p tsconfig.webview.json`.

3. **Feature file size after absorption**
   - What we know: create-agent.ts absorbs agent creation logic from AgentService + worktree creation from WorktreeService + terminal handling from TerminalService
   - What's unclear: How large create-agent.ts will be
   - Recommendation: If a feature file exceeds ~200 lines, the shared utility extraction is fine (e.g., `utils/worktree-ops.ts`). But the default should be keeping logic in the feature file per CLAUDE.md "one file per feature."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

This phase has no formal requirement IDs assigned (context says "TBD"). However, the refactoring must preserve all existing behavior. Test coverage maps to existing functionality:

| Area | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|-------------|
| React build | Webview bundle compiles without errors | build | `npm run compile` | N/A (build check) |
| AgentsStore | Memento CRUD operations | unit | `npx vitest run test/unit/agents-store.test.ts -t` | Wave 0 |
| ReposStore | Memento CRUD operations | unit | `npx vitest run test/unit/repos-store.test.ts -t` | Wave 0 |
| Feature: create-agent | Agent creation flow with validation | unit | `npx vitest run test/unit/create-agent.test.ts -t` | Wave 0 |
| Feature: delete-agent | Agent deletion with confirmation | unit | `npx vitest run test/unit/delete-agent.test.ts -t` | Wave 0 |
| Feature: add-repo | Repository addition flow | unit | `npx vitest run test/unit/add-repo.test.ts -t` | Wave 0 |
| Settings | getConfiguration reads correct values | unit | `npx vitest run test/unit/settings.test.ts -t` | Wave 0 |
| Webview HTML shell | Generates correct HTML with React script | unit | `npx vitest run test/unit/view.test.ts -t` | Wave 0 |
| gitignore (migrated) | vscode.workspace.fs read/write | unit | `npx vitest run test/unit/gitignore.test.ts -t` | Existing (needs update) |
| workspace.service (migrated) | vscode.workspace.fs operations | unit | `npx vitest run test/unit/workspace.service.test.ts -t` | Existing (needs update) |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npm run compile` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/unit/agents-store.test.ts` -- covers thin store CRUD
- [ ] `test/unit/repos-store.test.ts` -- covers thin store CRUD
- [ ] `test/unit/create-agent.test.ts` -- replaces agent.commands.test.ts + agent.service.test.ts portions
- [ ] `test/unit/delete-agent.test.ts` -- replaces portions of above
- [ ] `test/unit/add-repo.test.ts` -- replaces repo.commands.test.ts + repo-config.service.test.ts portions
- [ ] `test/unit/view.test.ts` -- covers new HTML shell (replaces sidebar-html.test.ts)
- [ ] Update `test/unit/gitignore.test.ts` -- mock vscode.workspace.fs instead of node:fs
- [ ] Update `test/unit/workspace.service.test.ts` -- mock vscode.workspace.fs instead of node:fs
- [ ] Update vitest config to include `.tsx` files and handle JSX

## Sources

### Primary (HIGH confidence)
- [VS Code API - Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) -- esbuild setup, entry point configuration
- [VS Code API - Webview Guide](https://code.visualstudio.com/api/extension-guides/webview) -- webview CSP, message passing, URI handling
- [VS Code API - Contribution Points](https://code.visualstudio.com/api/references/contribution-points) -- contributes.configuration schema
- [VS Code Extension Samples - fsconsumer-sample](https://github.com/microsoft/vscode-extension-samples/blob/main/fsconsumer-sample/src/extension.ts) -- vscode.workspace.fs usage patterns
- [esbuild API](https://esbuild.github.io/api/) -- JSX transform, platform settings, multiple entry points
- [React 19 npm](https://www.npmjs.com/package/react) -- current version 19.2.4

### Secondary (MEDIUM confidence)
- [Ken Muse - Using React in VS Code Webviews](https://www.kenmuse.com/blog/using-react-in-vs-code-webviews/) -- complete React webview setup walkthrough with esbuild
- [Building VS Code Extensions in 2026](https://abdulkadersafi.com/blog/building-vs-code-extensions-in-2026-the-complete-modern-guide) -- current practices guide

### Tertiary (LOW confidence)
- None -- all findings verified against official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- React, esbuild, VS Code APIs are well-documented and stable
- Architecture: HIGH -- patterns derived directly from user decisions in CONTEXT.md + official VS Code extension patterns
- Pitfalls: HIGH -- based on known VS Code webview constraints (CSP, acquireVsCodeApi, platform mismatch) confirmed by official docs
- Migration scope: HIGH -- full codebase read completed, every file analyzed, all `fs`/`path` usage catalogued

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain, 30-day validity)
