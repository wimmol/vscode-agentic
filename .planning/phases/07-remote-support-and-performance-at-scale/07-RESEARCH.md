# Phase 7: Remote Support and Performance at Scale - Research

**Researched:** 2026-03-04
**Domain:** VS Code Remote SSH extension compatibility, VS Code configuration API, git operation optimization at scale
**Confidence:** HIGH

## Summary

Phase 7 addresses three requirements: remote agent management via VS Code Remote SSH (REMOTE-01), configurable resource limits (REMOTE-02), and responsiveness at scale (PERF-02). The key architectural insight is that VS Code Remote SSH runs the extension host on the remote machine, so the extension "just works" remotely with zero transport-layer changes. The work is primarily: (1) migrating the worktree limit from Memento-based RepoConfig to VS Code's `contributes.configuration` settings with `machine-overridable` scope, (2) adding two new settings for agent limits, (3) adding a Claude CLI availability health check on activation, (4) optimizing the `updateDiffStatus()` method to use targeted per-agent updates with TTL caching instead of full sweeps, and (5) enhancing the limit-reached UX to offer auto-suspend.

The codebase is well-structured with constructor injection, per-repo mutex patterns, and 286 passing unit tests. All changes fit cleanly into existing service boundaries. No new dependencies are needed.

**Primary recommendation:** Use `machine-overridable` scope for all three resource limit settings -- this allows user defaults that can be overridden per-workspace (and per-remote-host via Remote Settings), which is exactly the right granularity for resource limits.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use VS Code's native `contributes.configuration` settings with `resource` scope for per-remote overrides -- users set defaults locally, override per remote host in Remote SSH settings
- Migrate `worktreeLimit` from per-repo Memento (RepoConfig) to VS Code settings (`vscode-agentic.maxWorktreesPerRepo`). Add `vscode-agentic.maxAgentsPerRepo`. RepoConfig keeps only repo-specific data (path, stagingBranch)
- Add `vscode-agentic.maxConcurrentAgents` as a global cap across all repos -- prevents runaway resource usage on constrained remote machines
- Three configurable limits: `maxAgentsPerRepo` (default 5), `maxWorktreesPerRepo` (default 5), `maxConcurrentAgents` (default 10)
- When limit reached: block creation + offer to auto-suspend the oldest idle agent to make room
- Remote host only -- extension runs entirely on the remote host via VS Code Remote SSH. No hybrid local/remote complexity
- No custom SSH implementation -- VS Code Remote SSH is the transport layer
- Rely on VS Code Remote SSH reconnection for network interruptions
- Extend existing activation health checks: git version check (already exists) + Claude Code CLI availability check (new)
- Check for `claude` in PATH on activation. If not found: show warning, disable agent creation
- No remote path translation needed -- VS Code Remote SSH maps paths transparently
- Batched + time-based diff cache: cache diff results with a TTL (e.g., 30s). Only recompute for the specific agent whose status changed, not all agents
- Shallow git operations for large repos: use `git diff --stat` with limited output
- No runtime performance instrumentation
- No remote-specific visual indicators in the sidebar
- No special latency handling
- Settings only, no remote-specific commands

### Claude's Discretion
- Exact VS Code settings schema (types, enums, descriptions, defaults)
- Migration strategy for existing worktreeLimit values in Memento to new settings
- TTL duration for diff status cache (30s suggested, but Claude can tune)
- Whether to add progress indicators (`withProgress`) for potentially slow operations
- Exact error messages and warning text for missing CLI on remote
- Developer-mode timing logs (optional, behind a setting if Claude deems useful)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REMOTE-01 | User can connect to remote repos via VS Code Remote SSH and manage agents on the remote machine | Extension host runs on remote automatically via VS Code Remote SSH; CLI health check validates `claude` availability; no code changes needed for remote execution itself -- it works by design |
| REMOTE-02 | Resource limits are configurable for remote environments (max agents, max worktrees) | Three VS Code settings with `machine-overridable` scope: `maxAgentsPerRepo`, `maxWorktreesPerRepo`, `maxConcurrentAgents`; read via `workspace.getConfiguration()`; per-remote overrides via Remote Settings |
| PERF-02 | Extension remains responsive with 5 concurrent agents and large repositories | Targeted per-agent diff updates with TTL cache replace full-sweep `updateDiffStatus()`; `git diff --stat` with limited output for shallow operations; existing per-repo mutex prevents contention |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode | ^1.96.0 | Extension API -- `workspace.getConfiguration()`, `contributes.configuration`, `env.remoteName` | Already used; native VS Code API, no alternatives |
| vitest | ^3.2.4 | Unit testing | Already used; project standard |

### Supporting
No new libraries needed. All functionality is provided by VS Code API and Node.js built-ins.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `machine-overridable` scope | `resource` scope | User locked `resource` scope; `machine-overridable` is more semantically correct for machine-level resource limits but `resource` also works for per-folder overrides. Both allow per-remote override via Remote Settings. Use `resource` per user decision. |
| TTL-based Map cache | LRU cache library | Overkill for ~5-10 entries; simple Map + timestamp is sufficient |

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  models/
    repo.ts              # MODIFY: remove worktreeLimit field from RepoConfig
  services/
    agent.service.ts     # MODIFY: add agent limit checks (per-repo + global) in createAgent
    worktree.service.ts  # MODIFY: read worktree limit from VS Code settings instead of parameter
    git.service.ts       # NO CHANGE: git operations already async + buffer-limited
    repo-config.service.ts # MODIFY: remove worktreeLimit from addRepo flow
  views/
    agent-tree-provider.ts # MODIFY: refactor updateDiffStatus for targeted per-agent + TTL cache
  commands/
    agent.commands.ts    # MODIFY: add auto-suspend offer when limit reached
    worktree.commands.ts # MODIFY: update handleWorktreeLimitError for auto-suspend
  extension.ts           # MODIFY: add Claude CLI health check on activation
package.json             # MODIFY: add contributes.configuration section
```

### Pattern 1: VS Code Configuration Settings with Resource Scope
**What:** Declare settings in `contributes.configuration` with `resource` scope so they can be overridden per-folder and per-remote-host.
**When to use:** For resource limits that should have sensible defaults but allow per-environment overrides.
**Example:**
```json
// package.json contributes.configuration
{
  "contributes": {
    "configuration": {
      "title": "VS Code Agentic",
      "properties": {
        "vscode-agentic.maxAgentsPerRepo": {
          "type": "integer",
          "default": 5,
          "minimum": 1,
          "maximum": 20,
          "scope": "resource",
          "description": "Maximum number of agents per repository. Applies independently per repo."
        },
        "vscode-agentic.maxWorktreesPerRepo": {
          "type": "integer",
          "default": 5,
          "minimum": 1,
          "maximum": 20,
          "scope": "resource",
          "description": "Maximum number of worktrees (agent branches) per repository."
        },
        "vscode-agentic.maxConcurrentAgents": {
          "type": "integer",
          "default": 10,
          "minimum": 1,
          "maximum": 50,
          "scope": "resource",
          "description": "Maximum total agents across all repositories. Prevents runaway resource usage."
        }
      }
    }
  }
}
```

### Pattern 2: Reading Settings with getConfiguration
**What:** Read settings from VS Code configuration API instead of Memento.
**When to use:** Replacing hardcoded or Memento-persisted limits.
**Example:**
```typescript
// Source: VS Code API docs
function getMaxWorktreesPerRepo(repoPath?: string): number {
  const uri = repoPath ? vscode.Uri.file(repoPath) : undefined;
  return vscode.workspace
    .getConfiguration("vscode-agentic", uri)
    .get<number>("maxWorktreesPerRepo", 5);
}

function getMaxAgentsPerRepo(repoPath?: string): number {
  const uri = repoPath ? vscode.Uri.file(repoPath) : undefined;
  return vscode.workspace
    .getConfiguration("vscode-agentic", uri)
    .get<number>("maxAgentsPerRepo", 5);
}

function getMaxConcurrentAgents(): number {
  return vscode.workspace
    .getConfiguration("vscode-agentic")
    .get<number>("maxConcurrentAgents", 10);
}
```

### Pattern 3: TTL Cache for Diff Status
**What:** Cache diff results per agent with timestamp, skip recomputation if within TTL.
**When to use:** For the `updateDiffStatus()` method to avoid full-sweep git operations on every change.
**Example:**
```typescript
interface DiffCacheEntry {
  hasDiffs: boolean;
  timestamp: number;
}

class AgentTreeProvider {
  private diffCache = new Map<string, DiffCacheEntry>();
  private readonly DIFF_TTL_MS = 30_000; // 30 seconds

  async updateDiffStatusForAgent(repoPath: string, agentName: string): Promise<void> {
    if (!this.diffService) return;

    const key = `${repoPath}::${agentName}`;
    const cached = this.diffCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.DIFF_TTL_MS) {
      return; // Cache still valid
    }

    const hasDiffs = await this.diffService.hasUnmergedChanges(repoPath, agentName);
    this.diffCache.set(key, { hasDiffs, timestamp: Date.now() });
    this.refresh();
  }
}
```

### Pattern 4: CLI Health Check on Activation
**What:** Verify `claude` CLI is available on activation, following existing `git --version` pattern.
**When to use:** Extension activation, alongside existing git health check.
**Example:**
```typescript
// In extension.ts activate(), alongside existing git health check
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Claude CLI health check (warn if not available, non-blocking)
execFileAsync("claude", ["--version"], { timeout: 10_000 })
  .catch(() => {
    vscode.window.showWarningMessage(
      "VS Code Agentic: Claude Code CLI ('claude') not found in PATH. Agent creation is disabled until it is installed."
    );
    // Set a context variable to disable agent creation commands
    vscode.commands.executeCommand("setContext", "vscode-agentic.claudeAvailable", false);
  })
  .then(() => {
    vscode.commands.executeCommand("setContext", "vscode-agentic.claudeAvailable", true);
  });
```

### Pattern 5: Auto-Suspend on Limit Reached
**What:** When agent/worktree limit is reached, offer to auto-suspend the oldest idle agent.
**When to use:** In createAgent command when limit check fails.
**Example:**
```typescript
async function handleLimitReached(
  agentService: AgentService,
  repoPath: string,
  limitType: string,
): Promise<boolean> {
  const agents = agentService.getForRepo(repoPath);
  const idle = agents
    .filter(a => a.status !== "running" && a.status !== "suspended")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest first

  if (idle.length === 0) {
    vscode.window.showWarningMessage(
      `${limitType} reached and no idle agents to suspend. Delete or finish an agent first.`
    );
    return false;
  }

  const oldest = idle[0];
  const action = await vscode.window.showWarningMessage(
    `${limitType} reached. Suspend idle agent '${oldest.agentName}' to make room?`,
    "Suspend & Continue",
    "Cancel",
  );
  if (action === "Suspend & Continue") {
    await agentService.suspendAgent(repoPath, oldest.agentName);
    return true; // Caller can retry creation
  }
  return false;
}
```

### Anti-Patterns to Avoid
- **Full-sweep diff on every change event:** Current `updateDiffStatus()` checks ALL agents when ANY agent changes status. With 5 agents, this means 5 git diff calls every time any agent changes. Use targeted per-agent updates instead.
- **Reading settings synchronously in hot paths:** `getConfiguration()` is synchronous but involves string parsing. Cache settings values and refresh on `onDidChangeConfiguration`.
- **Mixing Memento and Settings for the same data:** The migration must be clean -- `worktreeLimit` moves entirely to VS Code settings. Don't read from both sources.
- **Custom connection handling:** VS Code Remote SSH already handles reconnection. Don't add custom SSH or connection-state tracking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-remote settings | Custom remote host detection + config storage | `contributes.configuration` with `resource` scope | VS Code handles scope resolution, Remote Settings UI, sync exclusion automatically |
| SSH connection management | Custom SSH tunneling or connection monitoring | VS Code Remote SSH extension | VS Code handles reconnection, extension host lifecycle, path transparency |
| Configuration UI | Custom settings webview or input prompts | VS Code Settings UI (`contributes.configuration`) | Native settings search, JSON editing, scope indicators, all free |
| Remote detection | Custom SSH detection logic | `vscode.env.remoteName` API | Returns `undefined` locally, host string on remote -- one-liner check |

**Key insight:** VS Code Remote SSH makes the extension host run on the remote machine. All file paths, git operations, and terminal processes are local to the remote. There is literally no remote-specific code needed for basic functionality -- only configuration and validation.

## Common Pitfalls

### Pitfall 1: Settings Scope Confusion
**What goes wrong:** Using `window` scope instead of `resource` scope for settings means they can't be overridden per-folder/per-remote.
**Why it happens:** `window` is the default scope. Easy to omit `"scope": "resource"` in package.json.
**How to avoid:** Explicitly set `"scope": "resource"` on all three settings in `contributes.configuration`.
**Warning signs:** Settings appear in User settings but not in Workspace or Remote settings tabs.

### Pitfall 2: Stale worktreeLimit in Memento
**What goes wrong:** After migrating to VS Code settings, old `worktreeLimit` values remain in RepoConfig Memento data. New code reads from settings, but if migration logic is wrong, limits silently change.
**Why it happens:** Existing `RepoConfig` entries in Memento still have `worktreeLimit` field.
**How to avoid:** Simple approach: just remove the field from the `RepoConfig` TypeScript interface. The Memento data is a JSON blob -- extra fields are harmless and get dropped on next write. Don't write a migration script.
**Warning signs:** Type errors if code still references `config.worktreeLimit`.

### Pitfall 3: Git Diff Contention with Multiple Agents
**What goes wrong:** 5 agents all triggering `updateDiffStatus()` creates a thundering herd of `git diff` calls against the same repo.
**Why it happens:** Every `onDidChangeAgents` event triggers a full diff sweep, and agent status changes happen frequently (create, focus, finish).
**How to avoid:** (1) Targeted per-agent diff updates, (2) TTL cache to skip recent checks, (3) Increased debounce on the diff update path.
**Warning signs:** UI lag when switching between agents, git lock errors in logs.

### Pitfall 4: CLI Check Blocking Activation
**What goes wrong:** If `claude --version` is slow (DNS resolution on remote, shell initialization), it blocks extension activation.
**Why it happens:** Using `await` on the health check instead of fire-and-forget.
**How to avoid:** Keep it fire-and-forget like the existing git health check. Use `.catch()` pattern, not `await`.
**Warning signs:** Extension takes >2 seconds to activate on remote hosts.

### Pitfall 5: Agent Limit Check Race Condition
**What goes wrong:** Two createAgent calls pass the limit check simultaneously, both proceed, exceeding the limit.
**Why it happens:** The worktree service has per-repo mutex but the agent count check is in the command layer without locking.
**How to avoid:** Move the agent limit check inside `AgentService.createAgent()` (which already delegates to `WorktreeService.addWorktree()` that uses the per-repo mutex). The worktree limit check is already inside the mutex. Add agent count check there too.
**Warning signs:** More agents than the configured limit for a repo.

### Pitfall 6: getConfiguration Resource URI
**What goes wrong:** Calling `getConfiguration("vscode-agentic")` without passing a resource URI returns global settings, not per-folder overrides.
**Why it happens:** Easy to forget the second parameter.
**How to avoid:** Always pass `vscode.Uri.file(repoPath)` when reading per-repo settings. The global setting (`maxConcurrentAgents`) doesn't need a URI.
**Warning signs:** Per-remote or per-folder setting overrides are ignored.

## Code Examples

### Current Code That Needs Modification

#### 1. WorktreeService.addWorktree -- limit parameter source
```typescript
// CURRENT: limit comes as optional parameter, defaults to DEFAULT_WORKTREE_LIMIT
async addWorktree(repoPath: string, agentName: string, startPoint?: string, limit?: number): Promise<WorktreeEntry> {
  return this.withLock(repoPath, async () => {
    const effectiveLimit = limit ?? DEFAULT_WORKTREE_LIMIT;
    // ...
  });
}

// AFTER: read from VS Code settings inside the mutex
async addWorktree(repoPath: string, agentName: string, startPoint?: string): Promise<WorktreeEntry> {
  return this.withLock(repoPath, async () => {
    const effectiveLimit = vscode.workspace
      .getConfiguration("vscode-agentic", vscode.Uri.file(repoPath))
      .get<number>("maxWorktreesPerRepo", 5);
    // ... rest unchanged
  });
}
```

#### 2. RepoConfig model -- remove worktreeLimit
```typescript
// CURRENT:
export interface RepoConfig {
  path: string;
  stagingBranch: string;
  worktreeLimit: number; // REMOVE THIS
}
export const DEFAULT_WORKTREE_LIMIT = 5; // REMOVE THIS

// AFTER:
export interface RepoConfig {
  path: string;
  stagingBranch: string;
}
// DEFAULT_WORKTREE_LIMIT moves to settings schema or a constants file
```

#### 3. AgentService.createAgent -- add agent limit check
```typescript
// AFTER: add limit checks before worktree creation
async createAgent(repoPath: string, agentName: string, initialPrompt?: string): Promise<AgentEntry> {
  // Check per-repo agent limit
  const maxPerRepo = vscode.workspace
    .getConfiguration("vscode-agentic", vscode.Uri.file(repoPath))
    .get<number>("maxAgentsPerRepo", 5);
  const repoAgents = this.getForRepo(repoPath);
  if (repoAgents.length >= maxPerRepo) {
    throw new AgentLimitError(repoPath, maxPerRepo, "per-repo", repoAgents);
  }

  // Check global concurrent limit
  const maxGlobal = vscode.workspace
    .getConfiguration("vscode-agentic")
    .get<number>("maxConcurrentAgents", 10);
  const allAgents = this.getAll();
  if (allAgents.length >= maxGlobal) {
    throw new AgentLimitError(repoPath, maxGlobal, "global", allAgents);
  }

  // Existing logic continues...
  await this.worktreeService.addWorktree(repoPath, agentName);
  // ...
}
```

#### 4. updateDiffStatus -- targeted per-agent with TTL
```typescript
// CURRENT: full sweep of all agents
async updateDiffStatus(): Promise<void> {
  if (!this.diffService) return;
  const agents = this.agentService.getAll();
  for (const agent of agents) {
    const hasDiffs = await this.diffService.hasUnmergedChanges(agent.repoPath, agent.agentName);
    this.diffStatusCache.set(`${agent.repoPath}::${agent.agentName}`, hasDiffs);
  }
  this.refresh();
}

// AFTER: targeted update with TTL cache
private diffTimestamps = new Map<string, number>();
private readonly DIFF_TTL_MS = 30_000;

async updateDiffStatusForAgent(repoPath: string, agentName: string): Promise<void> {
  if (!this.diffService) return;
  const key = `${repoPath}::${agentName}`;
  const lastChecked = this.diffTimestamps.get(key) ?? 0;
  if (Date.now() - lastChecked < this.DIFF_TTL_MS) return;

  const hasDiffs = await this.diffService.hasUnmergedChanges(repoPath, agentName);
  this.diffStatusCache.set(key, hasDiffs);
  this.diffTimestamps.set(key, Date.now());
  this.refresh();
}

// Full refresh still available but respects TTL
async updateDiffStatus(): Promise<void> {
  if (!this.diffService) return;
  const agents = this.agentService.getAll();
  for (const agent of agents) {
    await this.updateDiffStatusForAgent(agent.repoPath, agent.agentName);
  }
}
```

#### 5. CLI Health Check in extension.ts
```typescript
// Add after existing git health check (line ~86-90)
// Claude CLI health check (warn if not available, non-blocking)
execFileAsync("claude", ["--version"], { timeout: 10_000 })
  .then(() => {
    vscode.commands.executeCommand("setContext", "vscode-agentic.claudeAvailable", true);
  })
  .catch(() => {
    vscode.window.showWarningMessage(
      "VS Code Agentic: 'claude' CLI not found in PATH. Agent creation is disabled."
    );
    vscode.commands.executeCommand("setContext", "vscode-agentic.claudeAvailable", false);
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded per-repo limits in Memento | VS Code `contributes.configuration` with scope | This phase | Users can override per-folder, per-workspace, and per-remote-host |
| Full-sweep diff on every change | Targeted per-agent diff with TTL cache | This phase | Responsive with 5+ agents instead of N*git-diff on every status change |
| Git health check only | Git + Claude CLI health check | This phase | Clear error when remote lacks `claude` CLI |
| Implicit remote support | Explicit validation + resource limits | This phase | Reliable remote experience with configurable resource constraints |

**Important note on existing code:** The `RepoConfig.worktreeLimit` field is set to `DEFAULT_WORKTREE_LIMIT` (5) on repo creation but is **never actually read** during worktree creation. `WorktreeService.addWorktree` accepts an optional `limit` parameter, but `AgentService.createAgent` never passes it. The effective limit has always been `DEFAULT_WORKTREE_LIMIT`. This makes migration trivial -- there are no user-customized values to preserve.

## Open Questions

1. **`setContext` for command enablement**
   - What we know: VS Code `setContext` allows disabling commands via `when` clauses. We can set `vscode-agentic.claudeAvailable` to `false` to disable create commands.
   - What's unclear: Should we also add `when` clauses to the "Create Agent" commands in `package.json`, or just check programmatically in the command handler?
   - Recommendation: Add `when` clause `vscode-agentic.claudeAvailable` to create agent commands so buttons are visually disabled. Also check programmatically as a fallback.

2. **Global agent limit scope**
   - What we know: `maxConcurrentAgents` caps total agents across all repos. User specified `resource` scope for all settings.
   - What's unclear: A per-resource override for a global cap is slightly odd semantically -- a user could set different global caps per folder, and it's ambiguous which applies.
   - Recommendation: Use `resource` scope per user decision. Read without a resource URI for the global count check (gets the effective global value). Document that this is a global cap.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REMOTE-01 | Claude CLI health check runs on activation, disables creation if missing | unit | `npx vitest run test/unit/extension-activation.test.ts -x` | No -- Wave 0 |
| REMOTE-01 | Extension works on remote (env.remoteName detection) | manual-only | Manual: Connect via Remote SSH, verify all commands work | N/A |
| REMOTE-02 | VS Code settings schema declared in package.json | unit | `npx vitest run test/unit/settings.test.ts -x` | No -- Wave 0 |
| REMOTE-02 | maxWorktreesPerRepo read from settings in addWorktree | unit | `npx vitest run test/unit/worktree.service.test.ts -x` | Yes -- extend |
| REMOTE-02 | maxAgentsPerRepo enforced in createAgent | unit | `npx vitest run test/unit/agent.service.test.ts -x` | Yes -- extend |
| REMOTE-02 | maxConcurrentAgents enforced in createAgent | unit | `npx vitest run test/unit/agent.service.test.ts -x` | Yes -- extend |
| REMOTE-02 | Auto-suspend offered when limit reached | unit | `npx vitest run test/unit/agent.commands.test.ts -x` | Yes -- extend |
| REMOTE-02 | worktreeLimit removed from RepoConfig model | unit | `npx vitest run test/unit/repo-config.service.test.ts -x` | Yes -- update |
| PERF-02 | Targeted per-agent diff update with TTL cache | unit | `npx vitest run test/unit/agent-tree-provider.test.ts -x` | Yes -- extend |
| PERF-02 | Full refresh respects TTL, skips recent checks | unit | `npx vitest run test/unit/agent-tree-provider.test.ts -x` | Yes -- extend |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `test/__mocks__/vscode.ts` -- add `workspace.getConfiguration` mock that returns configurable values (currently returns generic mock)
- [ ] Update `test/__mocks__/vscode.ts` -- add `env.remoteName` mock property
- [ ] Update `test/__mocks__/vscode.ts` -- add `commands.executeCommand` mock for `setContext` tracking
- [ ] Existing tests referencing `worktreeLimit` on RepoConfig need updating (found in: `repo-config.service.test.ts`, `agent.commands.test.ts`, `diff.commands.test.ts`, `diff.service.test.ts`)

## Sources

### Primary (HIGH confidence)
- VS Code Extension API -- `workspace.getConfiguration()`, `contributes.configuration`, configuration scopes (https://code.visualstudio.com/api/references/contribution-points)
- VS Code Remote Extensions guide -- extension host location, `env.remoteName` API, settings behavior (https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- VS Code Extension Samples -- configuration sample with resource scope (https://github.com/microsoft/vscode-extension-samples/blob/main/configuration-sample/src/extension.ts)

### Secondary (MEDIUM confidence)
- VS Code Multi-Root Workspace APIs wiki -- `getConfiguration` with resource URI (https://github.com/microsoft/vscode-wiki/blob/main/Adopting-Multi-Root-Workspace-APIs.md)

### Tertiary (LOW confidence)
None -- all findings verified with official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all VS Code native APIs well-documented
- Architecture: HIGH -- Changes fit cleanly into existing service boundaries; patterns verified against VS Code API docs
- Pitfalls: HIGH -- Identified from direct codebase analysis; diff contention is a known pattern with git worktrees

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- VS Code API is mature, no fast-moving changes expected)
