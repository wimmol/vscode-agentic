# Phase 4: UI Polish - Research

**Researched:** 2026-03-08
**Domain:** VS Code Webview UI, Workspace API, DOM Patching, Explorer Folder Scope
**Confidence:** HIGH

## Summary

This phase adds four complementary features to the existing sidebar dashboard: (1) workspace file management so VS Code shows "agentic (Workspace)" in the title bar, (2) root navigation buttons for global and per-repo folder scoping, (3) message-based DOM patching to eliminate rendering glitches from full HTML replacement, and (4) Explorer folder scope management across all navigation actions.

All four features build directly on existing code. The sidebar provider already has `refresh()` (HTML replacement), `focusAgent` already calls `updateWorkspaceFolders()`, and the webview already uses `postMessage` from webview-to-extension. The new work inverts the message direction (extension-to-webview) and adds filesystem operations for the `.code-workspace` file.

The codebase currently has 214 passing unit tests across 15 test files, comprehensive vscode mock infrastructure, and established patterns for services, commands, and HTML generation. All new code follows these established patterns.

**Primary recommendation:** Implement workspace file management first (foundation for scope persistence), then root navigation commands (uses workspace file), then DOM patching (largest refactor but independent), and finally wire Explorer scope consistency across all navigation paths.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Workspace naming:**
- Create `~/.agentic/agentic.code-workspace` file on first extension activation
- Workspace file lists all repo root folders from `~/.agentic/config.json` (repos key: name -> global path)
- Title bar shows "Agentic" instead of "Untitled (Workspace)"
- Workspace file is auto-synced: when repos are added/removed via the extension, update the `.code-workspace` folders list to match config.json
- Prompt user to reopen VS Code in workspace mode after creating the file
- File lives in user's home directory (`~/.agentic/`) for portability

**Root navigation buttons:**
- Global "root" button in the panel toolbar, positioned left of the + (Add Repo) button
- Per-repo "root" button in each repo header, positioned left of the + (Create Agent) button
- Both use `codicon-root-folder` icon for consistency
- Global root: sets workspace folders to all repo roots from config.json
- Per-repo root: replaces all workspace folders with that single repo's root folder
- Active root button gets a visual highlight (accent color or background) to show current scope

**Smooth rendering:**
- Replace current `refresh()` full HTML replacement with postMessage + DOM patching
- Extension sends agent/repo data as JSON via `webview.postMessage()`
- Webview JS receives data and updates existing DOM elements in-place (text, classes, attributes)
- Initial render still uses full HTML (first load only)
- New agent tiles animate in (fade/slide), deleted tiles animate out (fade) via CSS transitions
- Status icon changes use crossfade transition; elapsed time updates text only, no tile re-creation
- No element should disappear and re-render -- all updates are in-place modifications

**Explorer folder scope:**
- Three scope modes, all using replace-all pattern:
  1. Global root: show all repo root folders (basenames only, e.g., "foo", "bar")
  2. Per-repo root: show single repo root folder
  3. Agent focus (tile click): show single agent worktree folder (raw folder path, current behavior)
- On startup, Explorer shows all repo roots (read from .code-workspace file)
- Scope changes sync to the .code-workspace file (persists across restarts -- user sees last-focused scope on reopen)
- workspace.updateWorkspaceFolders() used for all scope changes

### Claude's Discretion
- Exact CSS transition durations and easing functions for tile animations
- DOM diffing implementation details (manual vs lightweight library)
- Workspace file creation timing (on activate vs on first addRepo)
- How to detect if VS Code is already in workspace mode
- Notification UX for the "reopen in workspace" prompt

### Deferred Ideas (OUT OF SCOPE)
- Settings gear dialog UI (editing staging branch, worktree limits) -- future phase
- Actual diff counts, context usage, RAM metrics -- future phases with real data
- Clear Context terminal write integration -- future phase
- Reset Changes git operation -- future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WS-01 | Extension creates `~/.agentic/agentic.code-workspace` file | WorkspaceService pattern with `node:fs/promises`, workspace file JSON format verified |
| WS-02 | Workspace file folders array stays in sync with configured repos | `syncWorkspaceFile()` reads from `RepoConfigService.getAll()` (globalState, NOT config.json) |
| WS-03 | Detect if VS Code is in workspace mode | `vscode.workspace.workspaceFile` property -- returns `Uri` or `undefined` (verified from @types/vscode line 13391) |
| WS-04 | Prompt user to reopen in workspace mode | `vscode.commands.executeCommand("vscode.openFolder", uri)` restarts extension host (verified) |
| ROOT-01 | Global root button in toolbar sets all repo roots | `package.json` `view/title` menu with `navigation@1` group, calls `updateWorkspaceFolders` |
| ROOT-02 | Per-repo root button sets single repo root | Webview button in repo-header div, routes via postMessage to command |
| ROOT-03 | Root buttons use `codicon-root-folder` icon | `@vscode/codicons` 0.0.44 includes `codicon-root-folder` (verified in project dependencies) |
| RENDER-01 | Sidebar refresh uses postMessage + DOM patching after initial render | `webview.postMessage({type: "update", data})` pattern, `window.addEventListener("message", ...)` receiver |
| RENDER-02 | Initial render still uses full HTML | `_initialRenderDone` flag pattern in SidebarViewProvider |
| SCOPE-01 | focusAgent scope changes update workspace folders consistently | Refactor to use `WorkspaceService.setExplorerScope()` instead of direct `updateWorkspaceFolders()` |
| SCOPE-02 | Scope changes sync to workspace file for persistence | `updateWorkspaceFolders()` auto-syncs to `.code-workspace` when in workspace mode |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vscode` | ^1.96.0 | Extension API (workspace, webview, commands) | Core dependency |
| `@vscode/codicons` | ^0.0.44 | Icon set including `codicon-root-folder` | Already used in sidebar |
| `node:fs/promises` | Built-in | Read/write `.code-workspace` file | Node.js native, async |
| `node:os` | Built-in | `os.homedir()` for `~/.agentic/` path | Node.js native |
| `node:path` | Built-in | Path join/resolve for workspace file paths | Already used |

### Supporting (No New Dependencies)
No new npm dependencies needed. All features use VS Code built-in APIs and Node.js standard library.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual DOM patching | morphdom/nanomorph library | Extra dependency for ~50 lines of patching code; manual is simpler for this use case |
| Direct file I/O for workspace | VS Code FileSystem API (`vscode.workspace.fs`) | File is outside workspace, `node:fs` is simpler for home directory access |
| JSON.stringify for workspace file | jsonc-parser | .code-workspace supports JSONC but we generate it fresh, no need to parse comments |

**Installation:**
```bash
# No new packages needed -- all dependencies already in project
```

**Recommendation (Claude's Discretion - DOM diffing):** Use manual DOM patching, not a library. The data shape is simple (flat list of repos, each with flat list of agents), and the update operations are well-defined (add/remove tiles, update text/classes). A library adds dependency weight for a problem that is solved in ~60 lines of targeted JS.

## Architecture Patterns

### New File Structure
```
src/
  services/
    workspace.service.ts     # NEW: .code-workspace file management
  commands/
    workspace.commands.ts    # NEW: rootGlobal, rootRepo commands
    agent.commands.ts        # MODIFIED: scope sync on focusAgent via WorkspaceService
    repo.commands.ts         # MODIFIED: sync workspace file on add/remove
  views/
    sidebar-provider.ts      # MODIFIED: postMessage instead of HTML replacement, setScope()
    sidebar-html.ts          # MODIFIED: add message receiver, DOM patcher, root buttons, animation CSS
  extension.ts               # MODIFIED: new service, new commands, startup scope
~/.agentic/
  agentic.code-workspace     # NEW: generated workspace file
```

### Pattern 1: WorkspaceService -- File-System Workspace Manager
**What:** A service class managing the `~/.agentic/agentic.code-workspace` file.
**When to use:** Any operation that changes the repo list or folder scope.
**Key responsibilities:**
- Create/update the `.code-workspace` file
- Read current folder list from workspace file
- Sync workspace file folders with RepoConfigService data
- Detect if VS Code is currently in workspace mode
- Manage Explorer folder scope via `updateWorkspaceFolders()`

```typescript
// Source: @types/vscode/index.d.ts lines 13359-13391 (verified)
import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export class WorkspaceService {
  private readonly workspaceDir = path.join(os.homedir(), ".agentic");
  private readonly workspaceFilePath = path.join(this.workspaceDir, "agentic.code-workspace");

  constructor(private readonly repoConfigService: RepoConfigService) {}

  // Detect workspace mode:
  // vscode.workspace.workspaceFile is undefined when no workspace file is open
  // It returns a Uri when a .code-workspace file is open (or untitled: scheme for unsaved)
  isInWorkspaceMode(): boolean {
    const wf = vscode.workspace.workspaceFile;
    return wf !== undefined && wf.scheme === "file"
      && wf.fsPath.endsWith("agentic.code-workspace");
  }

  // Open workspace: uses vscode.openFolder command with workspace file URI
  // WARNING: This restarts the extension host!
  async promptReopenInWorkspace(): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      "Agentic workspace file created. Reopen VS Code in workspace mode?",
      "Reopen in Workspace",
      "Later"
    );
    if (action === "Reopen in Workspace") {
      await vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.file(this.workspaceFilePath)
      );
    }
  }

  // Scope management: centralized updateWorkspaceFolders
  setExplorerScope(
    mode: "global" | { repo: string } | { repo: string; agent: string; worktreePath: string }
  ): void {
    const currentCount = vscode.workspace.workspaceFolders?.length ?? 0;
    if (mode === "global") {
      const repos = this.repoConfigService.getAll();
      vscode.workspace.updateWorkspaceFolders(
        0,
        currentCount,
        ...repos.map(r => ({ uri: vscode.Uri.file(r.path), name: path.basename(r.path) }))
      );
    } else if ("agent" in mode) {
      vscode.workspace.updateWorkspaceFolders(
        0,
        currentCount,
        { uri: vscode.Uri.file(mode.worktreePath) }
      );
    } else {
      vscode.workspace.updateWorkspaceFolders(
        0,
        currentCount,
        { uri: vscode.Uri.file(mode.repo), name: path.basename(mode.repo) }
      );
    }
  }
}
```

### Pattern 2: postMessage-Based DOM Patching
**What:** Extension sends JSON data via `webview.postMessage()`, webview JS patches DOM in-place.
**When to use:** Every data change after initial render.

```typescript
// Extension side (sidebar-provider.ts)
// Source: VS Code Webview API guide
refresh(): void {
  if (!this._view) return;
  if (!this._initialRenderDone) return;
  const data = this._buildDashboardData();
  this._view.webview.postMessage({ type: "update", data });
}

// Webview side (in getDashboardScript())
window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "update") {
    patchDashboard(message.data);
  }
});
```

### Pattern 3: Scope State Tracking
**What:** Track current Explorer scope mode to highlight active root button.
**When to use:** All navigation actions.

Three scope modes tracked as string state:
1. `"global"` -- all repo roots shown
2. `"repo:<repoPath>"` -- single repo root shown
3. `"agent:<repoPath>::<agentName>"` -- single agent worktree shown

The active scope is communicated to the webview via postMessage so the correct root button gets highlighted.

### Pattern 4: updateWorkspaceFolders with Name Override
**What:** When showing repo roots in Explorer, use `name` parameter for clean basenames.
**When to use:** Global root and per-repo root scope changes.

```typescript
// Source: @types/vscode/index.d.ts lines 13470-13479 (verified)
// updateWorkspaceFolders accepts { uri: Uri, name?: string }
vscode.workspace.updateWorkspaceFolders(
  0,
  vscode.workspace.workspaceFolders?.length ?? 0,
  ...repos.map(repo => ({
    uri: vscode.Uri.file(repo.path),
    name: path.basename(repo.path),  // Display "foo" not "/Users/x/code/foo"
  }))
);
```

### Pattern 5: Command Registration for Toolbar Button
**What:** Native VS Code toolbar button via package.json contributes.menus.
**When to use:** Global root button in sidebar toolbar.

```json
// Source: VS Code Extension Manifest spec (verified)
{
  "commands": [
    {
      "command": "vscode-agentic.rootGlobal",
      "title": "Show All Repos",
      "category": "Agentic",
      "icon": "$(root-folder)"
    }
  ],
  "menus": {
    "view/title": [
      {
        "command": "vscode-agentic.rootGlobal",
        "group": "navigation@1",
        "when": "view == vscode-agentic.agents"
      },
      {
        "command": "vscode-agentic.addRepo",
        "group": "navigation@2",
        "when": "view == vscode-agentic.agents"
      }
    ]
  }
}
```

Note: `group: "navigation@N"` controls ordering. `@1` appears left of `@2`. The existing `addRepo` entry currently has `"group": "navigation"` (no ordering suffix) and needs to be changed to `"navigation@2"`.

### Anti-Patterns to Avoid
- **Setting webview.html on every data change:** Causes full DOM teardown and rebuild, losing scroll position, focus state, CSS transitions, and timer intervals. Use postMessage + patch instead.
- **Calling updateWorkspaceFolders() multiple times without waiting:** The API docs explicitly state "it is not valid to call `updateWorkspaceFolders()` multiple times without waiting for `onDidChangeWorkspaceFolders()` to fire." All scope changes must be serialized.
- **Writing directly to workspaceFile:** The VS Code API explicitly warns against using `workspace.workspaceFile` to write config. Use `node:fs` for our own file and `workspace.getConfiguration().update()` for VS Code settings.
- **Creating workspace file at module level:** Services must be created in `activate()`, not at module scope. The workspace service follows the same pattern (established in Phase 01).
- **Replacing the `.dashboard` container during DOM patching:** Event delegation is attached to `.dashboard`. Replacing it breaks all click handlers. Only modify children inside it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace file format | Custom serialization | JSON.stringify with `folders` + `settings` keys | `.code-workspace` is just JSON with a specific shape |
| Opening workspace | Custom window management | `vscode.commands.executeCommand("vscode.openFolder", uri)` | Built-in command handles extension restart gracefully |
| Workspace mode detection | Heuristic checks | `vscode.workspace.workspaceFile` property | Returns undefined when not in workspace mode, Uri otherwise |
| Folder display names | Parsing paths in UI | `name` parameter in `updateWorkspaceFolders` | VS Code renders the name in Explorer automatically |
| Toolbar button placement | Custom HTML buttons | `package.json` `view/title` menu contributions | VS Code renders toolbar buttons with correct styling |
| File write serialization | Custom lock implementation | Promise-chain mutex (already in WorktreeService) | Prevents race conditions on concurrent writes |

**Key insight:** When VS Code is in workspace mode (a `.code-workspace` file is open), `updateWorkspaceFolders()` automatically syncs changes to the workspace file. This means scope changes that use `updateWorkspaceFolders()` will automatically persist to the file -- the workspace file serves as both a naming mechanism ("agentic" title bar) and as a persistent scope store. We still need to manually write the file for the initial creation and when repos are added/removed outside of scope changes.

## Common Pitfalls

### Pitfall 1: Extension Restart on vscode.openFolder and First Workspace Folder Change
**What goes wrong:** Calling `vscode.openFolder` to open the workspace file, or calling `updateWorkspaceFolders()` when transitioning from empty/single-folder to multi-folder workspace, causes extension host restart.
**Why it happens:** `vscode.openFolder` shuts down and restarts the extension host. Additionally, VS Code restarts extensions when the deprecated `rootPath` property needs updating.
**How to avoid:** Design `activate()` to be idempotent -- read state from globalState and workspace file on every activation. Do NOT rely on in-memory state surviving restarts. Show clear messaging for the one-time workspace reopen.
**Warning signs:** State is lost after adding first repo, commands stop working after opening workspace file.

### Pitfall 2: Workspace File Race Conditions
**What goes wrong:** Multiple rapid operations (add repo, remove repo, scope change) write to the workspace file concurrently, corrupting it.
**Why it happens:** `node:fs` writes are async and uncoordinated.
**How to avoid:** Use the promise-chain mutex pattern already established in `WorktreeService` for per-repo locks. All workspace file writes go through a single serialized path.
**Warning signs:** JSON parse errors when reading workspace file, missing folders.

### Pitfall 3: postMessage Before Webview Is Ready
**What goes wrong:** Extension sends `postMessage()` before webview script has registered its `window.addEventListener('message', ...)`.
**Why it happens:** `resolveWebviewView()` sets HTML, but the script hasn't executed yet when the first `onDidChange` fires.
**How to avoid:** Use the `_initialRenderDone` flag pattern. The first render always sets full HTML. Only subsequent refreshes use postMessage. The flag is set after `resolveWebviewView()` completes HTML assignment. If `refresh()` is called before the flag is set, it returns as no-op.
**Warning signs:** First agent creation doesn't appear in sidebar until a second change triggers refresh.

### Pitfall 4: DOM Patching Loses Event Listeners
**What goes wrong:** Replacing DOM elements with `innerHTML` or `replaceChild` removes event listeners attached to those elements.
**Why it happens:** Event delegation on the `.dashboard` container should survive, but if patching code replaces the container itself, delegation breaks.
**How to avoid:** Never replace the `.dashboard` container. Only modify children. The existing event delegation pattern (single listener on `.dashboard`) is robust -- DOM patching just needs to update content within that container.
**Warning signs:** Clicking tiles or buttons stops working after first data update.

### Pitfall 5: Workspace File Path Portability
**What goes wrong:** Workspace file contains absolute paths that break on another machine.
**Why it happens:** User's home directory and repo paths differ between machines.
**How to avoid:** This is inherent -- absolute paths are required by the workspace format. Document that the user needs to update paths when moving the workspace file. The workspace file primarily serves as a naming mechanism ("agentic" title bar) and scope persistence, not as a fully portable config.
**Warning signs:** "Folder not found" errors after moving workspace file to another machine.

### Pitfall 6: CSS Transitions on New Elements
**What goes wrong:** Fade-in animations don't play on newly inserted DOM elements.
**Why it happens:** Browser batches DOM mutations. If you insert an element with `opacity: 1`, no transition occurs because there's no state change.
**How to avoid:** Insert element with initial hidden state (`opacity: 0`), force a layout reflow via double `requestAnimationFrame` nesting, then set target state (`opacity: 1`). The double-rAF ensures the browser has committed the initial state before starting the transition.
**Warning signs:** New tiles appear instantly instead of fading in.

### Pitfall 7: Config.json vs GlobalState Mismatch
**What goes wrong:** CONTEXT.md references `~/.agentic/config.json` for repo storage, but the current codebase uses VS Code `globalState` (Memento).
**Why it happens:** The context session envisioned a filesystem-based config, but existing implementation uses VS Code's built-in persistence.
**How to avoid:** The workspace file should reference repos from `RepoConfigService.getAll()` (which reads globalState), not from a separate `config.json`. The workspace file's `folders` array is the "portable" representation. No `config.json` file exists in the current architecture.
**Warning signs:** Repos in workspace file don't match repos in extension.

### Pitfall 8: Existing Test Modifications
**What goes wrong:** Plans modify function signatures (e.g., adding `workspaceService` parameter to `registerAgentCommands`), breaking existing tests.
**Why it happens:** Tests create mocks matching the current function signature. When a new parameter is added, all test call sites need updating.
**How to avoid:** When modifying a function signature, immediately update all corresponding test files. The test suite currently has 214 tests across 15 files. Key test files that will need signature updates: `agent.commands.test.ts` (22 tests), `repo.commands.test.ts` (4 tests), `extension.test.ts` (3 tests), `sidebar-provider.test.ts` (11 tests).
**Warning signs:** Test failures on unrelated tests after a function signature change.

## Code Examples

Verified patterns from official sources:

### Example 1: .code-workspace File Format
```json
// Source: VS Code official docs - Multi-root Workspaces
// File: ~/.agentic/agentic.code-workspace
{
  "folders": [
    {
      "path": "/Users/norules/code/my-project",
      "name": "my-project"
    },
    {
      "path": "/Users/norules/code/another-repo",
      "name": "another-repo"
    }
  ],
  "settings": {}
}
```

Title bar displays: **agentic (Workspace)** -- derived from filename `agentic.code-workspace`.

### Example 2: Detecting Workspace Mode
```typescript
// Source: @types/vscode/index.d.ts lines 13359-13391 (verified locally)
function isInAgenticWorkspace(): boolean {
  const wf = vscode.workspace.workspaceFile;
  if (!wf || wf.scheme !== "file") return false;
  return wf.fsPath.endsWith("agentic.code-workspace");
}
```

### Example 3: Opening Workspace File
```typescript
// Source: VS Code Built-in Commands docs (verified)
// WARNING: This restarts the extension host!
await vscode.commands.executeCommand(
  "vscode.openFolder",
  vscode.Uri.file(path.join(os.homedir(), ".agentic", "agentic.code-workspace"))
);
```

### Example 4: updateWorkspaceFolders Full Replace Pattern
```typescript
// Source: @types/vscode/index.d.ts lines 13470-13479 (verified locally)
// Replace ALL workspace folders with new set
const currentCount = vscode.workspace.workspaceFolders?.length ?? 0;
vscode.workspace.updateWorkspaceFolders(
  0,
  currentCount,
  { uri: vscode.Uri.file("/path/to/repo"), name: "repo" }
);
```

### Example 5: Webview Message Receiver (DOM Patching)
```javascript
// Source: VS Code Webview API guide (verified)
// In getDashboardScript()
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "update") {
    const { repos, scope } = msg.data;
    patchRepoSections(repos);
    updateScopeHighlight(scope);
  }
});

function patchRepoSections(repos) {
  const dashboard = document.querySelector(".dashboard");
  const existingSections = new Map();
  dashboard.querySelectorAll(".repo-section").forEach(s => {
    existingSections.set(s.dataset.repoPath, s);
  });

  for (const repo of repos) {
    const existing = existingSections.get(repo.path);
    if (existing) {
      patchAgentTiles(existing, repo.agents);
      existingSections.delete(repo.path);
    } else {
      // New repo -- create and animate in
      const section = createRepoSection(repo);
      section.style.opacity = "0";
      dashboard.appendChild(section);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { section.style.opacity = "1"; });
      });
    }
  }

  // Remove sections for deleted repos
  for (const [, section] of existingSections) {
    section.style.opacity = "0";
    section.addEventListener("transitionend", () => section.remove());
  }
}
```

### Example 6: CSS Transitions for Smooth Rendering
```css
/* Tile enter/exit animations (Claude's Discretion: 0.2s ease) */
.agent-tile {
  transition: opacity 0.2s ease, transform 0.2s ease, border-color 0.15s ease;
}

.agent-tile.entering {
  opacity: 0;
  transform: translateY(-8px);
}

.agent-tile.exiting {
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
}

/* Status icon crossfade */
.status-icon {
  transition: opacity 0.15s ease;
}

/* Repo section enter/exit */
.repo-section {
  transition: opacity 0.2s ease;
}

/* Root button active highlight */
.repo-action-btn.scope-active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 4px;
}
```

### Example 7: Package.json Toolbar Button Configuration
```json
// Source: VS Code Extension Manifest (package.json contributes.menus)
{
  "commands": [
    {
      "command": "vscode-agentic.rootGlobal",
      "title": "Show All Repos",
      "category": "Agentic",
      "icon": "$(root-folder)"
    },
    {
      "command": "vscode-agentic.rootRepo",
      "title": "Show Repo Root",
      "category": "Agentic",
      "icon": "$(root-folder)"
    }
  ],
  "menus": {
    "view/title": [
      {
        "command": "vscode-agentic.rootGlobal",
        "group": "navigation@1",
        "when": "view == vscode-agentic.agents"
      },
      {
        "command": "vscode-agentic.addRepo",
        "group": "navigation@2",
        "when": "view == vscode-agentic.agents"
      }
    ],
    "commandPalette": [
      {
        "command": "vscode-agentic.rootGlobal",
        "when": "false"
      },
      {
        "command": "vscode-agentic.rootRepo",
        "when": "false"
      }
    ]
  }
}
```

### Example 8: WorkspaceService ensureWorkspaceFile
```typescript
// Workspace file creation with directory safety
async ensureWorkspaceFile(): Promise<boolean> {
  const repos = this.repoConfigService.getAll();
  if (repos.length === 0) return false;  // Don't create empty workspace

  await fs.mkdir(this.workspaceDir, { recursive: true });

  const workspaceData = {
    folders: repos.map(r => ({
      path: r.path,
      name: path.basename(r.path),
    })),
    settings: {},
  };

  let isNew = false;
  try {
    await fs.access(this.workspaceFilePath);
  } catch {
    isNew = true;
  }

  await fs.writeFile(
    this.workspaceFilePath,
    JSON.stringify(workspaceData, null, 2),
    "utf-8"
  );
  return isNew;
}
```

### Example 9: Existing Codebase -- focusAgent Current Implementation (to be refactored)
```typescript
// CURRENT: Direct updateWorkspaceFolders call in agent.commands.ts
// This needs to be replaced with WorkspaceService.setExplorerScope()
const focusAgent = vscode.commands.registerCommand(
  "vscode-agentic.focusAgent",
  async (repoPath: string, agentName: string) => {
    await agentService.focusAgent(repoPath, agentName);
    const manifest = worktreeService.getManifest(repoPath);
    const worktreeEntry = manifest.find((w) => w.agentName === agentName);
    if (worktreeEntry) {
      vscode.workspace.updateWorkspaceFolders(
        0,
        vscode.workspace.workspaceFolders?.length ?? 0,
        { uri: vscode.Uri.file(worktreeEntry.path) },
      );
    }
  },
);

// AFTER: Replace with WorkspaceService call
// workspaceService.setExplorerScope({
//   repo: repoPath,
//   agent: agentName,
//   worktreePath: worktreeEntry.path,
// });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `webview.html = newHtml` on every change | `webview.postMessage()` + DOM patching | This phase | Eliminates flicker, preserves scroll/focus, enables animations |
| Single agent focus only | Three scope modes (global/repo/agent) | This phase | Users can navigate repo roots without losing sidebar context |
| No workspace file | `agentic.code-workspace` auto-managed | This phase | "Agentic" title bar, scope persistence across restarts |
| repos in globalState only | repos also reflected in workspace file | This phase | Workspace file becomes portable reference |
| Direct updateWorkspaceFolders in commands | Centralized WorkspaceService.setExplorerScope | This phase | Single place for all scope changes, consistent behavior |

**Deprecated/outdated:**
- The `rootPath` workspace property is deprecated. VS Code restarts extensions when transitioning folder states to update it. This is why `updateWorkspaceFolders()` can cause extension restarts in edge cases.

## Open Questions

1. **Config.json vs GlobalState for repo storage**
   - What we know: CONTEXT.md mentions `~/.agentic/config.json` as source of truth for repos, but current code uses `context.globalState` with `REPO_CONFIGS_KEY`
   - What's unclear: The `config.json` file does not exist. The user's mental model references it, but the architecture uses globalState.
   - Recommendation: Keep globalState as the primary store (it works, it's already built). The `.code-workspace` file's `folders` array is synced FROM globalState, not the other way around. This avoids a filesystem migration and keeps things simple.

2. **Workspace file creation timing (Claude's Discretion)**
   - What we know: CONTEXT.md says "on first extension activation"
   - What's unclear: What if no repos are configured yet? An empty workspace file is valid but pointless.
   - Recommendation: Create the workspace file on `activate()` if repos exist. If no repos, create it on first `addRepo`. This avoids prompting the user to reopen VS Code before they have any repos configured.

3. **Extension restart on vscode.openFolder**
   - What we know: `vscode.openFolder` shuts down the extension host and restarts
   - What's unclear: Can we seamlessly transition without user losing their work?
   - Recommendation: Show clear messaging ("Reopen in Workspace" notification). The restart is fast (~1-2s) and all state is in globalState, so nothing is lost. This is a one-time operation.

4. **Per-repo root button: webview button vs native toolbar**
   - What we know: Global root goes in `view/title` (native toolbar). Per-repo root is inside the webview HTML.
   - Recommendation: Per-repo root is a webview button inside each `repo-header` div, left of the create-agent button. This matches the CONTEXT.md specification of "in each repo header." The global root is the only native toolbar button.

5. **updateWorkspaceFolders auto-sync to .code-workspace**
   - What we know: When VS Code is in workspace mode, folder changes are automatically written to the `.code-workspace` file by VS Code itself.
   - What's unclear: Exact timing of the auto-sync (immediate or batched).
   - Recommendation: Rely on auto-sync for scope changes during active session. Still write the file manually on initial creation and when repos are added/removed (for cases where the workspace hasn't been opened yet).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |
| Current test count | 214 tests across 15 files |
| Estimated runtime | ~0.5 seconds |

### Phase Requirements --> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-01 | Workspace file created at ~/.agentic/agentic.code-workspace | unit | `npx vitest run test/unit/workspace.service.test.ts -t "creates workspace file"` | No -- Wave 0 |
| WS-02 | Workspace file folders array matches configured repos | unit | `npx vitest run test/unit/workspace.service.test.ts -t "syncs folders"` | No -- Wave 0 |
| WS-03 | Detect workspace mode via workspace.workspaceFile | unit | `npx vitest run test/unit/workspace.service.test.ts -t "detects workspace"` | No -- Wave 0 |
| WS-04 | Prompt to reopen in workspace shown | unit | `npx vitest run test/unit/workspace.service.test.ts -t "prompt reopen"` | No -- Wave 0 |
| ROOT-01 | Global root command sets all repo roots as workspace folders | unit | `npx vitest run test/unit/workspace.commands.test.ts -t "global root"` | No -- Wave 0 |
| ROOT-02 | Per-repo root command sets single repo root | unit | `npx vitest run test/unit/workspace.commands.test.ts -t "repo root"` | No -- Wave 0 |
| ROOT-03 | Root buttons appear in UI with codicon-root-folder | unit | `npx vitest run test/unit/sidebar-html.test.ts -t "root-folder"` | No -- Wave 0 |
| RENDER-01 | refresh() sends postMessage for subsequent updates | unit | `npx vitest run test/unit/sidebar-provider.test.ts -t "postMessage"` | No -- Wave 0 |
| RENDER-02 | Initial render uses full HTML | unit | `npx vitest run test/unit/sidebar-provider.test.ts -t "initial render"` | Partial (existing tests cover initial HTML) |
| SCOPE-01 | focusAgent scope changes update workspace folders | unit | `npx vitest run test/unit/agent.commands.test.ts -t "updateWorkspaceFolders"` | Yes (existing) |
| SCOPE-02 | Scope changes sync to workspace file | unit | `npx vitest run test/unit/workspace.service.test.ts -t "scope sync"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/unit/workspace.service.test.ts` -- covers WS-01, WS-02, WS-03, WS-04, SCOPE-02
- [ ] `test/unit/workspace.commands.test.ts` -- covers ROOT-01, ROOT-02
- [ ] Update `test/unit/sidebar-html.test.ts` -- covers ROOT-03 (add tests for root-folder button in repo header)
- [ ] Update `test/unit/sidebar-provider.test.ts` -- covers RENDER-01, RENDER-02 (refactor tests for postMessage behavior)
- [ ] Update `test/__mocks__/vscode.ts` -- add `workspace.workspaceFile` mock property
- [ ] Update `test/unit/agent.commands.test.ts` -- update for new `workspaceService` parameter in `registerAgentCommands`
- [ ] Update `test/unit/repo.commands.test.ts` -- update for new `workspaceService` parameter in `registerRepoCommands`
- [ ] Update `test/unit/extension.test.ts` -- verify WorkspaceService creation and wiring

## Sources

### Primary (HIGH confidence)
- `@types/vscode/index.d.ts` (local, lines 13359-13479) -- `workspaceFile`, `updateWorkspaceFolders`, `workspaceFolders`, `onDidChangeWorkspaceFolders` exact signatures verified
- [VS Code Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview) -- postMessage patterns, acquireVsCodeApi, state management
- [VS Code Built-in Commands](https://code.visualstudio.com/api/references/commands) -- `vscode.openFolder` with workspace file URI
- [VS Code Workspaces Documentation](https://code.visualstudio.com/docs/editor/workspaces) -- `.code-workspace` file format, naming behavior
- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api) -- workspace namespace full documentation

### Secondary (MEDIUM confidence)
- [VS Code Multi-root Workspaces](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces) -- folders array with `name` property, workspace file settings
- [Adopting Multi Root Workspace APIs](https://github.com/microsoft/vscode/wiki/Adopting-Multi-Root-Workspace-APIs) -- workspace mode detection patterns
- [vscode.openFolder discussion](https://github.com/microsoft/vscode-discussions/discussions/1263) -- confirms extension host restart behavior

### Tertiary (LOW confidence)
- Title bar naming behavior -- verified via multiple community reports that filename of `.code-workspace` file becomes the workspace name. No official API to set a custom name independently of the filename.
- `updateWorkspaceFolders` auto-sync to `.code-workspace` -- community-verified behavior, not explicitly documented in official API docs. When VS Code is in workspace mode, folder changes are persisted to the workspace file automatically.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all APIs verified from @types/vscode type definitions in node_modules, no new dependencies
- Architecture: HIGH -- patterns follow existing codebase conventions (services in activate, event delegation, pure render functions, TDD pattern)
- Pitfalls: HIGH -- extension restart behavior verified in official docs, DOM patching patterns well-established, race condition patterns already solved in project
- Workspace naming: MEDIUM -- title bar derives from filename (community-verified, no official API doc for this specific behavior)
- Auto-sync behavior: MEDIUM -- `updateWorkspaceFolders` auto-persists to workspace file when in workspace mode (community-verified)

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (VS Code API is stable, patterns are well-established)
