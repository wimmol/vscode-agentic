# Phase 3: Sidebar UI and Agent Switching - Research

**Researched:** 2026-03-04
**Domain:** VS Code TreeView API, Multi-Root Workspace API, Extension UI Patterns
**Confidence:** HIGH

## Summary

Phase 3 builds the visual layer on top of the Phase 2 AgentService/TerminalService foundation. The primary component is a `TreeDataProvider` that renders agent tiles grouped by repository in the existing `vscode-agentic.agents` view (already declared in package.json). Each tile shows the agent name with a status ThemeIcon and a description line. Clicking a tile triggers agent focusing with two distinct behaviors: same-repo switching (CLI panel only) and cross-repo switching (full workspace context change).

The VS Code TreeView API is mature and well-documented. The existing codebase already has the activity bar container, view declaration, and all data sources (AgentService.getAll(), AgentService.getForRepo(), RepoConfigService.getAll()) ready to consume. The main implementation work is: (1) a TreeDataProvider with two item types (repo group headers + agent leaf nodes), (2) package.json menu contributions for context menus and inline actions, (3) a workspace switching service for cross-repo context changes using `vscode.workspace.updateWorkspaceFolders()` and `revealInExplorer`, and (4) new commands for delete-from-tile, copy-branch-name, and create-agent-in-repo.

**Primary recommendation:** Use `vscode.window.createTreeView()` (not `registerTreeDataProvider`) for full TreeView API access needed for reveal(), selection tracking, and active agent highlighting. Implement the TreeDataProvider as a standalone class with constructor-injected AgentService and RepoConfigService. Use `onDidChangeTreeData` event with a debounced refresh method.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two-line tiles: agent name with status ThemeIcon on line 1, description on line 2 (NOTE: VS Code TreeView renders label+description on a SINGLE line -- "line 1" is the label with icon, "description" appears inline after label)
- Description line shows initial prompt preview (truncated), or "Interactive session" if no prompt was given
- Status indicators use VS Code ThemeIcon with ThemeColor: green circle for running, gray circle for created, checkmark for finished, warning triangle for error
- Only show the 4 current statuses (created, running, finished, error) -- suspended indicator added in Phase 6
- Multi-root workspace: all configured repos live in one VS Code window
- Cross-repo agent click: switch file explorer focus, editor, bottom terminal, and agent CLI panel to the target repo's worktree
- Auto-focus file explorer on cross-repo switch -- scroll to and expand the target repo's worktree folder
- Same-repo agent click: only switch the CLI panel (show that agent's terminal) -- do NOT touch the editor or file explorer
- Currently active/focused agent is visually highlighted in the sidebar (bold, accent, or active indicator)
- Right-click context menu on agent tiles: Delete Agent, Copy Branch Name
- Inline hover action: trash icon (delete) appears on hover over agent tile
- Repo group headers: inline '+' button to create a new agent in that repo
- View title toolbar: Create Agent button ('+') and Add Repo button (folder icon)
- Welcome content when no agents exist: "No agents yet" message with a Create Agent button (VS Code TreeView welcome content API)
- Agents ordered within repo group by status priority: running > created > finished > error
- Within same status, alphabetical by agent name
- Repo groups are collapsible, expanded by default
- TreeView auto-refreshes on state changes (agent created/deleted, status changes) via onDidChangeTreeData event

### Claude's Discretion
- Exact ThemeIcon names and ThemeColor values
- TreeView item tooltip content
- Active agent highlight implementation (bold text, decoration, or TreeView selection)
- TreeView refresh debouncing strategy
- Multi-root workspace folder management details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Right sidebar shows agent tiles in a TreeView grouped by repository | TreeDataProvider with two-level hierarchy: repo groups (collapsible) -> agent leaves. Uses existing `vscode-agentic.agents` view declaration. |
| UI-02 | Each agent tile displays name, repo, and current status indicator | TreeItem with label=agentName, description=prompt preview, iconPath=ThemeIcon with ThemeColor per status. Tooltip shows full details. |
| UI-03 | Clicking an agent tile from the same repo switches only the agent CLI panel and code editor to that agent's worktree | TreeItem.command triggers focusAgent which calls TerminalService.showTerminal(). Same-repo detection via comparing tile's repoPath to active agent's repoPath. |
| UI-04 | Clicking an agent tile from a different repo switches the entire VS Code context -- file tree, code editor, bottom terminal, and agent CLI panel | Cross-repo switch uses vscode.workspace.updateWorkspaceFolders() to ensure worktree is in workspace, then revealInExplorer to focus file tree, open a file in editor, and show the agent terminal. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode (API) | ^1.96.0 | TreeView, TreeDataProvider, TreeItem, ThemeIcon, ThemeColor, EventEmitter | Built-in VS Code extension API -- the only way to create native tree views |
| TypeScript | ~5.8.0 | Type-safe implementation | Already in project |
| Vitest | ^3.2.4 | Unit testing TreeDataProvider logic | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vscode.workspace | built-in | updateWorkspaceFolders(), workspaceFolders | Cross-repo switching to manage multi-root workspace folders |
| vscode.commands | built-in | executeCommand() for built-in commands | revealInExplorer, workbench.view.explorer for file explorer focus |
| vscode.window | built-in | createTreeView(), showTextDocument() | TreeView creation and editor switching |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TreeView | WebviewView | Full custom HTML/CSS control but loses native look/feel, accessibility, keyboard nav, and theme integration. Not worth it for this use case. |
| createTreeView | registerTreeDataProvider | Simpler but loses reveal(), selection tracking, visibility events. Need createTreeView for active agent highlighting. |

**Installation:**
No new dependencies needed -- all APIs are built into VS Code Extension API.

## Architecture Patterns

### Recommended Project Structure
```
src/
  views/
    agent-tree-provider.ts    # TreeDataProvider implementation
    agent-tree-item.ts        # AgentTreeItem and RepoTreeItem classes
  services/
    workspace-switch.service.ts  # Cross-repo workspace switching logic
  commands/
    sidebar.commands.ts       # New commands for sidebar actions (delete from tile, copy branch, create in repo)
```

### Pattern 1: Two-Level TreeDataProvider
**What:** TreeDataProvider with repo group headers as parent nodes and agent tiles as leaf nodes.
**When to use:** Always -- this is the core UI component.
**Example:**
```typescript
// Source: VS Code TreeView API docs + project conventions
import * as vscode from "vscode";
import type { AgentEntry, AgentStatus } from "../models/agent.js";
import type { AgentService } from "../services/agent.service.js";
import type { RepoConfigService } from "../services/repo-config.service.js";

type TreeElement = RepoGroupItem | AgentTreeItem;

class AgentTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly agentService: AgentService,
    private readonly repoConfigService: RepoConfigService,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;  // Both item types extend TreeItem
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      // Root level: return repo groups
      return this.getRepoGroups();
    }
    if (element instanceof RepoGroupItem) {
      // Repo level: return sorted agents for this repo
      return this.getAgentsForRepo(element.repoPath);
    }
    return []; // Agents are leaf nodes
  }

  getParent(element: TreeElement): TreeElement | undefined {
    if (element instanceof AgentTreeItem) {
      // Return the parent repo group (needed for reveal())
      return new RepoGroupItem(element.repoPath);
    }
    return undefined; // Repo groups are at root
  }
}
```

### Pattern 2: Status-Sorted Agent Items
**What:** Agents within each repo group sorted by status priority, then alphabetically.
**When to use:** When building the agent list for a repo group.
**Example:**
```typescript
// Source: CONTEXT.md locked decisions
const STATUS_PRIORITY: Record<AgentStatus, number> = {
  running: 0,
  created: 1,
  finished: 2,
  error: 3,
};

function sortAgents(agents: AgentEntry[]): AgentEntry[] {
  return [...agents].sort((a, b) => {
    const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.agentName.localeCompare(b.agentName);
  });
}
```

### Pattern 3: TreeItem.command for Click Handling
**What:** Set TreeItem.command on agent leaf nodes to trigger focus/switch on click.
**When to use:** For the primary click action on agent tiles.
**Example:**
```typescript
// Source: VS Code TreeView API docs
class AgentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly agentName: string,
    public readonly repoPath: string,
    status: AgentStatus,
    initialPrompt?: string,
  ) {
    super(agentName, vscode.TreeItemCollapsibleState.None);

    // Description line: prompt preview or "Interactive session"
    this.description = initialPrompt
      ? truncate(initialPrompt, 40)
      : "Interactive session";

    // Status icon with color
    this.iconPath = getStatusIcon(status);

    // Context value for menu filtering
    this.contextValue = "agentItem";

    // Click handler -- triggers the focus/switch command
    this.command = {
      command: "vscode-agentic.focusAgent",
      title: "Focus Agent",
      arguments: [repoPath, agentName],
    };
  }
}
```

### Pattern 4: Active Agent Highlighting via TreeView Selection
**What:** Use `treeView.reveal(item, { select: true })` to visually highlight the currently focused agent.
**When to use:** After an agent is focused/switched.
**Example:**
```typescript
// Source: VS Code TreeView API docs (createTreeView)
const treeView = vscode.window.createTreeView("vscode-agentic.agents", {
  treeDataProvider: provider,
});

// After focusing an agent, reveal it in the tree:
const agentItem = provider.findAgentItem(repoPath, agentName);
if (agentItem) {
  treeView.reveal(agentItem, { select: true, focus: false });
}
```

### Pattern 5: Cross-Repo Workspace Switching
**What:** When clicking an agent from a different repo, update the VS Code multi-root workspace to include the worktree folder, focus the file explorer on it, and show the agent terminal.
**When to use:** When the clicked agent's repoPath differs from the currently active agent's repoPath.
**Example:**
```typescript
// Source: VS Code Workspace API docs
async function switchToRepo(worktreePath: string): Promise<void> {
  const uri = vscode.Uri.file(worktreePath);

  // Ensure worktree folder is in workspace
  const folders = vscode.workspace.workspaceFolders ?? [];
  const alreadyInWorkspace = folders.some(f => f.uri.fsPath === worktreePath);
  if (!alreadyInWorkspace) {
    vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri });
  }

  // Focus file explorer on the worktree folder
  await vscode.commands.executeCommand("revealInExplorer", uri);

  // Open a file from the worktree in the editor (optional: open README or first file)
  // The terminal switch is handled by focusAgent -> TerminalService.showTerminal
}
```

### Anti-Patterns to Avoid
- **Storing UI state in Memento:** TreeView state (expanded/collapsed, selection) is ephemeral. Do NOT persist it. Let VS Code manage its own TreeView state.
- **Calling fire() on every status change without debouncing:** Rapid status changes (e.g., multiple agents finishing) can cause excessive re-renders. Debounce the refresh.
- **Using registerTreeDataProvider instead of createTreeView:** Loses access to reveal(), selection events, and visibility tracking needed for active agent highlighting.
- **Two separate TreeViews for repos and agents:** Use a single TreeView with a hierarchical provider. Multiple views would break the grouped layout.
- **Calling updateWorkspaceFolders in a loop:** VS Code requires waiting for `onDidChangeWorkspaceFolders` before calling again. Batch operations into a single call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree view UI | Custom webview with HTML/CSS tree | VS Code TreeView API (TreeDataProvider + TreeItem) | Native accessibility, keyboard nav, theme integration, context menus |
| Status icons | Custom SVG icons per status | ThemeIcon with ThemeColor | Respects user's icon theme and color theme automatically |
| Context menus | Manual right-click detection | package.json `contributes.menus` with `view/item/context` | Standard VS Code pattern, works with keyboard shortcuts too |
| Workspace folder management | Manual folder opening/closing | `vscode.workspace.updateWorkspaceFolders()` | Handles multi-root workspace state, events, and extension lifecycle |
| File explorer focus | Custom file tree navigation | `vscode.commands.executeCommand("revealInExplorer", uri)` | Works with VS Code's native explorer, handles visibility |
| Event debouncing | Custom setTimeout/clearTimeout | Simple debounce utility (3-5 lines) | Tiny utility, not worth a dependency |

**Key insight:** VS Code's extension API provides all the building blocks natively. This phase is primarily about wiring existing APIs together with the existing AgentService/TerminalService, not building custom UI components.

## Common Pitfalls

### Pitfall 1: TreeItem Identity and Refresh
**What goes wrong:** After calling `_onDidChangeTreeData.fire()`, the TreeView re-fetches items from the provider. If TreeItem instances are re-created (new objects), VS Code may lose track of expanded/collapsed state.
**Why it happens:** VS Code uses TreeItem identity (via `id` property) to match old and new items. Without stable IDs, all nodes reset.
**How to avoid:** Set `TreeItem.id` explicitly on every item. For repo groups: use `repo:${repoPath}`. For agents: use `agent:${repoPath}::${agentName}`.
**Warning signs:** Repo groups unexpectedly collapsing after refresh.

### Pitfall 2: getParent Required for reveal()
**What goes wrong:** `treeView.reveal(item)` throws "TreeDataProvider must implement getParent" error.
**Why it happens:** The reveal API needs to walk up the tree to find and expand parent nodes. Without getParent, it cannot resolve the path.
**How to avoid:** Always implement `getParent()` in the TreeDataProvider when using `createTreeView`.
**Warning signs:** Runtime error when trying to highlight the active agent.

### Pitfall 3: updateWorkspaceFolders Extension Restart
**What goes wrong:** Adding/removing the first workspace folder causes VS Code to restart all extensions.
**Why it happens:** Transitioning from single-folder to multi-folder workspace (or vice versa) triggers a full extension host restart.
**How to avoid:** On extension activation, ensure all configured repo worktree directories are already added as workspace folders. Avoid adding/removing during normal agent switching. The initial `addRepo` flow should handle workspace folder addition.
**Warning signs:** Extension deactivates unexpectedly; TreeView state is lost.

### Pitfall 4: TreeItem.command Double-Fire on Non-Collapsible Items
**What goes wrong:** Clicking a leaf TreeItem with a command may fire the command twice.
**Why it happens:** Known VS Code issue (#77418) where selection and command fire separately.
**How to avoid:** Make the focusAgent command idempotent (it already is -- showing an already-visible terminal is a no-op). Alternatively, use a guard variable with a short cooldown.
**Warning signs:** Terminal flickers or unnecessary re-renders.

### Pitfall 5: revealInExplorer with Folders
**What goes wrong:** `revealInExplorer` may not properly reveal/expand a folder (as opposed to a file).
**Why it happens:** Known VS Code limitation (#160504) -- revealInExplorer works best with files.
**How to avoid:** After adding a worktree folder to the workspace, use `workbench.view.explorer` command to focus the explorer, and then open a file from the worktree to indirectly reveal it. The folder will be visible in the file explorer as a workspace root.
**Warning signs:** File explorer doesn't scroll to or highlight the target folder.

### Pitfall 6: AgentService Has No Change Event
**What goes wrong:** TreeView doesn't auto-refresh when agents are created/deleted/status changes.
**Why it happens:** AgentService currently has no event emitter -- it just writes to Memento.
**How to avoid:** Add an `onDidChangeAgents` event to AgentService (EventEmitter pattern). The TreeDataProvider subscribes to this event and calls refresh(). This is a small, backward-compatible addition to AgentService.
**Warning signs:** Stale TreeView after creating or deleting agents.

## Code Examples

Verified patterns from official sources:

### ThemeIcon with ThemeColor for Status Indicators
```typescript
// Source: VS Code API docs (ThemeIcon constructor, Theme Color reference)
import * as vscode from "vscode";
import type { AgentStatus } from "../models/agent.js";

function getStatusIcon(status: AgentStatus): vscode.ThemeIcon {
  switch (status) {
    case "running":
      return new vscode.ThemeIcon(
        "circle-filled",
        new vscode.ThemeColor("testing.iconPassed"),  // green
      );
    case "created":
      return new vscode.ThemeIcon(
        "circle-outline",
        new vscode.ThemeColor("disabledForeground"),  // gray
      );
    case "finished":
      return new vscode.ThemeIcon(
        "check",
        new vscode.ThemeColor("testing.iconPassed"),  // green
      );
    case "error":
      return new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("testing.iconFailed"),   // red
      );
  }
}
```

### RepoGroupItem TreeItem
```typescript
// Source: VS Code TreeView API docs
class RepoGroupItem extends vscode.TreeItem {
  constructor(public readonly repoPath: string) {
    // Use the last segment of the path as the display name
    const repoName = repoPath.split("/").pop() ?? repoPath;
    super(repoName, vscode.TreeItemCollapsibleState.Expanded);

    this.id = `repo:${repoPath}`;
    this.contextValue = "repoGroup";
    this.tooltip = repoPath;
    this.iconPath = new vscode.ThemeIcon("repo");
  }
}
```

### Package.json Menu Contributions
```json
{
  "contributes": {
    "menus": {
      "view/title": [
        {
          "command": "vscode-agentic.createAgent",
          "when": "view == vscode-agentic.agents",
          "group": "navigation@1"
        },
        {
          "command": "vscode-agentic.addRepo",
          "when": "view == vscode-agentic.agents",
          "group": "navigation@2"
        }
      ],
      "view/item/context": [
        {
          "command": "vscode-agentic.deleteAgentFromTile",
          "when": "view == vscode-agentic.agents && viewItem == agentItem",
          "group": "inline"
        },
        {
          "command": "vscode-agentic.deleteAgentFromTile",
          "when": "view == vscode-agentic.agents && viewItem == agentItem",
          "group": "destructive"
        },
        {
          "command": "vscode-agentic.copyBranchName",
          "when": "view == vscode-agentic.agents && viewItem == agentItem",
          "group": "other"
        },
        {
          "command": "vscode-agentic.createAgentInRepo",
          "when": "view == vscode-agentic.agents && viewItem == repoGroup",
          "group": "inline"
        }
      ]
    },
    "viewsWelcome": [
      {
        "view": "vscode-agentic.agents",
        "contents": "No agents yet.\n[Create Agent](command:vscode-agentic.createAgent)"
      }
    ]
  }
}
```

### Simple Debounce Utility
```typescript
// Source: Standard pattern (no library needed)
function debounce(fn: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, delayMs);
  };
}

// Usage in TreeDataProvider:
private debouncedRefresh = debounce(() => this._onDidChangeTreeData.fire(), 150);
```

### AgentService Change Event (Addition Needed)
```typescript
// Source: Established EventEmitter pattern in VS Code API + existing codebase conventions
// Add to AgentService:
private _onDidChangeAgents = new vscode.EventEmitter<void>();
readonly onDidChangeAgents = this._onDidChangeAgents.event;

// Fire after createAgent, deleteAgent, updateStatus:
this._onDidChangeAgents.fire();

// TreeDataProvider subscribes:
agentService.onDidChangeAgents(() => this.debouncedRefresh());
```

### Cross-Repo Switch Implementation
```typescript
// Source: VS Code workspace API + commands API
async function performCrossRepoSwitch(
  worktreePath: string,
  repoPath: string,
  agentName: string,
  terminalService: TerminalService,
): Promise<void> {
  const uri = vscode.Uri.file(worktreePath);

  // 1. Ensure worktree is in workspace folders
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (!folders.some((f) => f.uri.fsPath === worktreePath)) {
    vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri });
  }

  // 2. Focus file explorer on the worktree
  await vscode.commands.executeCommand("workbench.view.explorer");
  await vscode.commands.executeCommand("revealInExplorer", uri);

  // 3. Show the agent's terminal
  terminalService.showTerminal(repoPath, agentName);
}
```

### FocusAgent Command Update (UI-03 + UI-04)
```typescript
// Source: Project convention + CONTEXT.md decisions
// The existing focusAgent command needs modification to handle same-repo vs cross-repo:
async function handleAgentClick(
  repoPath: string,
  agentName: string,
  agentService: AgentService,
  activeAgent: { repoPath: string } | undefined,
): Promise<void> {
  const isSameRepo = activeAgent?.repoPath === repoPath;

  // Always focus the agent (shows/creates terminal)
  await agentService.focusAgent(repoPath, agentName);

  if (!isSameRepo) {
    // Cross-repo: also switch workspace context
    const worktreePath = getWorktreePath(repoPath, agentName);
    await performCrossRepoSwitch(worktreePath, repoPath, agentName, terminalService);
  }
  // Same-repo: focusAgent already handled showing the terminal
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| registerTreeDataProvider only | createTreeView for advanced use cases | VS Code 1.30+ (stable) | Enables reveal(), selection, visibility tracking |
| Custom SVG icon files | ThemeIcon with ThemeColor | VS Code 1.51+ (stable) | Icons respect user theme, no bundled assets needed |
| Single-folder workspace | Multi-root workspace with updateWorkspaceFolders | VS Code 1.18+ (stable) | Multiple repos in one window |
| TreeItem without id | TreeItem.id for stable identity | VS Code 1.0+ (stable) | Required for reliable refresh without state loss |
| No viewsWelcome | viewsWelcome contribution point | VS Code 1.45+ (stable) | Empty state with actionable buttons |
| Manual context menus | Declarative menus in package.json with when/group | VS Code 1.0+ (stable) | Standard, keyboard-accessible menus |

**Deprecated/outdated:**
- `vscode.window.registerTreeDataProvider` is NOT deprecated but is the simpler alternative. Use `createTreeView` for this phase since reveal() is needed.

## Open Questions

1. **Active Agent Tracking Across Sessions**
   - What we know: No "active agent" state is currently persisted. The TreeView selection provides visual highlight.
   - What's unclear: Should the "active agent" survive extension restart? Currently no mechanism for this.
   - Recommendation: Track active agent in a simple variable (not Memento). On restart, no agent is active until user clicks one. Phase 5 (session persistence) may revisit.

2. **Cross-Repo Editor Behavior**
   - What we know: CONTEXT.md says cross-repo switch should update the code editor. But switching just the file explorer doesn't automatically open a file.
   - What's unclear: What file should open in the editor on cross-repo switch? The worktree root has no obvious default file.
   - Recommendation: On cross-repo switch, focus the file explorer on the worktree folder and show the agent's terminal. Do NOT auto-open a file in the editor -- let the user choose. The editor context changes because the workspace folder changed.

3. **Bottom Terminal for Cross-Repo**
   - What we know: CONTEXT.md says cross-repo switch should also switch the bottom terminal.
   - What's unclear: There is no "bottom terminal per repo" concept in the current implementation. TerminalService only manages agent (Claude Code) terminals.
   - Recommendation: The agent CLI terminal IS the terminal that gets switched. The "bottom terminal" in the requirements likely refers to the agent's terminal being shown. No separate "repo terminal" management needed in Phase 3.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | TreeDataProvider returns repo groups with agent children | unit | `npx vitest run test/unit/agent-tree-provider.test.ts -x` | No - Wave 0 |
| UI-01 | Repo groups are collapsible, expanded by default | unit | `npx vitest run test/unit/agent-tree-provider.test.ts -x` | No - Wave 0 |
| UI-02 | Agent tiles show name, description, status icon | unit | `npx vitest run test/unit/agent-tree-item.test.ts -x` | No - Wave 0 |
| UI-02 | Status icons map correctly (running=green circle, etc.) | unit | `npx vitest run test/unit/agent-tree-item.test.ts -x` | No - Wave 0 |
| UI-02 | Agent sorting: status priority then alphabetical | unit | `npx vitest run test/unit/agent-tree-provider.test.ts -x` | No - Wave 0 |
| UI-03 | Same-repo click shows terminal only (no workspace switch) | unit | `npx vitest run test/unit/sidebar.commands.test.ts -x` | No - Wave 0 |
| UI-04 | Cross-repo click triggers workspace folder addition + explorer reveal | unit | `npx vitest run test/unit/sidebar.commands.test.ts -x` | No - Wave 0 |
| UI-01 | Welcome content shown when no agents exist | manual-only | N/A - declarative package.json, verified visually | N/A |
| UI-01 | Context menus and inline actions appear correctly | manual-only | N/A - declarative package.json, verified visually | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/unit/agent-tree-provider.test.ts` -- covers UI-01 (TreeDataProvider children, grouping, sorting, refresh)
- [ ] `test/unit/agent-tree-item.test.ts` -- covers UI-02 (TreeItem properties, status icons, description)
- [ ] `test/unit/sidebar.commands.test.ts` -- covers UI-03/UI-04 (click handling, same-repo vs cross-repo)
- [ ] Update `test/__mocks__/vscode.ts` -- add ThemeIcon constructor mock, ThemeColor mock, workspace.updateWorkspaceFolders mock, commands.executeCommand mock enhancements

## Sources

### Primary (HIGH confidence)
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) - TreeDataProvider interface, TreeItem properties, createTreeView vs registerTreeDataProvider, menus, welcome content
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points) - menus schema (view/title, view/item/context, groups), viewsWelcome, views, viewsContainers
- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color) - testing.iconPassed, testing.iconFailed, disabledForeground ThemeColor identifiers
- [VS Code Codicons](https://microsoft.github.io/vscode-codicons/) - circle-filled, circle-outline, check, warning, trash, add, copy, repo icon identifiers
- [VS Code Built-in Commands](https://code.visualstudio.com/api/references/commands) - revealInExplorer, workbench.view.explorer, vscode.open
- [VS Code tree-view-sample](https://github.com/Microsoft/vscode-extension-samples/blob/main/tree-view-sample/USAGE.md) - Reference implementation for menu contributions and TreeDataProvider patterns
- Existing codebase: AgentService, TerminalService, RepoConfigService, package.json (already declared view container and view)

### Secondary (MEDIUM confidence)
- [VS Code Multi-Root Workspace API](https://github.com/microsoft/vscode/wiki/Adopting-Multi-Root-Workspace-APIs) - updateWorkspaceFolders behavior, extension restart caveat
- [ThemeIcon color API](https://github.com/microsoft/vscode/issues/109453) - Confirmed ThemeIcon(id, ThemeColor) works in TreeItems
- [revealInExplorer limitations](https://github.com/microsoft/vscode/issues/160504) - Known issue with folder reveal

### Tertiary (LOW confidence)
- [TreeItem.command double-fire issue](https://github.com/microsoft/vscode/issues/77418) - May or may not still be present in current VS Code versions; implement idempotent commands as safeguard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - VS Code TreeView API is mature (5+ years stable), well-documented, and the only option for native tree views
- Architecture: HIGH - Two-level TreeDataProvider with contextValue-filtered menus is the standard pattern used by official samples and popular extensions
- Pitfalls: HIGH - Documented via GitHub issues and official API docs; the existing codebase already handles similar patterns (e.g., EventEmitter, constructor injection)
- Cross-repo switching: MEDIUM - updateWorkspaceFolders is stable but the extension restart caveat needs careful handling; revealInExplorer folder behavior has known limitations

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable APIs, 30-day validity)
