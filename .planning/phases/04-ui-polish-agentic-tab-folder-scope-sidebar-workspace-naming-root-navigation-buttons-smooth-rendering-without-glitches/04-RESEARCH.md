# Phase 4: UI Polish - Research

**Researched:** 2026-03-07
**Domain:** VS Code Webview UI, Workspace API, DOM Patching
**Confidence:** HIGH

## Summary

This phase adds four complementary features to the existing sidebar dashboard: (1) workspace file management so VS Code shows "agentic" in the title bar, (2) root navigation buttons for global and per-repo folder scoping, (3) message-based DOM patching to eliminate rendering glitches from full HTML replacement, and (4) Explorer folder scope management across all navigation actions.

All four features build directly on existing code. The sidebar provider already has `refresh()` (HTML replacement), `focusAgent` already calls `updateWorkspaceFolders()`, and the webview already uses `postMessage` from webview-to-extension. The new work inverts the message direction (extension-to-webview) and adds filesystem operations for the `.code-workspace` file.

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
- Scope changes sync to the .code-workspace file (persists across restarts)
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

**Recommendation (Claude's Discretion - DOM diffing):** Use manual DOM patching, not a library. The data shape is simple (flat list of repos, each with flat list of agents), and the update operations are well-defined (add/remove tiles, update text/classes). A library adds dependency weight for a problem that is solved in ~60 lines of targeted JS.

## Architecture Patterns

### New File Structure
```
src/
  services/
    workspace.service.ts     # NEW: .code-workspace file management
  commands/
    workspace.commands.ts    # NEW: rootGlobal, rootRepo commands
    agent.commands.ts        # MODIFIED: scope sync on focusAgent
    repo.commands.ts         # MODIFIED: sync workspace file on add/remove
  views/
    sidebar-provider.ts      # MODIFIED: postMessage instead of HTML replacement
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

```typescript
// Source: VS Code API types (verified from @types/vscode/index.d.ts)
import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export class WorkspaceService {
  private readonly workspaceDir = path.join(os.homedir(), ".agentic");
  private readonly workspaceFilePath = path.join(this.workspaceDir, "agentic.code-workspace");

  // Detect workspace mode:
  // vscode.workspace.workspaceFile is undefined when no workspace file is open
  // It returns a Uri when a .code-workspace file is open (or untitled: scheme for unsaved)
  isInWorkspaceMode(): boolean {
    const wf = vscode.workspace.workspaceFile;
    return wf !== undefined && wf.scheme === "file";
  }

  // Open workspace: uses vscode.openFolder command with workspace file URI
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
}
```

### Pattern 2: postMessage-Based DOM Patching
**What:** Extension sends JSON data via `webview.postMessage()`, webview JS patches DOM in-place.
**When to use:** Every data change after initial render.

```typescript
// Extension side (sidebar-provider.ts)
refresh(): void {
  if (!this._view) return;
  const data = this._buildDashboardData();
  // First render: set full HTML. Subsequent: send data message.
  if (this._initialRenderDone) {
    this._view.webview.postMessage({ type: "update", data });
  } else {
    this._view.webview.html = this._getHtml(this._view.webview);
    this._initialRenderDone = true;
  }
}

// Webview side (in getDashboardScript())
// Source: VS Code Webview API guide
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

Three scope modes tracked as enum-like state:
1. `"global"` -- all repo roots shown
2. `"repo:<repoPath>"` -- single repo root shown
3. `"agent:<repoPath>::<agentName>"` -- single agent worktree shown

The active scope is communicated to the webview via postMessage so the correct root button gets highlighted.

### Pattern 4: updateWorkspaceFolders with Name Override
**What:** When showing repo roots in Explorer, use `name` parameter for clean basenames.
**When to use:** Global root and per-repo root scope changes.

```typescript
// Source: @types/vscode/index.d.ts line 13470-13479 (verified)
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

### Anti-Patterns to Avoid
- **Setting webview.html on every data change:** Causes full DOM teardown and rebuild, losing scroll position, focus state, CSS transitions, and timer intervals. Use postMessage + patch instead.
- **Calling updateWorkspaceFolders() multiple times without waiting:** The API docs state it is not valid to call this multiple times without waiting for `onDidChangeWorkspaceFolders()` to fire. All scope changes must be serialized.
- **Writing directly to workspaceFile:** The VS Code API explicitly warns against using `workspace.workspaceFile` to write config. Use `node:fs` for our own file and `workspace.getConfiguration().update()` for VS Code settings.
- **Creating workspace file at module level:** Services must be created in `activate()`, not at module scope. The workspace service follows the same pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace file format | Custom serialization | JSON.stringify with `folders` + `settings` keys | `.code-workspace` is just JSON with a specific shape |
| Opening workspace | Custom window management | `vscode.commands.executeCommand("vscode.openFolder", uri)` | Built-in command handles extension restart gracefully |
| Workspace mode detection | Heuristic checks | `vscode.workspace.workspaceFile` property | Returns undefined when not in workspace mode, Uri otherwise |
| Folder display names | Parsing paths in UI | `name` parameter in `updateWorkspaceFolders` | VS Code renders the name in Explorer automatically |
| Toolbar button placement | Custom HTML buttons | `package.json` `view/title` menu contributions | VS Code renders toolbar buttons with correct styling |

**Key insight:** The workspace file is plain JSON that VS Code watches. `updateWorkspaceFolders()` automatically syncs changes to the `.code-workspace` file when VS Code is in workspace mode. This means scope changes that use `updateWorkspaceFolders()` will automatically persist to the file -- no need to manually write the file on every scope change.

## Common Pitfalls

### Pitfall 1: Extension Restart on First Workspace Folder Change
**What goes wrong:** Calling `updateWorkspaceFolders()` when transitioning from empty/single-folder to multi-folder workspace causes extension host restart.
**Why it happens:** VS Code restarts extensions to update the deprecated `rootPath` property.
**How to avoid:** When the user opens the workspace file via `vscode.openFolder`, the extension will restart. Design `activate()` to be idempotent -- read state from globalState and workspace file on every activation. Do NOT rely on in-memory state surviving restarts.
**Warning signs:** State is lost after adding first repo, commands stop working.

### Pitfall 2: Workspace File Race Conditions
**What goes wrong:** Multiple rapid operations (add repo, remove repo, scope change) write to the workspace file concurrently, corrupting it.
**Why it happens:** `node:fs` writes are async and uncoordinated.
**How to avoid:** Use the promise-chain mutex pattern already established in `WorktreeService` for per-repo locks. All workspace file writes go through a single serialized path.
**Warning signs:** JSON parse errors when reading workspace file, missing folders.

### Pitfall 3: postMessage Before Webview Is Ready
**What goes wrong:** Extension sends `postMessage()` before webview script has registered its `window.addEventListener('message', ...)`.
**Why it happens:** `resolveWebviewView()` sets HTML, but the script hasn't executed yet when the first `onDidChange` fires.
**How to avoid:** Use the `_initialRenderDone` flag pattern. The first render always sets full HTML. Only subsequent refreshes use postMessage. Alternatively, have the webview send a "ready" message and buffer updates until received.
**Warning signs:** First agent creation doesn't appear in sidebar until a second change triggers refresh.

### Pitfall 4: DOM Patching Loses Event Listeners
**What goes wrong:** Replacing DOM elements with `innerHTML` or `replaceChild` removes event listeners attached to those elements.
**Why it happens:** Event delegation on the `.dashboard` container should survive, but if patching code replaces the container itself, delegation breaks.
**How to avoid:** Never replace the `.dashboard` container. Only modify children. The existing event delegation pattern (single listener on `.dashboard`) is robust -- DOM patching just needs to update content within that container.
**Warning signs:** Clicking tiles or buttons stops working after first data update.

### Pitfall 5: Workspace File Path Portability
**What goes wrong:** Workspace file contains absolute paths that break on another machine.
**Why it happens:** User's home directory and repo paths differ between machines.
**How to avoid:** This is inherent -- absolute paths are required by the workspace format. Document that the user needs to update paths when moving the workspace file. The workspace file primarily serves as a naming mechanism ("agentic" title bar) and scope persistence, not as a portable config.
**Warning signs:** "Folder not found" errors after moving workspace file to another machine.

### Pitfall 6: CSS Transitions on New Elements
**What goes wrong:** Fade-in animations don't play on newly inserted DOM elements.
**Why it happens:** Browser batches DOM mutations. If you insert an element with `opacity: 1`, no transition occurs because there's no state change.
**How to avoid:** Insert element with `opacity: 0`, force a reflow (read `offsetHeight`), then set `opacity: 1`. Or use `requestAnimationFrame` double-nesting.
**Warning signs:** New tiles appear instantly instead of fading in.

### Pitfall 7: Config.json vs GlobalState Mismatch
**What goes wrong:** CONTEXT.md references `~/.agentic/config.json` for repo storage, but the current codebase uses VS Code `globalState` (Memento).
**Why it happens:** The context session envisioned a filesystem-based config, but existing implementation uses VS Code's built-in persistence.
**How to avoid:** The workspace file should reference repos from `RepoConfigService.getAll()` (which reads globalState), not from a separate `config.json`. The workspace file's `folders` array is the "portable" representation.
**Warning signs:** Repos in workspace file don't match repos in extension.

## Code Examples

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
// Source: @types/vscode/index.d.ts lines 13360-13391 (verified)
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
// Source: @types/vscode/index.d.ts lines 13470-13479 (verified)
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
/* Tile enter/exit animations */
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
.root-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
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

Note: The `group: "navigation@N"` pattern controls ordering. `@1` appears left of `@2`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `webview.html = newHtml` on every change | `webview.postMessage()` + DOM patching | This phase | Eliminates flicker, preserves scroll/focus, enables animations |
| Single agent focus only | Three scope modes (global/repo/agent) | This phase | Users can navigate repo roots without losing sidebar context |
| No workspace file | `agentic.code-workspace` auto-managed | This phase | "Agentic" title bar, scope persistence across restarts |
| repos in globalState only | repos also reflected in workspace file | This phase | Workspace file becomes portable reference |

## Open Questions

1. **Config.json vs GlobalState for repo storage**
   - What we know: CONTEXT.md mentions `~/.agentic/config.json` as source of truth for repos, but current code uses `context.globalState` with `REPO_CONFIGS_KEY`
   - What's unclear: Should we migrate repo config to filesystem, or treat the workspace file as the "portable" representation of globalState data?
   - Recommendation: Keep globalState as the primary store (it works, it's already built). The `.code-workspace` file's `folders` array is synced FROM globalState, not the other way around. This avoids a filesystem migration and keeps things simple. The workspace file gives portability without changing the data layer.

2. **Workspace file creation timing**
   - What we know: CONTEXT.md says "on first extension activation"
   - What's unclear: What if no repos are configured yet? An empty workspace file is valid but pointless.
   - Recommendation (Claude's Discretion): Create the workspace file on `activate()` if repos exist. If no repos, create it on first `addRepo`. This avoids prompting the user to reopen VS Code before they have any repos configured.

3. **Extension restart on vscode.openFolder**
   - What we know: `vscode.openFolder` shuts down the extension host and restarts
   - What's unclear: Can we seamlessly transition without user losing their work?
   - Recommendation: Show clear messaging ("Reopen in Workspace" notification). The restart is fast (~1-2s) and all state is in globalState, so nothing is lost. This is a one-time operation.

4. **Per-repo root button in webview vs native toolbar**
   - What we know: Global root goes in `view/title` (native toolbar). Per-repo root is inside the webview HTML.
   - What's unclear: Should per-repo root also be a toolbar button (limited to one) or inline in the webview repo header?
   - Recommendation: Per-repo root is a webview button inside each repo-header div, left of the create-agent button. This matches the CONTEXT.md specification of "in each repo header."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

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
- [ ] Update `test/unit/sidebar-html.test.ts` -- covers ROOT-03
- [ ] Update `test/unit/sidebar-provider.test.ts` -- covers RENDER-01, RENDER-02
- [ ] Update `test/__mocks__/vscode.ts` -- add `workspace.workspaceFile` mock property

## Sources

### Primary (HIGH confidence)
- `@types/vscode/index.d.ts` (local, lines 13360-13479) -- `workspaceFile`, `updateWorkspaceFolders` exact signatures verified
- [VS Code Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview) -- postMessage patterns, acquireVsCodeApi, state management
- [VS Code Built-in Commands](https://code.visualstudio.com/api/references/commands) -- `vscode.openFolder` with workspace file URI
- [VS Code Workspaces Documentation](https://code.visualstudio.com/docs/editing/workspaces/workspaces) -- `.code-workspace` file format, naming behavior

### Secondary (MEDIUM confidence)
- [VS Code Multi-root Workspaces](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces) -- folders array with `name` property, workspace file settings
- [Adopting Multi Root Workspace APIs](https://github.com/microsoft/vscode/wiki/Adopting-Multi-Root-Workspace-APIs) -- workspace mode detection patterns
- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api) -- updateWorkspaceFolders full documentation

### Tertiary (LOW confidence)
- Title bar naming behavior -- verified via multiple community reports that filename of `.code-workspace` file becomes the workspace name. No official API to set a custom name independently of the filename.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all APIs verified from @types/vscode type definitions in node_modules
- Architecture: HIGH -- patterns follow existing codebase conventions (services in activate, event delegation, pure render functions)
- Pitfalls: HIGH -- extension restart behavior verified in official docs, DOM patching patterns well-established
- Workspace naming: MEDIUM -- title bar derives from filename (community-verified, no official API doc for this specific behavior)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (VS Code API is stable, patterns are well-established)
