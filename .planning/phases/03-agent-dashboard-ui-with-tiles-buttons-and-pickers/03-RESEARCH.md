# Phase 3: Agent Dashboard UI with Tiles, Buttons, and Pickers - Research

**Researched:** 2026-03-06
**Domain:** VS Code Webview Views (Sidebar), HTML/CSS Dashboard, Extension-to-Webview Messaging
**Confidence:** HIGH

## Summary

Phase 3 replaces the placeholder TreeView sidebar with a full Webview-based dashboard that displays agent tiles, repo sections, and action buttons. The VS Code `WebviewViewProvider` API is mature and well-documented -- the key pattern is registering a `type: "webview"` view in `package.json`, implementing `resolveWebviewView()` to render HTML with embedded CSS/JS, and using `postMessage`/`onDidReceiveMessage` for bidirectional communication between the extension host and the webview.

The primary technical challenge is the event-driven refresh pattern: when agent status changes (via `TerminalService` callbacks), the webview provider must push updated HTML or data to the webview. This requires adding a `vscode.EventEmitter` to `AgentService` so the webview provider can subscribe to data changes. The webview itself uses VS Code theme CSS variables (`--vscode-*`) for automatic dark/light theme adaptation, and `@vscode/codicons` for icons. Since the Webview UI Toolkit was deprecated January 2025, all UI components are plain HTML/CSS -- no component library needed for this use case (cards, buttons, text).

**Primary recommendation:** Implement a `SidebarViewProvider` class that implements `WebviewViewProvider`, listens to `AgentService` change events, and regenerates/posts updated dashboard HTML. Use `@vscode/codicons` for status icons with a custom CSS `@keyframes spin` animation for the running spinner. Keep the webview stateless (no `retainContextWhenHidden`) -- re-render full HTML on each data change since the data set is small.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Webview panel in the sidebar (not TreeView) for full custom HTML/CSS card layout
- Replaces the placeholder TreeView registered in package.json (`vscode-agentic.agents`)
- Uses VS Code theme CSS variables for all colors (`--vscode-editor-background`, `--vscode-panel-border`, `--vscode-foreground`, etc.) -- automatically adapts to dark/light themes
- Tile content: agent name, status icon (animated spinner/wave hand/checkmark/cross), repo name, elapsed time (live-updating), initial prompt (truncated), diff indicator (placeholder), context usage (placeholder), RAM usage (placeholder), exit code on error
- Tile action buttons always visible, disabled at opacity 0.7: Stop, Reset Changes, Delete, Clear Context
- Entire tile clickable for focusAgent
- Single scrollable Webview panel with repo sections stacked vertically, each collapsible
- Panel toolbar: "Add Repo" icon button in title bar
- Repo header bar: repo name, active/inactive indicator, [+] create agent, [gear] settings, [x] remove repo
- Agents sorted by creation order within each repo section
- Per-repo `+` button triggers existing createAgent command flow
- Add Repo button calls existing addRepo command

### Claude's Discretion

- Webview HTML/CSS structure and card styling details
- Exact icon choices (codicons, SVGs, or emoji for status indicators)
- Animation implementation for the running spinner
- Timer update interval optimization (1s vs less frequent)
- Message passing protocol between webview and extension host
- How to handle webview state persistence on panel hide/show

### Deferred Ideas (OUT OF SCOPE)

- Auto-inactive repo after 1h of no clicks and no active agents
- Actual context usage from Claude Code
- Actual RAM/CPU monitoring per agent process
- Actual diff counts vs staging branch (Phase 4)
- Clear Context terminal write (`/clear` command)
- Reset Changes git operation (`git checkout .`)
- Repo settings dialog UI (the gear button -- settings editing interface, not just the button)

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Right sidebar shows agent tiles in a Webview grouped by repository | WebviewViewProvider API, `type: "webview"` in package.json, repo sections with collapsible headers |
| UI-02 | Each agent tile displays name, repo, and current status indicator | Codicon icons for status, CSS theme variables for styling, tile card HTML structure |
| UI-03 | Clicking any agent tile replaces Explorer workspace folders with only that agent's worktree folder | `vscode.workspace.updateWorkspaceFolders()` API called from focusAgent command handler |
| UI-04 | Clicking an agent tile switches full VS Code context -- Explorer, editor, terminal | Existing `focusAgent` command wires terminal focus; workspace folder switching adds Explorer/editor context |
| UI-06 | All interactions through sidebar UI -- no Command Palette entries | Already implemented in Phase 2 (commands hidden via `when: false`); sidebar buttons invoke via `vscode.commands.executeCommand()` |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vscode` (API) | ^1.96.0 | WebviewViewProvider, EventEmitter, commands | Built-in VS Code extension API -- the only way to create sidebar webviews |
| `@vscode/codicons` | ^0.0.44 | Icon font for status indicators and action buttons | Official VS Code icon font, used by VS Code itself and recommended for extensions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | No additional libraries needed; plain HTML/CSS/JS is sufficient for this dashboard |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain HTML/CSS | React/Lit/Svelte framework | Overkill for card layout; adds build complexity, bundle size. Plain HTML sufficient for ~50 elements |
| `@vscode/codicons` font | Inline SVG icons | Codicons integrate with VS Code theme, have consistent sizing, well-known to users |
| `vscode-webview-ui-toolkit` | Plain HTML+CSS variables | Toolkit deprecated Jan 2025; CSS variables provide same theme integration without dependency |

**Installation:**
```bash
npm install @vscode/codicons
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── commands/              # Existing command handlers
├── models/                # Existing data models
├── services/
│   ├── agent.service.ts   # MODIFIED: add EventEmitter for data changes
│   └── ...                # Existing services unchanged
├── views/
│   ├── sidebar-provider.ts    # WebviewViewProvider implementation
│   ├── sidebar-html.ts        # HTML generation (getHtmlForWebview)
│   └── sidebar-styles.ts      # CSS string constants (optional, can inline)
├── utils/
│   └── nonce.ts               # getNonce() utility
└── extension.ts           # MODIFIED: register WebviewViewProvider
```

### Pattern 1: WebviewViewProvider Registration

**What:** Register a webview view provider that replaces the placeholder TreeView
**When to use:** Always -- this is the core pattern for sidebar webviews

In `package.json`, change the existing view to webview type:
```json
"views": {
  "vscode-agentic": [
    {
      "type": "webview",
      "id": "vscode-agentic.agents",
      "name": "Agents"
    }
  ]
}
```

In `extension.ts`:
```typescript
// Source: VS Code API docs + webview-view-sample
const sidebarProvider = new SidebarViewProvider(
  context.extensionUri,
  agentService,
  repoConfigService,
);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    SidebarViewProvider.viewType,
    sidebarProvider,
  )
);
```

### Pattern 2: WebviewViewProvider Implementation

**What:** The provider class that renders HTML and handles messages
**When to use:** Core implementation pattern

```typescript
// Source: VS Code WebviewViewProvider API (vscode.d.ts lines 9945-9960)
export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "vscode-agentic.agents";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly agentService: AgentService,
    private readonly repoConfigService: RepoConfigService,
  ) {
    // Subscribe to agent data changes to refresh webview
    this.agentService.onDidChange(() => this.refresh());
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "focusAgent":
          vscode.commands.executeCommand(
            "vscode-agentic.focusAgent",
            message.repoPath,
            message.agentName,
          );
          break;
        case "deleteAgent":
          vscode.commands.executeCommand(
            "vscode-agentic.deleteAgent",
            message.repoPath,
            message.agentName,
          );
          break;
        case "createAgent":
          vscode.commands.executeCommand(
            "vscode-agentic.createAgent",
            message.repoPath,
          );
          break;
        case "addRepo":
          vscode.commands.executeCommand("vscode-agentic.addRepo");
          break;
        // ... other commands
      }
    });
  }

  refresh(): void {
    if (this._view) {
      this._view.webview.html = this.getHtmlForWebview(this._view.webview);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Generate full HTML with CSS, codicons, and script
    // ... (see Code Examples section)
  }
}
```

### Pattern 3: Event-Driven Data Push (AgentService EventEmitter)

**What:** Add an EventEmitter to AgentService so the webview provider gets notified of changes
**When to use:** Every time agent data changes (create, delete, status update)

```typescript
// Source: VS Code EventEmitter API (vscode.d.ts lines 1759-1778)
// Add to AgentService:
private readonly _onDidChange = new vscode.EventEmitter<void>();
readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

// Fire after every mutation:
async createAgent(...): Promise<AgentEntry> {
  // ... existing logic ...
  this._onDidChange.fire();
  return entry;
}

async deleteAgent(...): Promise<void> {
  // ... existing logic ...
  this._onDidChange.fire();
}

async updateStatus(...): Promise<void> {
  // ... existing logic ...
  this._onDidChange.fire();
}
```

### Pattern 4: Webview-to-Extension Message Protocol

**What:** Typed message passing between webview JavaScript and extension host
**When to use:** Every user interaction in the webview

```typescript
// Message types (can be in a shared types file or inline)
type WebviewMessage =
  | { command: "focusAgent"; repoPath: string; agentName: string }
  | { command: "deleteAgent"; repoPath: string; agentName: string }
  | { command: "stopAgent"; repoPath: string; agentName: string }
  | { command: "createAgent"; repoPath: string }
  | { command: "addRepo" }
  | { command: "removeRepo"; repoPath: string }
  | { command: "toggleSection"; repoPath: string };
```

In webview script:
```javascript
// Source: VS Code Webview API docs
const vscode = acquireVsCodeApi();

// Tile click -> focus agent
document.querySelectorAll('.agent-tile').forEach(tile => {
  tile.addEventListener('click', (e) => {
    if (e.target.closest('.action-btn')) return; // Don't fire on button clicks
    vscode.postMessage({
      command: 'focusAgent',
      repoPath: tile.dataset.repoPath,
      agentName: tile.dataset.agentName,
    });
  });
});
```

### Pattern 5: Content Security Policy with Nonce

**What:** Secure webview content by restricting script execution to nonce-authenticated scripts
**When to use:** Always -- required for webview security best practices

```typescript
// Source: VS Code webview security docs
function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// In HTML generation:
const nonce = getNonce();
const codiconUri = webview.asWebviewUri(
  vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css")
);

return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      font-src ${webview.cspSource};
      script-src 'nonce-${nonce}';">
  <link href="${codiconUri}" rel="stylesheet" />
  <style>/* inline styles using --vscode-* variables */</style>
</head>
<body>
  <!-- dashboard HTML -->
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    // event handlers
  </script>
</body>
</html>`;
```

### Pattern 6: Live Timer Updates via postMessage

**What:** Update elapsed time counters on running agent tiles without full HTML re-render
**When to use:** Running agents need live second-by-second timers

Two approaches -- recommend Option A for simplicity:

**Option A: Webview-side timer (recommended)**
The webview JavaScript runs a `setInterval` that updates timer displays locally. Timer data (createdAt timestamps + current status) is embedded in the HTML data attributes. No round-trip to extension needed.

```javascript
// In webview script:
setInterval(() => {
  document.querySelectorAll('.timer[data-status="running"]').forEach(el => {
    const created = new Date(el.dataset.createdAt);
    const elapsed = Math.floor((Date.now() - created.getTime()) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    el.textContent = `${min}:${String(sec).padStart(2, '0')}`;
  });
}, 1000);
```

**Option B: Extension-side timer with postMessage** -- more complex, not needed for simple elapsed time.

### Anti-Patterns to Avoid

- **Full HTML re-render on timer tick:** Never regenerate entire HTML every second. Use webview-side JavaScript for timers; only re-render HTML on data changes (agent created/deleted/status changed).
- **retainContextWhenHidden for simple views:** High memory overhead. Use `getState()`/`setState()` or simply re-render HTML when view becomes visible. The data is tiny (a few agent objects).
- **Direct DOM manipulation from extension host:** Not possible. Extension can only send messages or replace `webview.html`. For partial updates, use postMessage to send data and let the webview script update the DOM.
- **Hardcoded colors:** Never use hex/rgb values. Always use `var(--vscode-*)` CSS variables for theme compatibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon rendering | Custom SVG icon system | `@vscode/codicons` font | Consistent with VS Code UI, includes 400+ icons, theme-aware |
| Theme adaptation | Custom dark/light theme detection | VS Code CSS variables (`--vscode-*`) | Automatically update when theme changes, zero JavaScript needed |
| Secure script execution | Custom sandboxing | CSP with nonce + `webview.cspSource` | VS Code's built-in security model, prevents script injection |
| Component library | Custom button/input components | Plain HTML + CSS variables | Webview UI Toolkit deprecated; plain HTML is sufficient for cards and buttons |
| Resource URI resolution | Manual path construction | `webview.asWebviewUri()` | Required for loading local resources (fonts, CSS) in webview sandbox |

**Key insight:** The VS Code webview sandbox requires all local resources to go through `asWebviewUri()` and all scripts to be nonce-authenticated. Attempting to bypass these mechanisms breaks security and causes silent failures.

## Common Pitfalls

### Pitfall 1: Missing `type: "webview"` in package.json

**What goes wrong:** `resolveWebviewView` is never called; the view shows as an empty TreeView placeholder
**Why it happens:** The default view type is TreeView. Without `"type": "webview"`, VS Code expects a `TreeDataProvider`, not a `WebviewViewProvider`.
**How to avoid:** Explicitly set `"type": "webview"` on the view entry in `package.json`:
```json
{ "type": "webview", "id": "vscode-agentic.agents", "name": "Agents" }
```
**Warning signs:** View shows "No data" or is completely blank; no errors in console.

### Pitfall 2: CSP Blocking Scripts or Fonts

**What goes wrong:** JavaScript doesn't execute; codicons show as squares/blanks
**Why it happens:** Content Security Policy is too restrictive or missing `font-src`.
**How to avoid:** Include all required CSP directives:
- `script-src 'nonce-${nonce}'` for scripts
- `font-src ${webview.cspSource}` for codicon font files
- `style-src ${webview.cspSource} 'unsafe-inline'` for inline styles and external CSS
**Warning signs:** Console errors mentioning "Refused to load" or "Refused to execute".

### Pitfall 3: Event Listener Memory Leaks on Re-render

**What goes wrong:** Click handlers multiply after each HTML re-render, causing multiple command executions
**Why it happens:** Setting `webview.html = ...` creates a new document, but if you're using `postMessage` to inject data and then add listeners, old listeners may persist.
**How to avoid:** When replacing `webview.html`, the webview iframe is fully reconstructed. Event listeners declared in the inline script are fine. If using `postMessage` for partial updates, use event delegation on a stable parent element.
**Warning signs:** A single button click triggers the command 2-3 times.

### Pitfall 4: Timer Stops When Webview is Hidden

**What goes wrong:** Elapsed time counter freezes when user switches away from the sidebar
**Why it happens:** When the webview is hidden (user switches to another sidebar), scripts are suspended unless `retainContextWhenHidden` is set.
**How to avoid:** Don't use `retainContextWhenHidden` (memory overhead). Instead, calculate elapsed time from `createdAt` timestamp on each timer tick and on view re-initialization. The timer will show correct elapsed time when the view becomes visible again because it recalculates from the absolute timestamp.
**Warning signs:** Timer shows old value briefly when switching back to sidebar.

### Pitfall 5: Forgetting to Fire EventEmitter on AgentService Mutations

**What goes wrong:** Agent is created/deleted but sidebar doesn't update
**Why it happens:** `AgentService` currently has no event emission -- the webview provider has no way to know data changed.
**How to avoid:** Add `_onDidChange.fire()` to every mutation method: `createAgent`, `deleteAgent`, `updateStatus`, `reconcileOnActivation`.
**Warning signs:** Dashboard is stale; requires manual sidebar toggle to see changes.

### Pitfall 6: Clicking Button Inside Tile Triggers Both Button and Tile Actions

**What goes wrong:** Clicking "Delete" button also focuses the agent (tile click handler fires)
**Why it happens:** Event bubbling -- button click bubbles up to the tile click handler
**How to avoid:** In the webview script, check `e.target.closest('.action-btn')` in the tile click handler and return early if the click originated from a button.
**Warning signs:** focusAgent fires immediately before the deleteAgent confirmation dialog.

## Code Examples

### Full HTML Template Structure

```typescript
// Source: VS Code webview-view-sample + webview-codicons-sample patterns
function getHtmlForWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  repos: RepoConfig[],
  agentsByRepo: Map<string, AgentEntry[]>,
): string {
  const nonce = getNonce();
  const codiconUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"),
  );

  const repoSectionsHtml = repos.map(repo => {
    const agents = agentsByRepo.get(repo.path) ?? [];
    const agentTilesHtml = agents.map(agent => renderAgentTile(agent)).join("");
    return `
      <section class="repo-section" data-repo-path="${escapeHtml(repo.path)}">
        <div class="repo-header">
          <button class="collapse-btn" title="Toggle">
            <i class="codicon codicon-chevron-down"></i>
          </button>
          <span class="repo-name">${escapeHtml(repoDisplayName(repo.path))}</span>
          <span class="repo-status-indicator active"></span>
          <div class="repo-actions">
            <button class="icon-btn create-agent-btn" title="Create Agent"
              data-repo-path="${escapeHtml(repo.path)}">
              <i class="codicon codicon-add"></i>
            </button>
            <button class="icon-btn settings-btn" title="Settings"
              data-repo-path="${escapeHtml(repo.path)}">
              <i class="codicon codicon-gear"></i>
            </button>
            <button class="icon-btn remove-repo-btn" title="Remove Repo"
              data-repo-path="${escapeHtml(repo.path)}">
              <i class="codicon codicon-close"></i>
            </button>
          </div>
        </div>
        <div class="repo-agents">${agentTilesHtml}</div>
      </section>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      font-src ${webview.cspSource};
      script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${codiconUri}" rel="stylesheet" />
  <style>${getDashboardStyles()}</style>
</head>
<body>
  <div class="dashboard">${repoSectionsHtml}</div>
  <script nonce="${nonce}">${getDashboardScript()}</script>
</body>
</html>`;
}
```

### Agent Tile HTML

```typescript
function renderAgentTile(agent: AgentEntry): string {
  const statusIcon = getStatusIcon(agent.status);
  const isRunning = agent.status === "running";
  const isFinishedOrError = agent.status === "finished" || agent.status === "error";

  const stopDisabled = !isRunning;
  const resetDisabled = !isFinishedOrError;
  const clearDisabled = !isFinishedOrError;

  const promptText = agent.initialPrompt
    ? escapeHtml(agent.initialPrompt)
    : "No prompt";
  const exitCodeHtml = agent.status === "error" && agent.exitCode !== undefined
    ? `<span class="exit-code">exit: ${agent.exitCode}</span>`
    : "";

  return `
    <div class="agent-tile"
         data-repo-path="${escapeHtml(agent.repoPath)}"
         data-agent-name="${escapeHtml(agent.agentName)}"
         data-status="${agent.status}"
         data-created-at="${agent.createdAt}">
      <div class="tile-header">
        <span class="status-icon">${statusIcon}</span>
        <span class="agent-name">${escapeHtml(agent.agentName)}</span>
      </div>
      <div class="tile-body">
        <div class="tile-info">
          <span class="tile-field">
            <i class="codicon codicon-repo"></i>
            ${escapeHtml(repoDisplayName(agent.repoPath))}
          </span>
          <span class="tile-field timer" data-status="${agent.status}"
                data-created-at="${agent.createdAt}">
            <i class="codicon codicon-clock"></i>
            ${isRunning ? "0:00" : agent.status === "created" ? "--" : "0:00"}
          </span>
          <span class="tile-field prompt" title="${promptText}">
            ${promptText}
          </span>
          <span class="tile-field placeholder">+-- --  files</span>
          <span class="tile-field placeholder">ctx: --%</span>
          <span class="tile-field placeholder">RAM: --MB</span>
          ${exitCodeHtml}
        </div>
      </div>
      <div class="tile-actions">
        <button class="action-btn stop-btn" ${stopDisabled ? 'disabled' : ''}
                data-action="stopAgent" title="Stop">
          <i class="codicon codicon-debug-stop"></i>
        </button>
        <button class="action-btn reset-btn" ${resetDisabled ? 'disabled' : ''}
                data-action="resetChanges" title="Reset Changes">
          <i class="codicon codicon-discard"></i>
        </button>
        <button class="action-btn delete-btn"
                data-action="deleteAgent" title="Delete">
          <i class="codicon codicon-trash"></i>
        </button>
        <button class="action-btn clear-btn" ${clearDisabled ? 'disabled' : ''}
                data-action="clearContext" title="Clear Context">
          <i class="codicon codicon-clear-all"></i>
        </button>
      </div>
    </div>`;
}
```

### Status Icon Mapping

```typescript
function getStatusIcon(status: AgentStatus): string {
  switch (status) {
    case "running":
      return '<i class="codicon codicon-loading spin"></i>';
    case "created":
      return '<i class="codicon codicon-person"></i>';
    case "finished":
      return '<i class="codicon codicon-check"></i>';
    case "error":
      return '<i class="codicon codicon-error"></i>';
  }
}
```

### CSS Theme Variables (Key Subset)

```css
/* Source: VS Code Theme Color reference (code.visualstudio.com/api/references/theme-color) */
body {
  color: var(--vscode-foreground);
  background-color: var(--vscode-sideBar-background);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.agent-tile {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 10px;
  margin: 6px 0;
  cursor: pointer;
}

.agent-tile:hover {
  border-color: var(--vscode-focusBorder);
}

.action-btn {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
}

.action-btn:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground);
}

.action-btn:disabled {
  opacity: 0.7;
  cursor: default;
}

/* Spinner animation for running status */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
  display: inline-block;
}
```

### Toolbar Buttons in View Title Bar

```json
// package.json - Add Repo button in view toolbar
"menus": {
  "view/title": [
    {
      "command": "vscode-agentic.addRepo",
      "group": "navigation",
      "when": "view == vscode-agentic.agents"
    }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vscode-webview-ui-toolkit` components | Plain HTML + CSS variables | Deprecated Jan 2025 | Must use raw HTML/CSS; no official component library replacement |
| TreeView for sidebar lists | WebviewView for rich custom UI | Always available | TreeView is still valid for simple lists; WebviewView needed for card layouts |
| Full HTML re-render for all updates | postMessage for partial DOM updates | Best practice | Better performance, avoids flicker on frequent updates |

**Deprecated/outdated:**
- `@vscode/webview-ui-toolkit`: Deprecated January 1, 2025. Based on FAST Foundation which was also deprecated. No official replacement. Use plain HTML + VS Code CSS variables instead.
- `onWebviewPanel` activation event: For standalone webview panels, not applicable to WebviewView sidebar views.

## Open Questions

1. **Workspace folder switching for UI-03/UI-04**
   - What we know: `vscode.workspace.updateWorkspaceFolders()` can replace workspace folders. The `focusAgent` command currently only focuses the terminal.
   - What's unclear: Whether replacing all workspace folders with a single worktree folder causes issues with multi-root workspace features, and whether this should happen on every tile click or only on the first.
   - Recommendation: Implement as a simple `updateWorkspaceFolders(0, folders.length, { uri: worktreeUri })` in the focusAgent command handler. This is a Phase 3 deliverable per UI-03/UI-04.

2. **Repo removal with active agents**
   - What we know: The remove repo button should confirm before removing. The `RepoConfigService.removeRepo()` exists.
   - What's unclear: Should removing a repo also delete all its agents? Or just remove the config and leave agents orphaned?
   - Recommendation: Show confirmation dialog; require all agents to be deleted first before repo can be removed (safe approach). Or warn and delete all.

3. **Elapsed time for finished agents**
   - What we know: We have `createdAt` timestamp. We need "total time" for finished agents.
   - What's unclear: There's no `finishedAt` timestamp in the AgentEntry model.
   - Recommendation: Add an optional `finishedAt` field to `AgentEntry` and set it when status transitions to `finished` or `error`. Until then, show "--" for finished agents.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | SidebarViewProvider resolves webview with HTML containing repo sections | unit | `npx vitest run test/unit/sidebar-provider.test.ts -x` | No -- Wave 0 |
| UI-02 | Agent tile HTML includes name, repo, status icon | unit | `npx vitest run test/unit/sidebar-html.test.ts -x` | No -- Wave 0 |
| UI-03 | focusAgent command updates workspace folders | unit | `npx vitest run test/unit/agent.commands.test.ts -x` | Exists but needs update |
| UI-04 | Tile click message triggers focusAgent with correct args | unit | `npx vitest run test/unit/sidebar-provider.test.ts -x` | No -- Wave 0 |
| UI-06 | Commands hidden from palette (already done) | manual-only | Verify in package.json | N/A |
| -- | AgentService fires onDidChange on mutations | unit | `npx vitest run test/unit/agent.service.test.ts -x` | Exists but needs update |
| -- | Status icon mapping returns correct codicons | unit | `npx vitest run test/unit/sidebar-html.test.ts -x` | No -- Wave 0 |
| -- | Action button disabled states match agent status | unit | `npx vitest run test/unit/sidebar-html.test.ts -x` | No -- Wave 0 |
| -- | Message handler routes commands correctly | unit | `npx vitest run test/unit/sidebar-provider.test.ts -x` | No -- Wave 0 |
| -- | CSP includes nonce and required directives | unit | `npx vitest run test/unit/sidebar-html.test.ts -x` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/unit/sidebar-provider.test.ts` -- covers SidebarViewProvider resolveWebviewView, message handling, refresh
- [ ] `test/unit/sidebar-html.test.ts` -- covers HTML generation, tile rendering, status icons, disabled states, CSP
- [ ] Update `test/unit/agent.service.test.ts` -- add tests for EventEmitter (onDidChange fires on mutations)
- [ ] Update `test/__mocks__/vscode.ts` -- add mock for `window.registerWebviewViewProvider`, `EventEmitter`, `Uri.joinPath`

## Sources

### Primary (HIGH confidence)

- VS Code `@types/vscode` 1.96.0 type definitions (local) -- WebviewViewProvider interface, WebviewView interface, EventEmitter class, registerWebviewViewProvider signature
- [VS Code Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview) -- message passing, CSP, getState/setState, retainContextWhenHidden
- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color) -- CSS variable naming convention
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points) -- views type: webview, view/title menus
- [webview-view-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/webview-view-sample) -- Official Microsoft sample for WebviewViewProvider
- [webview-codicons-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/webview-codicons-sample) -- Official sample for codicons in webviews
- [@vscode/codicons npm](https://www.npmjs.com/package/@vscode/codicons) -- Latest version 0.0.44

### Secondary (MEDIUM confidence)

- [Webview UI Toolkit Sunset Issue #561](https://github.com/microsoft/vscode-webview-ui-toolkit/issues/561) -- Confirmed deprecated Jan 2025
- [VS Code Codicons Reference](https://microsoft.github.io/vscode-codicons/) -- Icon browser and names
- [Codicons Spin Request Issue #100](https://github.com/microsoft/vscode-codicons/issues/100) -- Spin animation via custom CSS

### Tertiary (LOW confidence)

- None -- all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- VS Code WebviewViewProvider is a stable, well-documented API; codicons is the official icon font
- Architecture: HIGH -- Patterns derived from official Microsoft samples and type definitions
- Pitfalls: HIGH -- Known issues documented in official issues tracker and verified against API docs

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable APIs, 30-day validity)
