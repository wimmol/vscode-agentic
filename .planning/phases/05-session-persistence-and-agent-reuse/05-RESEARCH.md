# Phase 5: Session Persistence and Agent Reuse - Research

**Researched:** 2026-03-04
**Domain:** VS Code extension persistence (Memento), Terminal API, process lifecycle, Claude Code CLI session management
**Confidence:** HIGH

## Summary

Phase 5 adds three capabilities: (1) agent metadata survives VS Code restarts and agents appear in the sidebar with correct status, (2) clicking a finished/error agent tile relaunches it in interactive mode, and (3) orphan agent processes are detected and cleaned up on activation. The existing codebase already handles most of the heavy lifting -- `AgentEntry` persists via Memento, `reconcileOnActivation()` resets running agents to "created", and `focusAgent()` already relaunches finished/error agents with new terminals. The primary work is: modifying `focusAgent()` to skip the initialPrompt on restart (launch interactive `claude`), adding a `lastFocusedAgentKey` Memento field for sidebar highlighting, and implementing orphan process detection via PID tracking with `process.kill(pid, 0)`.

For the "resume vs fresh session" discretion item: use `claude --continue` rather than bare `claude`. The `--continue` flag is directory-scoped (loads the most recent conversation **in the current directory**), and since each agent runs in its own worktree directory, `--continue` naturally resumes the correct agent session. This provides superior UX over a bare `claude` launch because the agent retains its conversation history and accumulated context.

**Primary recommendation:** Enhance existing `focusAgent()` and `reconcileOnActivation()` rather than building new infrastructure. Use `claude --continue` for agent restart. Implement PID tracking via `process.kill(pid, 0)` for cross-platform orphan detection with zero external dependencies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dormant until clicked: agents appear in sidebar with correct metadata, but no terminals are created until user clicks an agent tile
- When relaunching after restart, launch Claude Code in interactive mode (no prompt) -- the original task prompt is stale context
- Remember last-focused agent key in Memento; highlight it in sidebar on restart (but don't launch its terminal)
- Keep `isTransient: true` on terminals -- extension fully controls restoration, no VS Code ghost terminal tabs
- Click tile = restart: clicking a finished/error agent tile relaunches it immediately (consistent with existing `focusAgent()` behavior)
- Launch directly with no prompt dialog -- user can type whatever they want in the CLI
- Preserve original `initialPrompt` field as metadata for reference (shown in sidebar description) -- it's history, not an action to repeat
- Auto-kill orphans with notification: "Cleaned up N orphaned agent processes" -- informative but doesn't block the user
- Run on every activation -- matches existing worktree reconciliation pattern (Phase 1), low cost
- Full reconciliation scope: cross-reference agent registry with worktree manifest, remove agent entries whose worktrees no longer exist on disk
- Reset previously "running" agents to "created" status -- same as current `reconcileOnActivation()` behavior
- No visual distinction between restored and newly created agents -- "created" means "no terminal yet" regardless of history
- Preserve all agents indefinitely until explicitly deleted -- no auto-archiving of stale agents
- Diff status cache (Phase 4) recomputed from scratch on activation -- git state may have changed externally

### Claude's Discretion
- Resume vs fresh session strategy for agent restart (`claude --resume` vs bare `claude`)
- Orphan process detection mechanism (PID tracking, process scanning, or alternative)
- Cross-platform orphan detection considerations (macOS, Linux, Windows)
- Reconciliation ordering (worktree reconcile first, then agent reconcile, then orphan cleanup)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TERM-03 | Agent sessions persist across VS Code restarts -- agent metadata and terminal sessions are restored | Agent metadata already persists via Memento (`AGENT_REGISTRY_KEY`). Terminals are recreated lazily on click (dormant-until-clicked pattern). `reconcileOnActivation()` resets "running" to "created". Last-focused agent stored in Memento for sidebar highlighting. |
| AGENT-03 | User can restart a previously finished agent, reusing its existing branch and worktree | `focusAgent()` already handles this -- creates new terminal when status is "finished"/"error". Modification: pass `--continue` flag instead of `initialPrompt` to resume Claude session in worktree directory. |
| PERF-03 | Orphan agent processes are detected and cleaned up on extension activation | PID tracking via Memento + `process.kill(pid, 0)` for existence check. Kill orphans with `process.kill(pid, 'SIGTERM')`. Cross-platform (macOS/Linux/Windows). Zero external dependencies. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode (API) | ^1.96.0 | Memento persistence, Terminal API, TreeView | Extension host API -- sole persistence and terminal mechanism |
| Node.js `process` | built-in | `process.kill(pid, 0)` for orphan detection | Zero-dependency, cross-platform process existence check |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^3.2.4 | Unit testing for new/modified services | All new logic must have unit tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `process.kill(pid, 0)` | `find-process` npm package | External dependency for zero benefit; `process.kill` with signal 0 is cross-platform per Node.js docs |
| `claude --continue` | `claude --resume <id>` | `--resume` requires tracking session IDs; `--continue` is directory-scoped and automatically finds the latest session in the worktree cwd |
| `claude --continue` | bare `claude` | Bare `claude` starts fresh; `--continue` preserves conversation history which is better UX |

**Installation:**
No new dependencies required. All functionality uses existing VS Code API and Node.js built-ins.

## Architecture Patterns

### Recommended Changes to Existing Structure
```
src/
├── models/
│   └── agent.ts              # Add lastFocusedAt? field (optional)
├── services/
│   ├── agent.service.ts      # Enhanced reconcileOnActivation(), new setLastFocused()
│   └── terminal.service.ts   # Track PIDs via Memento, modify createTerminal() for restart mode
├── views/
│   └── agent-tree-provider.ts # Highlight last-focused agent on activation
└── extension.ts              # Enhanced activation: ordered reconciliation sequence
```

No new files needed. All changes are enhancements to existing services.

### Pattern 1: Dormant-Until-Clicked Restoration
**What:** On VS Code restart, agent metadata loads from Memento automatically (workspaceState persists). Agents appear in sidebar. No terminals are created.
**When to use:** Every restart.
**How it works:** The existing `AgentEntry` data is already persisted via `workspaceState.get(AGENT_REGISTRY_KEY)`. The `reconcileOnActivation()` method already resets "running" to "created". The TreeView already renders agents from `agentService.getAll()`. No additional persistence mechanism is needed -- Memento handles it.

```typescript
// Already works -- agent metadata survives restart via Memento
// reconcileOnActivation() resets "running" to "created"
// TreeView renders from getAll() which reads from Memento
// Net new work: just last-focused highlighting
```

### Pattern 2: Agent Restart with Session Continuation
**What:** Clicking a finished/error agent creates a terminal with `claude --continue` instead of `claude <initialPrompt>`.
**When to use:** When relaunching a previously finished agent.
**Key insight:** `focusAgent()` already creates new terminals for finished/error agents. The only change is what arguments to pass to the CLI.

```typescript
// Current: passes initialPrompt as shellArgs
// New: for restart (agent was previously running), pass ["--continue"] instead
// For first-time focus (status === "created" with no prior run), pass initialPrompt as before

// In TerminalService.createTerminal():
const shellArgs: string[] = isRestart
  ? ["--continue"]   // Resume last session in this worktree directory
  : initialPrompt ? [initialPrompt] : [];
```

### Pattern 3: PID-Based Orphan Detection
**What:** Track terminal PIDs in Memento. On activation, check if tracked PIDs are still alive. Kill orphans.
**When to use:** Every activation, fire-and-forget.

```typescript
// Store PIDs when terminals are created
const pid = await terminal.processId; // Thenable<number | undefined>
if (pid !== undefined) {
  await this.savePid(agentKey, pid);
}

// On activation, check each stored PID
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = existence check only
    return true;
  } catch {
    return false; // ESRCH = process doesn't exist
  }
}

// Kill orphans
if (isProcessAlive(pid)) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone
  }
}
```

### Pattern 4: Registry-Worktree Cross-Reference
**What:** During reconciliation, remove agent entries whose worktrees no longer exist on disk.
**When to use:** Part of enhanced `reconcileOnActivation()`.

```typescript
// For each agent in registry, check if its worktree exists in the manifest
const worktreeManifest = this.worktreeService.getManifest(agent.repoPath);
const hasWorktree = worktreeManifest.some(w => w.agentName === agent.agentName);
if (!hasWorktree) {
  // Worktree was deleted externally -- remove agent entry
  orphanedAgents.push(agent);
}
```

### Pattern 5: Ordered Reconciliation Sequence
**What:** On activation, run reconciliation in a specific order to ensure consistency.
**When to use:** In `extension.ts activate()`.

```typescript
// Order matters:
// 1. Worktree reconciliation (removes disk/manifest orphans) -- already exists
// 2. Agent-worktree cross-reference (removes agents without worktrees) -- new
// 3. Orphan process cleanup (kills leftover processes) -- new
// 4. Reset "running" to "created" (already exists, keep last)
```

### Anti-Patterns to Avoid
- **Storing terminal objects for restoration:** VS Code terminals are ephemeral -- they cannot be serialized. Store metadata only, recreate terminals on demand.
- **Using VS Code's built-in terminal restoration:** `isTransient: true` prevents this intentionally. The extension must fully control terminal lifecycle.
- **Scanning all system processes by name:** Fragile, slow, and requires knowing the exact process name. PID tracking is precise and O(1).
- **Blocking activation on reconciliation:** All reconciliation must be fire-and-forget (async, non-blocking). Startup must not be delayed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform PID check | Custom `ps` / `tasklist` parser | `process.kill(pid, 0)` | Node.js built-in, documented cross-platform behavior, zero dependencies |
| Session continuation | Custom session file tracking | Claude CLI `--continue` flag | Directory-scoped, automatically finds latest session in cwd |
| Agent metadata persistence | Custom file storage | VS Code Memento (`workspaceState`) | Already used throughout codebase, VS Code manages storage lifecycle |
| Last-focused state | Custom config file | Memento key `vscode-agentic.lastFocusedAgent` | Consistent with existing Memento usage pattern |

**Key insight:** The existing codebase already handles 80% of session persistence. Agent metadata persists via Memento, reconciliation resets stale state, and focusAgent() already relaunches finished agents. The new work is mostly about modifying arguments and adding PID tracking.

## Common Pitfalls

### Pitfall 1: Terminal.processId is a Thenable
**What goes wrong:** Treating `terminal.processId` as a synchronous value. It's `Thenable<number | undefined>` and may resolve asynchronously, or even never resolve on some platforms (historical Windows issues).
**Why it happens:** The VS Code API returns a Thenable because the terminal process may not be created immediately.
**How to avoid:** Always `await terminal.processId` with a timeout fallback. If it resolves to `undefined`, skip PID tracking for that terminal.
**Warning signs:** PIDs stored as `undefined` in Memento; orphan detection never finding anything.

### Pitfall 2: PID Reuse by OS
**What goes wrong:** A stored PID now belongs to a different process (not claude). Killing it would terminate an innocent process.
**Why it happens:** Operating systems reuse PIDs. After a long VS Code shutdown, the PID may have been reassigned.
**How to avoid:** Two safeguards: (1) Clear stored PIDs after successful cleanup, (2) Accept that `process.kill(pid, 0)` only checks existence -- the worst case is killing a process that happens to have the same PID. This is an accepted trade-off given the rarity (PIDs cycle through thousands). For extra safety, verify the process name contains "claude" using `ps` on macOS/Linux, but this is optional and platform-specific.
**Warning signs:** Users reporting unrelated processes being killed (extremely unlikely in practice).

### Pitfall 3: Race Between Reconciliation Steps
**What goes wrong:** Worktree reconciliation removes a worktree, but agent cross-reference hasn't run yet, so the agent entry still exists pointing to a missing worktree.
**Why it happens:** Both reconciliation steps run asynchronously.
**How to avoid:** Run reconciliation steps sequentially: worktree first, then agent cross-reference. Use `await` between steps (not parallel fire-and-forget).
**Warning signs:** Agent tiles in sidebar that show "created" but fail silently when clicked.

### Pitfall 4: focusAgent Restart Detection
**What goes wrong:** Always passing `--continue` even for brand-new agents that have never been focused (no prior Claude session exists in the worktree).
**Why it happens:** No distinction between "never focused" and "previously finished".
**How to avoid:** Track whether an agent has been previously run. Options: (a) check if agent status was ever changed from "created" (use a `hasBeenRun` flag), or (b) check if `~/.claude/projects/` contains sessions for the worktree path. Simplest: add a boolean `hasBeenRun` field to `AgentEntry`, set to `true` on first `focusAgent()`. If `hasBeenRun` is false, use `initialPrompt`; if true, use `--continue`.
**Warning signs:** `claude --continue` on a first-ever run shows "No recent conversations found" error.

### Pitfall 5: Memento Size Limits
**What goes wrong:** Storing too much data in Memento (e.g., full process environment, stdout history).
**Why it happens:** Treating Memento as a database rather than lightweight config store.
**How to avoid:** Store only essential data: agent key -> PID number. Don't store process environment, terminal output, or session content. The Memento data for this phase should add at most a few hundred bytes.
**Warning signs:** Slow extension activation, Memento update failures.

## Code Examples

### Example 1: Enhanced focusAgent with Restart Mode
```typescript
// In AgentService.focusAgent() -- modified to detect restart
async focusAgent(repoPath: string, agentName: string): Promise<void> {
  const agent = this.getAgent(repoPath, agentName);
  if (!agent) return;

  if (agent.status === "running") {
    this.requireTerminalService().showTerminal(repoPath, agentName);
    return;
  }

  const manifest = this.worktreeService.getManifest(repoPath);
  const worktreeEntry = manifest.find((w) => w.agentName === agentName);
  if (!worktreeEntry) return;

  // Determine if this is a restart (agent has been run before)
  const isRestart = agent.hasBeenRun === true;

  this.requireTerminalService().createTerminal(
    repoPath,
    agentName,
    worktreeEntry.path,
    isRestart ? undefined : agent.initialPrompt,  // No prompt on restart
    isRestart,  // Signal to use --continue flag
  );

  // Mark as having been run (for future restart detection)
  if (!agent.hasBeenRun) {
    agent.hasBeenRun = true;
  }

  await this.updateStatus(repoPath, agentName, "running");
}
```

### Example 2: Enhanced createTerminal with --continue Support
```typescript
// In TerminalService.createTerminal() -- modified for restart mode
createTerminal(
  repoPath: string,
  agentName: string,
  worktreePath: string,
  initialPrompt?: string,
  continueSession?: boolean,
): vscode.Terminal {
  const key = this.terminalKey(repoPath, agentName);
  const existing = this.terminals.get(key);
  if (existing) {
    existing.show();
    return existing;
  }

  // Restart: use --continue to resume last session in worktree cwd
  // First run: pass initialPrompt if provided
  const shellArgs: string[] = continueSession
    ? ["--continue"]
    : initialPrompt ? [initialPrompt] : [];

  const terminal = vscode.window.createTerminal({
    name: `Agent: ${agentName}`,
    shellPath: "claude",
    shellArgs,
    cwd: worktreePath,
    isTransient: true,
  });

  this.terminals.set(key, terminal);

  // Track PID for orphan detection (fire-and-forget)
  this.trackPid(key, terminal);

  return terminal;
}

private async trackPid(key: string, terminal: vscode.Terminal): Promise<void> {
  try {
    const pid = await terminal.processId;
    if (pid !== undefined) {
      await this.savePidToMemento(key, pid);
    }
  } catch {
    // PID tracking is best-effort
  }
}
```

### Example 3: Orphan Process Detection
```typescript
// New method in AgentService or a dedicated cleanup utility
async cleanupOrphanProcesses(): Promise<number> {
  const pidMap = this.state.get<Record<string, number>>(PID_REGISTRY_KEY, {});
  const currentTerminalKeys = new Set<string>();

  // Collect keys of currently active terminals
  // (terminals that were just reconciled to "created" status still have no terminal)
  // All stored PIDs from previous session are candidates for orphan check

  let cleanedCount = 0;
  const updatedMap: Record<string, number> = {};

  for (const [key, pid] of Object.entries(pidMap)) {
    if (isProcessAlive(pid)) {
      // Process is still running -- it's an orphan from previous session
      try {
        process.kill(pid, "SIGTERM");
        cleanedCount++;
      } catch {
        // Already gone between check and kill
      }
    }
    // Don't carry over to updated map -- clean slate after reconciliation
  }

  // Clear all tracked PIDs (new session starts fresh)
  await this.state.update(PID_REGISTRY_KEY, {});

  return cleanedCount;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
```

### Example 4: Last-Focused Agent Highlight
```typescript
// Memento key
const LAST_FOCUSED_KEY = "vscode-agentic.lastFocusedAgent";

// In AgentService or WorkspaceSwitchService
async setLastFocused(repoPath: string, agentName: string): Promise<void> {
  await this.state.update(LAST_FOCUSED_KEY, `${repoPath}::${agentName}`);
}

getLastFocused(): string | undefined {
  return this.state.get<string>(LAST_FOCUSED_KEY);
}

// In extension.ts activate(), after reconciliation:
const lastFocusedKey = agentService.getLastFocused();
if (lastFocusedKey) {
  const [repoPath, agentName] = lastFocusedKey.split("::");
  const agent = agentService.getAgent(repoPath, agentName);
  if (agent) {
    // Reveal in TreeView (select but don't focus to avoid stealing attention)
    const agentItem = new AgentTreeItem(agentName, repoPath, agent.status, agent.initialPrompt);
    treeView.reveal(agentItem, { select: true, focus: false });
  }
}
```

### Example 5: Enhanced Reconciliation with Cross-Reference
```typescript
// Enhanced reconcileOnActivation in AgentService
async reconcileOnActivation(): Promise<{ resetCount: number; orphanedCount: number }> {
  const registry = this.getRegistry();
  let changed = false;
  let resetCount = 0;
  const orphanedAgents: AgentEntry[] = [];

  for (const agent of registry) {
    // 1. Cross-reference with worktree manifest
    const manifest = this.worktreeService.getManifest(agent.repoPath);
    const hasWorktree = manifest.some((w) => w.agentName === agent.agentName);

    if (!hasWorktree) {
      orphanedAgents.push(agent);
      changed = true;
      continue;
    }

    // 2. Reset "running" to "created" (existing behavior)
    if (agent.status === "running") {
      agent.status = "created";
      agent.exitCode = undefined;
      changed = true;
      resetCount++;
    }
  }

  // Remove orphaned agent entries
  if (orphanedAgents.length > 0) {
    const orphanKeys = new Set(
      orphanedAgents.map((a) => `${a.repoPath}::${a.agentName}`),
    );
    const cleaned = registry.filter(
      (a) => !orphanKeys.has(`${a.repoPath}::${a.agentName}`),
    );
    await this.saveRegistry(cleaned);
    this._onDidChangeAgents.fire();
  } else if (changed) {
    await this.saveRegistry(registry);
    this._onDidChangeAgents.fire();
  }

  return { resetCount, orphanedCount: orphanedAgents.length };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VS Code terminal restoration (non-transient) | `isTransient: true` + extension-controlled recreation | Phase 2 design decision | Extension fully owns terminal lifecycle; no VS Code ghost tabs |
| Manual session file tracking | `claude --continue` (directory-scoped) | Claude Code CLI built-in | No need to track session IDs; cwd-based auto-resume |
| External process scanning (ps/tasklist) | `process.kill(pid, 0)` | Node.js built-in | Zero dependencies, cross-platform, O(1) |

**Key Claude Code CLI flags for this phase:**
- `claude --continue` (-c): Loads most recent conversation **in the current directory**. Perfect for worktree-scoped session resumption.
- `claude --resume <id>` (-r): Loads specific session by ID or name. Not needed since `--continue` handles the directory scoping.
- `claude` (bare): Starts fresh interactive session. Fallback if `--continue` fails.

## Open Questions

1. **`claude --continue` failure mode**
   - What we know: `--continue` loads the most recent conversation in cwd. If no session exists, behavior is unclear.
   - What's unclear: Does it silently start a new session, show an error, or exit with non-zero?
   - Recommendation: Test this during implementation. If it errors, catch the case by checking `hasBeenRun` flag before using `--continue`. Fallback to bare `claude` if no prior session exists.

2. **PID reuse risk assessment**
   - What we know: `process.kill(pid, 0)` checks existence but not identity. PIDs are reused by the OS.
   - What's unclear: How likely is PID reuse to cause problems in practice (typical VS Code restart is seconds to minutes).
   - Recommendation: Accept the minimal risk. PIDs cycle through thousands of values. For extra safety, could verify process name on macOS/Linux with `ps -p <pid> -o comm=`, but this adds platform-specific code. Start without it; add if users report issues.

3. **Terminal.processId reliability**
   - What we know: `terminal.processId` is `Thenable<number | undefined>`. Historical Windows issues exist (may never resolve).
   - What's unclear: Current reliability on VS Code ^1.96.0 across platforms.
   - Recommendation: Use a timeout (e.g., 5 seconds). If PID is unavailable, skip tracking for that terminal -- orphan detection is best-effort.

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
| TERM-03 | Agent metadata persists across restarts (via Memento) | unit | `npx vitest run test/unit/agent.service.test.ts -t "reconcileOnActivation"` | Exists (enhance) |
| TERM-03 | Last-focused agent key stored and retrieved | unit | `npx vitest run test/unit/agent.service.test.ts -t "lastFocused"` | Wave 0 |
| AGENT-03 | focusAgent detects restart and uses --continue | unit | `npx vitest run test/unit/agent.service.test.ts -t "focusAgent"` | Exists (enhance) |
| AGENT-03 | createTerminal passes --continue for restart | unit | `npx vitest run test/unit/terminal.service.test.ts -t "createTerminal"` | Exists (enhance) |
| PERF-03 | Orphan PIDs detected and cleaned up | unit | `npx vitest run test/unit/agent.service.test.ts -t "orphan"` | Wave 0 |
| PERF-03 | Agent-worktree cross-reference removes orphaned entries | unit | `npx vitest run test/unit/agent.service.test.ts -t "cross-reference"` | Wave 0 |
| PERF-03 | Reconciliation ordering: worktree -> agent -> orphan | unit | `npx vitest run test/unit/agent.service.test.ts -t "reconcil"` | Exists (enhance) |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `test/unit/agent.service.test.ts` -- covers TERM-03 (lastFocused), PERF-03 (orphan cleanup, cross-reference)
- [ ] Enhanced test cases in `test/unit/terminal.service.test.ts` -- covers AGENT-03 (--continue flag)
- [ ] Enhanced test cases in `test/unit/agent.service.test.ts` -- covers AGENT-03 (restart detection via hasBeenRun)

## Sources

### Primary (HIGH confidence)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) -- `--continue`, `--resume` flags, session management
- [Node.js process.kill() docs](https://nodejs.org/api/process.html) -- Signal 0 cross-platform process existence check
- [VS Code Common Capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities) -- Memento workspaceState persistence
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) -- TreeView.reveal() for last-focused highlighting
- Existing codebase: `src/services/agent.service.ts`, `src/services/terminal.service.ts`, `src/extension.ts` -- Current implementation patterns

### Secondary (MEDIUM confidence)
- [VS Code Terminal Advanced](https://code.visualstudio.com/docs/terminal/advanced) -- Terminal restoration, isTransient behavior
- [Claude Code Session Storage](https://stevekinney.com/courses/ai-development/claude-code-session-management) -- Session directory structure (`~/.claude/projects/`)
- [VS Code processId discussion](https://github.com/microsoft/vscode/issues/91905) -- Terminal.processId Windows reliability concerns

### Tertiary (LOW confidence)
- [PID reuse risk](https://github.com/nodejs/node/issues/27642) -- Cross-platform process.kill behavior differences (needs runtime validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all existing VS Code and Node.js APIs
- Architecture: HIGH -- Enhancements to existing services with well-understood patterns
- Pitfalls: HIGH -- Known issues (processId Thenable, PID reuse) documented with mitigations
- Claude CLI integration: MEDIUM -- `--continue` flag behavior confirmed from official docs, but failure mode on first-run needs runtime testing

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable APIs, unlikely to change)
