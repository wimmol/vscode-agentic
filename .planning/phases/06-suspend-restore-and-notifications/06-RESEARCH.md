# Phase 6: Suspend/Restore and Notifications - Research

**Researched:** 2026-03-04
**Domain:** VS Code extension terminal lifecycle, process management, notification API
**Confidence:** HIGH

## Summary

Phase 6 adds three capabilities: suspend (kill process to reclaim RAM), restore (relaunch with `--continue`), and background-agent notifications. The existing codebase is extremely well-positioned for this work -- `TerminalService.disposeTerminal()` already kills terminals, `AgentService.focusAgent()` already relaunches finished/error agents with `--continue`, and `TerminalService.handleTerminalClose()` already detects terminal exits. The core implementation is extending existing code paths with a new `"suspended"` status value, new commands, and a notification hook on the existing terminal close handler.

The notification system uses `vscode.window.showInformationMessage` with a "Show Agent" action button, and suppresses notifications when the agent's terminal is the active terminal (`vscode.window.activeTerminal`). Both APIs are stable, well-documented VS Code extension APIs.

**Primary recommendation:** Extend existing `disposeTerminal` and `focusAgent` code paths for suspend/restore; hook notifications into the existing `handleTerminalClose` handler with active-terminal focus suppression.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Kill process only -- no terminal scrollback preservation. On restore, relaunch with `claude --continue`. Terminal scrollback is lost but Claude session state persists via --continue flag
- Only idle/finished/error/created agents can be suspended -- running agents must finish or be stopped first (matches TERM-04: "suspend an idle/finished agent")
- Manual suspend only -- no auto-suspend timer. User explicitly suspends via context menu or command palette
- Both individual and bulk suspend: context menu on agent tile for individual, plus "Suspend All Idle Agents" command in palette for bulk
- Click tile = restore + focus: clicking a suspended agent tile restores it -- relaunches Claude CLI with --continue in worktree, shows terminal, sets status to running. Same UX as clicking a finished agent (extends existing `focusAgent()` path)
- Preserve sidebar position and last-focused state -- suspended agents keep their place in the tree
- On VS Code restart, suspended agents stay suspended -- they already have no process, so nothing changes. User explicitly restores when needed
- VS Code notifications only (`vscode.window.showInformationMessage`) -- no OS-native notifications. Consistent with existing Agentic notification pattern
- Notify when a non-focused (background) agent's terminal exits (finished or error). If the user is looking at the agent terminal, no notification needed
- "Needs input" detection not included -- Claude Code CLI doesn't expose a "waiting" signal, would require terminal output parsing
- Notification includes a "Show Agent" action button that focuses the agent's terminal when clicked
- Icon: `debug-pause` ThemeIcon with `disabledForeground` color -- clearly communicates "paused" state, distinct from created (circle-outline) and finished (check)
- Sort priority: running(0) > created(1) > suspended(2) > finished(3) > error(4). Suspended agents are "alive but paused" -- more prominent than finished
- Context menu items for suspend/restore: "Suspend Agent" shown when status is finished/error/created, "Restore Agent" shown when status is suspended. Conditional based on status via contextValue
- No RAM savings indicator -- suspended status icon is sufficient

### Claude's Discretion
- How to determine if an agent is "focused" for notification suppression (active terminal check, VS Code window focus, etc.)
- Terminal dispose vs process kill strategy for suspend (consistent with existing cleanup patterns)
- Reconciliation handling for suspended agents on activation (no process to clean up, just validate worktree still exists)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TERM-04 | User can suspend an idle/finished agent to free RAM -- terminal state is saved and process is killed | Suspend uses existing `disposeTerminal()` to kill process + new `suspendAgent()` method to set status to "suspended". No new libraries needed -- pure extension of existing patterns |
| TERM-05 | User can restore a suspended agent -- process relaunches in the same worktree context | Restore reuses existing `focusAgent()` path -- add "suspended" to the status check alongside "created"/"finished"/"error". Uses existing `createTerminal(continueSession: true)` for `--continue` flag |
| TERM-06 | User receives OS notification when a background agent finishes work or needs input | Hook into existing `handleTerminalClose` in TerminalService. Use `vscode.window.activeTerminal` for focus detection. "Needs input" explicitly descoped per CONTEXT.md decisions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode (API) | ^1.96.0 | Extension host API -- terminals, notifications, TreeView, commands | Already the project's extension API target |
| TypeScript | ~5.8.0 | Language | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^3.2.4 | Unit testing | All new test files |
| @biomejs/biome | ^2.4.5 | Linting/formatting | Pre-commit check |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vscode.window.showInformationMessage` | `node-notifier` (OS native) | CONTEXT.md locks to VS Code notifications only; OS native explicitly out of scope |
| `vscode.window.activeTerminal` check | Terminal output parsing for "waiting" | CONTEXT.md explicitly descopes "needs input" detection |

**Installation:**
No new dependencies required. All APIs come from the existing `vscode` module and project devDependencies.

## Architecture Patterns

### Recommended Changes to Existing Files

```
src/
  models/
    agent.ts           # Add "suspended" to AgentStatus union type
  services/
    agent.service.ts   # Add suspendAgent(), suspendAllIdle(), extend focusAgent() and reconcileOnActivation()
    terminal.service.ts # Extend handleTerminalClose() with notification callback
  views/
    agent-tree-items.ts # Add suspended icon case, update contextValue logic
    agent-tree-provider.ts # Update STATUS_PRIORITY map
  commands/
    agent.commands.ts  # Register suspendAgent, restoreAgent, suspendAllIdle commands
    sidebar.commands.ts # Register suspend/restore context menu commands
  extension.ts         # Wire new commands, pass notification callback to TerminalService
package.json           # Add new commands and context menu entries
```

### Pattern 1: Suspend Agent (new method on AgentService)

**What:** Kill terminal process, set agent status to "suspended", persist to Memento
**When to use:** User right-clicks a non-running agent and selects "Suspend Agent", or runs "Suspend All Idle" command
**Example:**
```typescript
// Source: Extending existing disposeTerminal + updateStatus patterns
async suspendAgent(repoPath: string, agentName: string): Promise<void> {
  const agent = this.getAgent(repoPath, agentName);
  if (!agent) return;

  // Only non-running agents can be suspended
  if (agent.status === "running") return;

  // Dispose terminal if one exists (created agents might have one)
  this.requireTerminalService().disposeTerminal(repoPath, agentName);

  // Update status to "suspended"
  await this.updateStatus(repoPath, agentName, "suspended");
}
```

### Pattern 2: Restore Agent (extend existing focusAgent path)

**What:** Add "suspended" to the status check in `focusAgent()` that triggers terminal creation
**When to use:** User clicks a suspended agent tile or uses "Restore Agent" context menu
**Example:**
```typescript
// Source: Extending existing focusAgent in agent.service.ts
// Current code checks: agent.status === "running" -> showTerminal, else -> createTerminal
// The "else" branch already handles "created" | "finished" | "error"
// Adding "suspended" requires NO code change to focusAgent itself --
// "suspended" falls through to the else branch naturally.
// The key insight: focusAgent already handles all non-"running" statuses identically.
```

### Pattern 3: Notification on Terminal Exit (extend handleTerminalClose)

**What:** After firing `onStatusChange`, check if the terminal was unfocused and show a notification
**When to use:** When any agent's terminal exits while user is focused elsewhere
**Example:**
```typescript
// Source: Extending handleTerminalClose in terminal.service.ts
// Add a second callback for notifications
private handleTerminalClose(terminal: vscode.Terminal): void {
  for (const [key, t] of this.terminals.entries()) {
    if (t === terminal) {
      this.terminals.delete(key);
      const [repoPath, agentName] = key.split("::");
      const exitCode = terminal.exitStatus?.code;
      const status: AgentStatus = exitCode !== undefined && exitCode !== 0 ? "error" : "finished";

      this.onStatusChange(agentName, repoPath, status, exitCode);

      // Notification: only if this terminal was NOT the active terminal
      if (vscode.window.activeTerminal !== terminal) {
        this.onBackgroundExit?.(agentName, repoPath, status);
      }
      break;
    }
  }
}
```

### Pattern 4: Focus Detection (activeTerminal comparison)

**What:** Use `vscode.window.activeTerminal` to check if the exiting terminal had focus
**When to use:** Deciding whether to fire a notification on terminal exit
**Rationale:** `vscode.window.activeTerminal` returns the terminal that currently has focus or most recently had focus. At the moment `onDidCloseTerminal` fires, if `activeTerminal === closedTerminal`, the user was looking at it -- no notification needed. If `activeTerminal !== closedTerminal` or `activeTerminal === undefined`, the user was elsewhere -- show notification.
**Confidence:** HIGH -- `activeTerminal` is a stable, well-documented property since VS Code 1.30+.

### Pattern 5: contextValue for Conditional Menus

**What:** Use different `contextValue` strings on AgentTreeItem to show/hide suspend/restore menu items
**When to use:** All tree items -- the contextValue drives which context menu items appear
**Example:**
```typescript
// Source: Existing pattern in agent-tree-items.ts, extended for suspended
// Current: contextValue = hasDiffs ? "agentItemWithDiffs" : "agentItem"
// New approach: encode suspendable/restorable state in contextValue

// For suspended agents:
this.contextValue = "agentItemSuspended";        // Shows "Restore Agent"
// For suspendable agents (finished/error/created with hasDiffs variant):
this.contextValue = hasDiffs ? "agentItemWithDiffs" : "agentItem";  // Shows "Suspend Agent"
// For running agents:
this.contextValue = "agentItemRunning";           // Shows neither

// package.json when clauses:
// "Suspend Agent": viewItem =~ /^agentItem(WithDiffs)?$/
// "Restore Agent": viewItem == agentItemSuspended
// Delete (existing): viewItem =~ /^agentItem/  -- still matches all variants
```

### Anti-Patterns to Avoid
- **Checking terminal.name for focus detection:** Don't parse terminal names to determine focus. Use `vscode.window.activeTerminal` identity comparison (`===`). Terminal names are display strings, not IDs.
- **Adding a "suspended" case to every status switch without updating tests:** The `AgentStatus` union type change will cause TypeScript exhaustiveness errors in existing switch statements (e.g., `getStatusIcon`). Make sure to handle all switch cases.
- **Creating a new terminal on suspend instead of disposing:** Suspend must kill the process. Don't try to keep a "paused" terminal -- VS Code terminals don't support pause/resume.
- **Blocking reconciliation on suspend validation:** Suspended agents have no process and no terminal. On activation, they just need their worktree validated (already handled by existing cross-reference logic). Don't add expensive checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal focus detection | Custom focus tracking via onDidChangeActiveTerminal events | `vscode.window.activeTerminal` property at the moment of terminal close | Single property read is simpler and more reliable than maintaining focus state |
| Notification UI | Custom webview notification panel | `vscode.window.showInformationMessage` with action strings | VS Code's native notification is the established pattern, auto-dismisses, stacks correctly |
| Conditional context menus | Runtime command enablement/disablement | `contextValue` + `when` clause regex matching in package.json | Declarative, no runtime code needed, already used in this project |
| Process management | Custom child_process.kill | `TerminalService.disposeTerminal()` | Already handles map cleanup, PID clearing, proper disposal order |

**Key insight:** Every capability needed for Phase 6 already exists in the codebase as a partial implementation. Suspend = `disposeTerminal` + `updateStatus("suspended")`. Restore = `focusAgent()` (already handles non-running statuses). Notifications = `handleTerminalClose` + `showInformationMessage`. The work is wiring and extending, not building.

## Common Pitfalls

### Pitfall 1: TypeScript Exhaustiveness After Union Type Change
**What goes wrong:** Adding `"suspended"` to `AgentStatus` without updating all switch statements causes compilation errors or, worse, silent `undefined` returns if using `default` cases.
**Why it happens:** `AgentStatus` is referenced in `getStatusIcon()`, `STATUS_PRIORITY`, `handleTerminalClose`, `reconcileOnActivation`, and tests.
**How to avoid:** The TypeScript compiler will catch missing switch cases IF there is no `default` branch. `getStatusIcon()` has no default -- good, it will error. `STATUS_PRIORITY` is a Record -- add the "suspended" entry. `handleTerminalClose` only produces "finished"/"error" so no change needed there.
**Warning signs:** `tsc --noEmit` errors after adding to the union type.

### Pitfall 2: Race Condition on Suspend of Agent Being Focused
**What goes wrong:** User clicks "Suspend" on a "created" agent right as `focusAgent` is creating a terminal for it. The terminal gets created and immediately disposed.
**Why it happens:** `focusAgent` is async; suspend might interleave.
**How to avoid:** Guard `suspendAgent` with a status check -- only suspend if status is NOT "running". If `focusAgent` has already set status to "running" before the terminal is created, the suspend guard will reject. The existing single-threaded JS event loop makes this safe as long as status updates are synchronous within the async flow.
**Warning signs:** Agent showing "suspended" but having an active terminal.

### Pitfall 3: Notification Firing During Intentional Dispose
**What goes wrong:** Calling `disposeTerminal` (e.g., during `deleteAgent` or `suspendAgent`) triggers the close handler, which then fires a notification.
**Why it happens:** `terminal.dispose()` fires `onDidCloseTerminal`. The existing code already prevents status change by removing the map entry BEFORE disposing. The same pattern prevents notification -- if the terminal is not in the map, the close handler is a no-op.
**How to avoid:** This is already handled by the existing pattern: `disposeTerminal` removes from map before `terminal.dispose()`, so `handleTerminalClose` won't find it and won't fire notification. No additional code needed.
**Warning signs:** Spurious notifications when deleting or suspending agents.

### Pitfall 4: Suspended Agents Getting Reset on Activation
**What goes wrong:** `reconcileOnActivation()` resets "running" agents to "created". If the code is not updated, "suspended" agents might get incorrectly reset.
**Why it happens:** The reconciliation loop checks `agent.status === "running"` -- "suspended" is not "running", so it won't be reset. However, the cross-reference check (worktree exists?) still applies.
**How to avoid:** "Suspended" agents should survive reconciliation unchanged as long as their worktree exists. The existing cross-reference logic handles this correctly -- if the worktree is gone, the orphaned agent is removed regardless of status. No special handling needed for "suspended" in reconciliation.
**Warning signs:** Suspended agents disappearing or changing status after VS Code restart.

### Pitfall 5: Bulk Suspend Including Running Agents
**What goes wrong:** "Suspend All Idle Agents" accidentally suspends running agents.
**Why it happens:** Filtering agents incorrectly.
**How to avoid:** Filter explicitly: `status !== "running" && status !== "suspended"`. Only suspend `"created" | "finished" | "error"` agents.
**Warning signs:** Running agents being killed unexpectedly.

## Code Examples

Verified patterns from existing codebase and official VS Code API:

### Adding "suspended" to AgentStatus (models/agent.ts)
```typescript
// Source: Existing agent.ts line 7 -- extend the union
export type AgentStatus = "created" | "running" | "finished" | "error" | "suspended";
```

### Suspended Icon (views/agent-tree-items.ts)
```typescript
// Source: Existing getStatusIcon switch -- add case
case "suspended":
  return new vscode.ThemeIcon(
    "debug-pause",
    new vscode.ThemeColor("disabledForeground"),
  );
```

### Updated Sort Priority (views/agent-tree-provider.ts)
```typescript
// Source: Existing STATUS_PRIORITY record -- add suspended
const STATUS_PRIORITY: Record<string, number> = {
  running: 0,
  created: 1,
  suspended: 2,
  finished: 3,
  error: 4,
};
```

### Notification on Background Terminal Exit
```typescript
// Source: VS Code API -- showInformationMessage with action button
// https://code.visualstudio.com/api/references/vscode-api
async function notifyBackgroundExit(
  agentName: string,
  repoPath: string,
  status: AgentStatus,
): Promise<void> {
  const statusLabel = status === "error" ? "encountered an error" : "finished";
  const action = await vscode.window.showInformationMessage(
    `Agent '${agentName}' ${statusLabel}.`,
    "Show Agent",
  );
  if (action === "Show Agent") {
    await vscode.commands.executeCommand(
      "vscode-agentic.focusAgent",
      repoPath,
      agentName,
    );
  }
}
```

### Active Terminal Focus Check
```typescript
// Source: VS Code API -- window.activeTerminal
// https://code.visualstudio.com/api/references/vscode-api
// At the moment of terminal close, check if the closed terminal was focused
const wasFocused = vscode.window.activeTerminal === terminal;
if (!wasFocused) {
  // Fire notification
}
```

### contextValue for Suspend/Restore Menus
```typescript
// Source: Extending existing contextValue pattern in agent-tree-items.ts
// Determine contextValue based on status
if (status === "suspended") {
  this.contextValue = hasDiffs ? "agentItemSuspendedWithDiffs" : "agentItemSuspended";
} else if (status === "running") {
  this.contextValue = hasDiffs ? "agentItemRunningWithDiffs" : "agentItemRunning";
} else {
  this.contextValue = hasDiffs ? "agentItemWithDiffs" : "agentItem";
}
```

### package.json Menu Entries for Suspend/Restore
```json
{
  "command": "vscode-agentic.suspendAgent",
  "when": "view == vscode-agentic.agents && viewItem =~ /^agentItem(WithDiffs)?$/",
  "group": "lifecycle"
},
{
  "command": "vscode-agentic.restoreAgent",
  "when": "view == vscode-agentic.agents && viewItem =~ /^agentItemSuspended/",
  "group": "lifecycle"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom process management for suspend | `terminal.dispose()` kills process, `--continue` resumes session | Stable since project Phase 2/5 | No new patterns needed -- reuse existing |
| OS-native notifications via node-notifier | `vscode.window.showInformationMessage` | Project decision (CONTEXT.md) | Consistent UX, no native dependency |
| Terminal output parsing for "needs input" | Explicitly descoped | Phase 6 discussion | Simplifies implementation significantly |

**Deprecated/outdated:**
- Nothing deprecated. All VS Code APIs used (`activeTerminal`, `showInformationMessage`, `onDidCloseTerminal`, `contextValue` regex matching) are stable and current in VS Code 1.96+.

## Open Questions

1. **activeTerminal timing on terminal close**
   - What we know: `vscode.window.activeTerminal` returns the terminal that "currently has focus or most recently had focus." When `onDidCloseTerminal` fires, the active terminal reference may still point to the now-closing terminal.
   - What's unclear: The exact timing of `activeTerminal` update relative to `onDidCloseTerminal`. It likely still references the closing terminal at fire time.
   - Recommendation: Compare `activeTerminal === terminal` at close time. If they match, the user was watching -- suppress notification. If they don't match, the user was elsewhere -- show notification. This is the correct behavior either way: if the user was focused on the terminal, they already saw the exit.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TERM-04 | suspendAgent disposes terminal and sets status to "suspended" | unit | `npx vitest run test/unit/agent.service.test.ts -t "suspendAgent"` | Exists (extend) |
| TERM-04 | suspendAgent rejects running agents | unit | `npx vitest run test/unit/agent.service.test.ts -t "suspendAgent"` | Exists (extend) |
| TERM-04 | suspendAllIdle suspends all non-running non-suspended agents | unit | `npx vitest run test/unit/agent.service.test.ts -t "suspendAllIdle"` | Exists (extend) |
| TERM-04 | Suspended icon shows debug-pause with disabledForeground | unit | `npx vitest run test/unit/agent-tree-items.test.ts -t "suspended"` | Exists (extend) |
| TERM-04 | Suspended agents sort after created, before finished | unit | `npx vitest run test/unit/agent-tree-provider.test.ts -t "sort"` | Exists (extend) |
| TERM-05 | focusAgent on suspended agent creates terminal with --continue | unit | `npx vitest run test/unit/agent.service.test.ts -t "focusAgent"` | Exists (extend) |
| TERM-05 | Clicking suspended tile restores and focuses agent | unit | `npx vitest run test/unit/sidebar.commands.test.ts -t "focusAgentFromTile"` | Exists (extend) |
| TERM-05 | Suspended agents survive reconciliation unchanged | unit | `npx vitest run test/unit/agent.service.test.ts -t "reconcileOnActivation"` | Exists (extend) |
| TERM-06 | Notification fires when background agent exits | unit | `npx vitest run test/unit/terminal.service.test.ts -t "notification"` | Exists (extend) |
| TERM-06 | Notification suppressed when agent terminal is active | unit | `npx vitest run test/unit/terminal.service.test.ts -t "notification"` | Exists (extend) |
| TERM-06 | "Show Agent" button calls focusAgent | unit | `npx vitest run test/unit/terminal.service.test.ts -t "Show Agent"` | Exists (extend) |
| TERM-04 | Suspend command appears in context menu for non-running agents | unit | `npx vitest run test/unit/agent-tree-items.test.ts -t "contextValue"` | Exists (extend) |
| TERM-05 | Restore command appears in context menu for suspended agents | unit | `npx vitest run test/unit/agent-tree-items.test.ts -t "contextValue"` | Exists (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. All tests extend existing test files with new describe blocks or test cases. The vscode mock already supports `createMockTerminal`, `createMockMemento`, `window.onDidCloseTerminal`, and all needed VS Code API surfaces.

Note: The vscode mock may need a small addition for `window.activeTerminal` property -- currently not mocked. Add a simple writable property to the `window` mock object.

## Sources

### Primary (HIGH confidence)
- VS Code Extension API Reference - `window.activeTerminal`, `onDidChangeActiveTerminal`, `showInformationMessage`, `onDidCloseTerminal` - https://code.visualstudio.com/api/references/vscode-api
- VS Code when clause contexts - `viewItem` regex matching for conditional menus - https://code.visualstudio.com/api/references/when-clause-contexts
- VS Code Tree View API - `contextValue` for tree item context menus - https://code.visualstudio.com/api/extension-guides/tree-view
- VS Code notifications sample - action button pattern - https://github.com/microsoft/vscode-extension-samples/blob/main/notifications-sample/src/extension.ts
- Existing codebase analysis - all source files in `/src/` and `/test/` directories

### Secondary (MEDIUM confidence)
- VS Code terminal sample - activeTerminal usage patterns - https://github.com/microsoft/vscode-extension-samples/blob/main/terminal-sample/src/extension.ts

### Tertiary (LOW confidence)
- None -- all findings verified against official docs and existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all VS Code stable APIs
- Architecture: HIGH - Direct extension of existing patterns, code paths already exist
- Pitfalls: HIGH - Identified from code review of existing race condition handling and close handler patterns

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- VS Code extension API changes slowly)
