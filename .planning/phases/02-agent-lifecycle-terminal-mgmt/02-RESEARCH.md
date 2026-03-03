# Phase 2: Agent Lifecycle and Terminal Management - Research

**Researched:** 2026-03-04
**Domain:** VS Code Terminal API, Agent State Management, Claude Code CLI Integration
**Confidence:** HIGH

## Summary

Phase 2 builds the core agent lifecycle on top of Phase 1's git worktree infrastructure. An "agent" is a named entity that owns a git branch, worktree, and (optionally) a VS Code terminal running Claude Code CLI. The phase introduces two new services (AgentService for lifecycle/state, TerminalService for terminal management), an agent data model persisted in VS Code Memento, and three new commands (create, delete, list agents). Terminals are created lazily -- only when the user focuses an agent -- to satisfy PERF-01.

The VS Code Terminal API provides everything needed: `createTerminal(TerminalOptions)` launches a real shell process with `shellPath`/`shellArgs` for Claude Code CLI, `onDidCloseTerminal` fires with `TerminalExitStatus` (including exit code and reason enum), and `window.terminals` provides the current terminal list. The real terminal approach (TerminalOptions, not Pseudoterminal/ExtensionTerminalOptions) is the correct choice here because Claude Code CLI is a full interactive TUI that needs a real PTY -- a pseudoterminal would require reimplementing all I/O relay which is unnecessary complexity for zero benefit.

Status detection is straightforward: agents start as `created` (no terminal), transition to `running` when their terminal is opened, and transition to `finished` when `onDidCloseTerminal` fires. The `TerminalExitStatus.code` and `TerminalExitStatus.reason` (enum: Unknown=0, Shutdown=1, Process=2, User=3, Extension=4) distinguish between normal exits, crashes, and user/extension-initiated closures. An `error` status is derived from non-zero exit codes.

**Primary recommendation:** Use real VS Code terminals (TerminalOptions, not Pseudoterminal), a separate AgentEntry model with its own Memento key that references WorktreeEntry by agentName+repoPath, a dedicated TerminalService that owns the terminal-to-agent mapping, and `terminal.dispose()` as the kill strategy (which sends SIGHUP to the shell process).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Terminal type (real vs pseudoterminal): Claude's discretion -- pick based on research findings and trade-offs
- Terminals are visible to the user in the VS Code terminal panel -- transparent, user can see and interact with Claude Code directly
- Lazy terminal creation: terminal is created only when user focuses the agent, not on agent creation (satisfies PERF-01)
- Claude Code CLI invoked with `claude "initial prompt"` when a prompt is provided; bare `claude` when no prompt given
- Basic status model for Phase 2: `created` (agent exists, no terminal yet), `running` (terminal open), `finished` (terminal exited)
- Detect status via terminal lifecycle events (open/close) and exit codes -- no output parsing required
- When terminal process exits: mark agent as `finished`, keep the agent in the list with worktree and branch preserved
- Agent metadata stored in VS Code Memento (workspaceState) -- consistent with Phase 1 pattern for worktree manifest and repo configs
- Agent name: free text via VS Code InputBox with branch-name validation (no spaces, no special chars that break git branch names)
- Repo selection: QuickPick from repos configured via Phase 1's "Add Repo". Auto-skip picker if only one repo is configured
- Initial prompt: optional -- user can provide a task description at creation time, or skip to open Claude Code in interactive mode
- Name collision: if agent name already exists in that repo, offer to reuse the existing agent or pick a new name
- Running agents CAN be deleted -- show confirmation warning: "Agent X is still running. Delete anyway?"
- ALL deletions require confirmation dialog: "Delete agent X? This removes the worktree and branch."
- Agent selection for deletion: Command palette QuickPick listing all agents with status indicators
- No merge protection in Phase 2 -- Phase 4 adds the guard against deleting agents with unmerged changes

### Claude's Discretion
- Terminal type choice (real VS Code terminal vs pseudoterminal)
- Agent data model design (extend WorktreeEntry, new AgentEntry, or unified model)
- Exact branch-name validation rules
- Terminal process kill strategy (SIGTERM vs dispose)
- Error status detection and error handling patterns
- Internal service architecture (AgentService, TerminalService, or combined)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-01 | Create agent: name it, auto-create branch+worktree, launch Claude Code CLI in terminal | AgentService.createAgent() orchestrates: validate name, call WorktreeService.addWorktree(), persist AgentEntry, optionally create terminal via TerminalService |
| AGENT-02 | Delete agent: kill process, remove worktree, delete branch | AgentService.deleteAgent() orchestrates: dispose terminal via TerminalService, call WorktreeService.removeWorktree(), remove AgentEntry from Memento |
| AGENT-05 | Track and display agent status (running, idle, finished, error) | Status model: created/running/finished/error. Derived from terminal lifecycle events (onDidCloseTerminal + exitStatus). Stored in AgentEntry.status |
| TERM-01 | Each agent runs as Claude Code CLI in VS Code integrated terminal | createTerminal(TerminalOptions) with shellPath="claude", shellArgs=[prompt], cwd=worktreePath. Real terminal, user-visible |
| TERM-02 | 2-5 concurrent agent sessions without conflicts | Each agent has isolated worktree (Phase 1), separate terminal instance, independent process. No shared state between agents |
| PERF-01 | Terminals created lazily (only when focused) | Agent starts as `created` status. Terminal created via TerminalService.ensureTerminal() only when user explicitly focuses the agent |

</phase_requirements>

## Standard Stack

### Core (already established in Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode API | ^1.96.0 | Terminal creation, lifecycle events, Memento persistence | Extension host API -- the only way to create/manage terminals |
| TypeScript | ~5.8.0 | Type safety for complex state management | Established in Phase 1 |
| Vitest | ^3.2.4 | Unit testing with VS Code module mocking | Established in Phase 1 with alias approach |
| Biome | ^2.4.5 | Lint and format | Established in Phase 1 |

### Supporting (no new dependencies needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:child_process | built-in | Already used by GitService | No direct use in Phase 2 -- terminal API handles process |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Real terminal (TerminalOptions) | Pseudoterminal (ExtensionTerminalOptions) | Pseudoterminal requires implementing full I/O relay for Claude Code's interactive TUI -- massive complexity for zero user benefit since the user wants to see and interact with the real terminal |
| Separate AgentEntry model | Extending WorktreeEntry | Extending WorktreeEntry couples agent state to worktree state and breaks Phase 1's clean worktree abstraction. Separate model with a reference key is cleaner |
| terminal.dispose() for kill | Process kill via PID + SIGTERM | dispose() is the VS Code API's official mechanism; it sends SIGHUP to the shell which cascades to child processes. PID-based kill requires resolving processId (Thenable), handling race conditions, and platform differences |

**Installation:**
```bash
# No new packages needed -- Phase 2 uses only existing dependencies
```

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)
```
src/
  commands/
    agent.commands.ts      # createAgent, deleteAgent, listAgents commands
    repo.commands.ts       # (existing)
    worktree.commands.ts   # (existing)
  models/
    agent.ts               # AgentEntry interface, AgentStatus enum, AGENT_REGISTRY_KEY
    repo.ts                # (existing)
    worktree.ts            # (existing)
  services/
    agent.service.ts       # Agent lifecycle: create, delete, getAll, getForRepo, status transitions
    terminal.service.ts    # Terminal management: create, dispose, map terminal<->agent, listen events
    git.service.ts         # (existing)
    repo-config.service.ts # (existing)
    worktree.service.ts    # (existing)
  utils/
    branch-validation.ts   # Git branch name validation (isValidBranchName, sanitizeBranchName)
    gitignore.ts           # (existing)
    worktree-parser.ts     # (existing)
  extension.ts             # (existing -- add new service instantiation + command registration)
test/
  unit/
    agent.service.test.ts
    terminal.service.test.ts
    agent.commands.test.ts
    branch-validation.test.ts
  __mocks__/
    vscode.ts              # (existing -- extend with terminal API mocks)
```

### Pattern 1: Agent Data Model (Separate from WorktreeEntry)

**What:** AgentEntry is a standalone interface persisted in its own Memento key. It references the worktree by agentName + repoPath (which are already the compound key in WorktreeEntry).

**When to use:** Always -- this is the Phase 2 data model.

**Example:**
```typescript
// Source: project convention from Phase 1 Memento patterns
export type AgentStatus = "created" | "running" | "finished" | "error";

export interface AgentEntry {
  agentName: string;       // unique per repo, matches WorktreeEntry.agentName
  repoPath: string;        // parent repo path, matches WorktreeEntry.repoPath
  status: AgentStatus;
  initialPrompt?: string;  // optional task description provided at creation
  createdAt: string;       // ISO timestamp
  exitCode?: number;       // set when terminal exits (undefined while running or created)
}

export const AGENT_REGISTRY_KEY = "vscode-agentic.agentRegistry";
```

**Why separate:** WorktreeEntry is a disk-state model (path, branch, repo). AgentEntry is a UI-state model (status, prompt, exit code). Mixing them creates coupling -- Phase 5 adds session persistence, Phase 6 adds suspend/restore, both of which extend AgentEntry but not WorktreeEntry.

### Pattern 2: TerminalService with Terminal-to-Agent Mapping

**What:** TerminalService owns a `Map<string, vscode.Terminal>` keyed by `${repoPath}::${agentName}`. It handles terminal creation, disposal, and lifecycle event listening. It does NOT persist terminal references -- terminals are ephemeral (they die on VS Code restart).

**When to use:** Any time a terminal needs to be created, shown, or disposed for an agent.

**Example:**
```typescript
// Source: VS Code Terminal API (code.visualstudio.com/api/references/vscode-api)
export class TerminalService {
  private terminals: Map<string, vscode.Terminal> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly onStatusChange: (agentName: string, repoPath: string, status: AgentStatus, exitCode?: number) => void) {
    // Listen for terminal close events
    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        this.handleTerminalClose(terminal);
      })
    );
  }

  private terminalKey(repoPath: string, agentName: string): string {
    return `${repoPath}::${agentName}`;
  }

  createTerminal(repoPath: string, agentName: string, worktreePath: string, initialPrompt?: string): vscode.Terminal {
    const key = this.terminalKey(repoPath, agentName);

    // If terminal already exists and is still alive, just show it
    const existing = this.terminals.get(key);
    if (existing) {
      existing.show();
      return existing;
    }

    const shellArgs: string[] = [];
    if (initialPrompt) {
      shellArgs.push(initialPrompt);
    }

    const terminal = vscode.window.createTerminal({
      name: `Agent: ${agentName}`,
      shellPath: "claude",
      shellArgs,
      cwd: worktreePath,
      isTransient: true,  // don't restore on VS Code restart (Phase 5 handles persistence)
    });

    this.terminals.set(key, terminal);
    return terminal;
  }

  disposeTerminal(repoPath: string, agentName: string): void {
    const key = this.terminalKey(repoPath, agentName);
    const terminal = this.terminals.get(key);
    if (terminal) {
      terminal.dispose();  // sends SIGHUP to shell process
      this.terminals.delete(key);
    }
  }

  private handleTerminalClose(terminal: vscode.Terminal): void {
    // Find which agent this terminal belongs to
    for (const [key, t] of this.terminals.entries()) {
      if (t === terminal) {
        const [repoPath, agentName] = key.split("::");
        this.terminals.delete(key);

        const exitCode = terminal.exitStatus?.code;
        const status: AgentStatus = (exitCode !== undefined && exitCode !== 0) ? "error" : "finished";
        this.onStatusChange(agentName, repoPath, status, exitCode);
        break;
      }
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
```

### Pattern 3: Agent Creation Flow (Multi-step Command)

**What:** The createAgent command orchestrates a multi-step flow: repo selection, name input with validation, optional prompt, worktree creation, agent registry update. Terminal is NOT created at this point (lazy creation per PERF-01).

**When to use:** When user runs `vscode-agentic.createAgent` command.

**Example:**
```typescript
// Source: project convention from Phase 1 (RepoConfigService.addRepo() pattern)
export async function createAgent(
  agentService: AgentService,
  repoConfigService: RepoConfigService,
): Promise<void> {
  // 1. Select repo (auto-skip if only one)
  const repos = repoConfigService.getAll();
  if (repos.length === 0) {
    vscode.window.showErrorMessage("No repositories configured. Run 'Add Repository' first.");
    return;
  }

  let repoPath: string;
  if (repos.length === 1) {
    repoPath = repos[0].path;
  } else {
    const picked = await vscode.window.showQuickPick(
      repos.map(r => ({ label: r.path, description: `staging: ${r.stagingBranch}`, _path: r.path })),
      { title: "Select Repository", placeHolder: "Choose a repository for the new agent" }
    );
    if (!picked) return;
    repoPath = picked._path;
  }

  // 2. Agent name with branch validation
  const agentName = await vscode.window.showInputBox({
    title: "Agent Name",
    prompt: "Enter a name for the agent (used as git branch name)",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) return "Name cannot be empty";
      if (!isValidBranchName(value)) return "Invalid branch name (no spaces, .., ~, ^, :, ?, *, [, \\, or control chars)";
      return undefined;
    },
  });
  if (!agentName) return;

  // 3. Handle name collision
  // ... check agentService.getAgent(repoPath, agentName), offer reuse or rename

  // 4. Optional initial prompt
  const initialPrompt = await vscode.window.showInputBox({
    title: "Initial Prompt (optional)",
    prompt: "Enter a task description for Claude, or leave empty for interactive mode",
    placeHolder: "e.g., Refactor the auth module to use JWT tokens",
  });
  // undefined = cancelled, empty string = no prompt

  if (initialPrompt === undefined) return; // user cancelled

  // 5. Create agent (worktree + registry, NO terminal)
  await agentService.createAgent(repoPath, agentName, initialPrompt || undefined);

  vscode.window.showInformationMessage(`Agent '${agentName}' created. Focus it to start Claude Code.`);
}
```

### Pattern 4: Lazy Terminal Creation (PERF-01)

**What:** Terminal is created only when user explicitly focuses the agent (e.g., clicks on it in the future sidebar, or runs a "focus agent" command). The agent exists in `created` status with no terminal until focused.

**When to use:** Always -- this is a core requirement.

**Example:**
```typescript
// In AgentService or a "focus agent" command handler
async focusAgent(repoPath: string, agentName: string): Promise<void> {
  const agent = this.getAgent(repoPath, agentName);
  if (!agent) return;

  if (agent.status === "created" || agent.status === "finished" || agent.status === "error") {
    // Create terminal (or re-create if previously finished)
    const worktreeEntry = this.worktreeService.getManifest(repoPath)
      .find(w => w.agentName === agentName);
    if (!worktreeEntry) return;

    const terminal = this.terminalService.createTerminal(
      repoPath, agentName, worktreeEntry.path, agent.initialPrompt
    );
    terminal.show();

    await this.updateStatus(repoPath, agentName, "running");
  } else if (agent.status === "running") {
    // Terminal already exists, just show it
    this.terminalService.showTerminal(repoPath, agentName);
  }
}
```

### Anti-Patterns to Avoid

- **Storing vscode.Terminal references in Memento:** Terminal objects are not serializable and are ephemeral -- they die on VS Code restart. Only store the agent metadata; rebuild terminal references at runtime from `window.terminals` if needed.
- **Using Pseudoterminal for Claude Code:** Claude Code is a full interactive TUI with its own terminal rendering. A Pseudoterminal would require intercepting and relaying all I/O byte-by-byte -- massive complexity, fragile, and breaks Claude Code's terminal features (colors, cursor positioning, etc.).
- **Blocking on processId resolution:** `terminal.processId` returns a `Thenable<number | undefined>` that may take time to resolve. Never await it synchronously in a critical path. Use it only for optional diagnostics.
- **Coupling agent state to terminal existence:** An agent can exist without a terminal (status: `created`). The terminal is a transient resource. Agent state must be independent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal process management | Custom child_process.spawn + PTY | `vscode.window.createTerminal(TerminalOptions)` | VS Code handles PTY allocation, process lifecycle, UI integration, and platform differences |
| Terminal exit detection | Polling processId, reading /proc | `vscode.window.onDidCloseTerminal` + `TerminalExitStatus` | Official API, cross-platform, fires reliably |
| Kill terminal process | `process.kill(pid, 'SIGTERM')` | `terminal.dispose()` | dispose() handles the shell process tree correctly across platforms |
| Branch name validation | Custom regex from scratch | `git check-ref-format --branch` via GitService | Git's own validation is authoritative; supplement with a fast local regex pre-check |
| Worktree creation/deletion | Direct git commands in agent service | `WorktreeService.addWorktree()` / `removeWorktree()` | Already built in Phase 1 with mutex locking, manifest management, error handling |

**Key insight:** Phase 2's new code is primarily orchestration and state management. The heavy lifting (git operations, terminal process management) is handled by Phase 1 services and VS Code APIs respectively.

## Common Pitfalls

### Pitfall 1: Terminal Identity After Restart
**What goes wrong:** After VS Code restart, `window.terminals` contains restored terminals but no way to map them back to agents because terminal object references are new.
**Why it happens:** VS Code restores persistent terminals, but the extension's in-memory `Map<string, Terminal>` is lost.
**How to avoid:** Mark agent terminals as `isTransient: true` in TerminalOptions so they are NOT restored on restart. Phase 5 (session persistence) will handle terminal restoration explicitly. On activation, set all agents with status `running` back to `created` (terminal was lost).
**Warning signs:** Orphan terminals in terminal panel with "Agent: xxx" names after restart.

### Pitfall 2: Race Between Terminal Close and Agent Delete
**What goes wrong:** User deletes an agent while `onDidCloseTerminal` handler is also firing, leading to double status updates or attempting to update a deleted agent.
**Why it happens:** `dispose()` triggers `onDidCloseTerminal` asynchronously. If deleteAgent removes the agent from the registry before the close handler runs, the close handler tries to update a non-existent agent.
**How to avoid:** In `disposeTerminal()`, remove the terminal from the map BEFORE calling `dispose()`. The close handler should check if the terminal is still in the map before processing.
**Warning signs:** "Agent not found" errors in logs after deletion.

### Pitfall 3: Key Separator Collision in Terminal Map
**What goes wrong:** Using `::` as separator in `${repoPath}::${agentName}` could collide if repoPath contains `::`.
**Why it happens:** File paths can theoretically contain any characters.
**How to avoid:** Use a compound key object or a Map with a different keying strategy (e.g., nested Map<repoPath, Map<agentName, Terminal>>). Alternatively, since repo paths are validated as git repos and agent names are validated as branch names, `::` is safe for both.
**Warning signs:** Agent terminals appearing under wrong agents.

### Pitfall 4: Claude Code CLI Not Installed
**What goes wrong:** Terminal opens, shows "command not found: claude", exits immediately with error.
**Why it happens:** Claude Code CLI is not installed globally or not in PATH.
**How to avoid:** Detect this case via terminal exit code (127 = command not found on Unix). Show a helpful error message with installation instructions. Optionally, check for claude binary existence before creating terminal.
**Warning signs:** All agents immediately transition to `error` status with exit code 127.

### Pitfall 5: Agent Name Validation Too Loose
**What goes wrong:** User creates an agent named `my agent/feature` or `..` which fails at `git worktree add -b`.
**Why it happens:** Git branch names have strict rules that aren't obvious.
**How to avoid:** Validate locally with a regex BEFORE calling git. The regex should reject: spaces, `..`, `~`, `^`, `:`, `?`, `*`, `[`, `\`, control characters, names starting with `-` or `.`, names ending with `.lock` or `/`, and consecutive slashes. Use `git check-ref-format --branch` as authoritative fallback.
**Warning signs:** Git errors during agent creation that surface as generic failures.

### Pitfall 6: Stale Terminal References
**What goes wrong:** Terminal is disposed externally (user clicks trash icon in terminal panel), but the TerminalService map still holds the dead reference.
**Why it happens:** `onDidCloseTerminal` fires for ALL terminal closures (user, extension, shutdown), but the handler must correctly identify which terminals belong to agents.
**How to avoid:** Always match terminals by identity (===) in the close handler. Clean up the map entry when matched.
**Warning signs:** `createTerminal` finds an existing entry in the map but the terminal is dead, causing show() to throw.

## Code Examples

Verified patterns from official sources:

### Real Terminal Creation with Shell Process
```typescript
// Source: VS Code API - TerminalOptions interface
// code.visualstudio.com/api/references/vscode-api#TerminalOptions
const terminal = vscode.window.createTerminal({
  name: `Agent: ${agentName}`,
  shellPath: "claude",
  shellArgs: initialPrompt ? [initialPrompt] : [],
  cwd: worktreePath,
  isTransient: true,
  // env: { CLAUDE_CODE_WORKTREE: "true" },  // optional marker
});
terminal.show(true); // preserveFocus=true so editor stays focused
```

### Terminal Lifecycle Event Handling
```typescript
// Source: VS Code API - onDidCloseTerminal event
// code.visualstudio.com/api/references/vscode-api#window.onDidCloseTerminal
vscode.window.onDidCloseTerminal((terminal) => {
  const exitCode = terminal.exitStatus?.code;       // number | undefined
  const reason = terminal.exitStatus?.reason;        // TerminalExitReason enum
  // TerminalExitReason values:
  //   Unknown = 0, Shutdown = 1, Process = 2, User = 3, Extension = 4

  if (exitCode === 0) {
    // Claude Code exited normally (user typed /exit or Ctrl+D)
  } else if (exitCode === 127) {
    // Command not found -- claude CLI not installed
  } else if (exitCode !== undefined && exitCode !== 0) {
    // Non-zero exit -- error
  } else if (exitCode === undefined) {
    // User forcibly closed terminal (trash icon) or custom execution without exit code
  }
});
```

### Git Branch Name Validation
```typescript
// Source: git-scm.com/docs/git-check-ref-format
// Pre-check regex (fast, catches most invalid names before hitting git)
export function isValidBranchName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;

  // Cannot start with - or .
  if (name.startsWith("-") || name.startsWith(".")) return false;

  // Cannot end with .lock or /
  if (name.endsWith(".lock") || name.endsWith("/")) return false;

  // Cannot contain: space, ~, ^, :, ?, *, [, \, control chars, ..
  if (/[\s~^:?*\[\\]/.test(name)) return false;
  if (name.includes("..")) return false;

  // Cannot contain @{
  if (name.includes("@{")) return false;

  // Cannot be single @
  if (name === "@") return false;

  // Cannot contain consecutive slashes
  if (name.includes("//")) return false;

  // No component can start with .
  if (name.split("/").some(part => part.startsWith("."))) return false;

  // No ASCII control characters (0x00-0x1F, 0x7F)
  if (/[\x00-\x1f\x7f]/.test(name)) return false;

  return true;
}
```

### Confirmation Dialog Pattern (Agent Deletion)
```typescript
// Source: project convention from Phase 1 (QuickPick patterns)
const warningMessage = agent.status === "running"
  ? `Agent '${agentName}' is still running. Delete anyway? This removes the worktree and branch.`
  : `Delete agent '${agentName}'? This removes the worktree and branch.`;

const confirmed = await vscode.window.showWarningMessage(
  warningMessage,
  { modal: true },
  "Delete"
);

if (confirmed !== "Delete") return;
```

### Extension Activation with New Services
```typescript
// Source: project convention from Phase 1 extension.ts
export function activate(context: vscode.ExtensionContext): void {
  // 1. Create service singletons (existing)
  const gitService = new GitService();
  const worktreeService = new WorktreeService(gitService, context.workspaceState);
  const repoConfigService = new RepoConfigService(context.workspaceState, gitService);

  // 2. Create new Phase 2 services
  const agentService = new AgentService(context.workspaceState, worktreeService);
  const terminalService = new TerminalService((agentName, repoPath, status, exitCode) => {
    agentService.updateStatus(repoPath, agentName, status, exitCode);
  });

  // 3. Register commands (existing + new)
  registerRepoCommands(context, repoConfigService);
  registerAgentCommands(context, agentService, terminalService, repoConfigService);

  // 4. Add terminal service to subscriptions for cleanup
  context.subscriptions.push({ dispose: () => terminalService.dispose() });

  // 5. Reconcile agent states on activation
  // Any agent with status "running" should be reset to "created" since terminals are lost
  agentService.reconcileOnActivation();

  // ... existing git health check and worktree reconciliation
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `terminal.processId` for exit detection | `onDidCloseTerminal` + `TerminalExitStatus` | VS Code 1.71+ (stable) | No need to poll processId; exit code + reason available directly |
| Custom pty for extension terminals | TerminalOptions with shellPath/shellArgs | Always available | Real terminals are simpler for running existing CLI tools |
| `TerminalExitStatus.code` only | `TerminalExitStatus.reason` (enum) added | VS Code 1.72+ | Can distinguish process exit vs user close vs shutdown vs extension dispose |

**Deprecated/outdated:**
- Nothing in the terminal API is deprecated that affects this phase. The `shellPath` + `shellArgs` approach in TerminalOptions is stable and well-supported.

## Open Questions

1. **Claude Code CLI Path Resolution**
   - What we know: Claude Code is typically installed globally via npm (`npm install -g @anthropic-ai/claude-code`) and available as `claude` in PATH.
   - What's unclear: Whether we should resolve the full path to the `claude` binary, or rely on PATH. On some systems, VS Code integrated terminals may have a different PATH than the user's shell.
   - Recommendation: Use bare `claude` as shellPath (simplest, works for most setups). If users report "command not found", a future enhancement can add a setting for custom CLI path. Detect error via exit code 127.

2. **Terminal Show Behavior on Agent Focus**
   - What we know: `terminal.show(true)` shows the terminal without stealing focus from the editor. `terminal.show()` (or `show(false)`) takes focus.
   - What's unclear: The exact UX desired when focusing an agent -- should the terminal take focus or preserve editor focus?
   - Recommendation: Use `terminal.show()` (take focus) since the user explicitly chose to focus this agent. The Phase 3 sidebar click handler can decide on preserveFocus behavior.

3. **Initial Prompt Quoting for Shell**
   - What we know: `shellArgs: [initialPrompt]` passes the prompt as a single argument to `claude`. Claude Code CLI accepts `claude "your prompt"` syntax.
   - What's unclear: Whether shellArgs handles quoting correctly for prompts containing special characters (quotes, dollar signs, backticks).
   - Recommendation: VS Code's createTerminal handles shellArgs array elements correctly (each element is a separate argv entry, no shell interpretation). This is safe. Test with edge-case prompts in validation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (exists, includes `test/unit/**/*.test.ts`) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | Create agent: validate name, persist entry, create worktree | unit | `npx vitest run test/unit/agent.service.test.ts -t "createAgent"` | No -- Wave 0 |
| AGENT-01 | Create agent command: repo picker, name input, prompt input | unit | `npx vitest run test/unit/agent.commands.test.ts -t "createAgent"` | No -- Wave 0 |
| AGENT-02 | Delete agent: dispose terminal, remove worktree, remove entry | unit | `npx vitest run test/unit/agent.service.test.ts -t "deleteAgent"` | No -- Wave 0 |
| AGENT-02 | Delete agent command: confirmation dialog, running agent warning | unit | `npx vitest run test/unit/agent.commands.test.ts -t "deleteAgent"` | No -- Wave 0 |
| AGENT-05 | Status transitions: created -> running -> finished/error | unit | `npx vitest run test/unit/agent.service.test.ts -t "status"` | No -- Wave 0 |
| TERM-01 | Terminal creation with correct shellPath, args, cwd | unit | `npx vitest run test/unit/terminal.service.test.ts -t "createTerminal"` | No -- Wave 0 |
| TERM-01 | Terminal close handler updates agent status | unit | `npx vitest run test/unit/terminal.service.test.ts -t "handleTerminalClose"` | No -- Wave 0 |
| TERM-02 | Multiple concurrent agents have independent terminals | unit | `npx vitest run test/unit/terminal.service.test.ts -t "concurrent"` | No -- Wave 0 |
| PERF-01 | Agent created without terminal, terminal created on focus | unit | `npx vitest run test/unit/agent.service.test.ts -t "lazy"` | No -- Wave 0 |
| N/A | Branch name validation rules | unit | `npx vitest run test/unit/branch-validation.test.ts` | No -- Wave 0 |
| N/A | Agent reconciliation on activation | unit | `npx vitest run test/unit/agent.service.test.ts -t "reconcile"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/unit/agent.service.test.ts` -- covers AGENT-01, AGENT-02, AGENT-05, PERF-01
- [ ] `test/unit/terminal.service.test.ts` -- covers TERM-01, TERM-02
- [ ] `test/unit/agent.commands.test.ts` -- covers AGENT-01 command flow, AGENT-02 command flow
- [ ] `test/unit/branch-validation.test.ts` -- covers branch name validation utility
- [ ] `test/__mocks__/vscode.ts` -- extend with: `window.createTerminal`, `window.onDidCloseTerminal`, `window.onDidChangeActiveTerminal`, `window.terminals`, `window.showWarningMessage` modal support, `TerminalExitReason` enum, `TerminalExitStatus` interface

## Sources

### Primary (HIGH confidence)
- VS Code API TypeScript definitions (`node_modules/@types/vscode/index.d.ts`) -- Terminal, TerminalOptions, ExtensionTerminalOptions, Pseudoterminal, TerminalExitStatus, TerminalExitReason, TerminalState interfaces and enums
- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api) -- createTerminal overloads, onDidCloseTerminal, onDidOpenTerminal, onDidChangeTerminalState events
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) -- All CLI flags including `claude "prompt"`, `--resume`, `--continue`, `--dangerously-skip-permissions`
- [Git check-ref-format](https://git-scm.com/docs/git-check-ref-format) -- Authoritative branch name validation rules

### Secondary (MEDIUM confidence)
- [VS Code Terminal Sample Extension](https://github.com/microsoft/vscode-extension-samples/blob/main/terminal-sample/src/extension.ts) -- Working code patterns for terminal API usage
- [VS Code Terminal Advanced Docs](https://code.visualstudio.com/docs/terminal/advanced) -- Terminal signal handling, graceful shutdown
- [TerminalExitStatus.reason PR #152833](https://github.com/microsoft/vscode/pull/152833) -- TerminalExitReason enum history

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, uses established Phase 1 patterns and VS Code stable APIs
- Architecture: HIGH -- patterns derived from existing Phase 1 codebase conventions + official VS Code API types
- Pitfalls: HIGH -- terminal lifecycle, exit status, and validation edge cases verified against VS Code type definitions
- Claude Code CLI: HIGH -- flags and usage verified against official documentation at code.claude.com

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable APIs, unlikely to change)
