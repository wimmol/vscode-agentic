# Phase 4: Git Workflow and Merge Protection - Research

**Researched:** 2026-03-04
**Domain:** VS Code extension diff views, git branch comparison, `gh` CLI integration, TreeView conditional menus
**Confidence:** HIGH

## Summary

Phase 4 adds diff review, PR creation, and merge protection to the VS Code Agentic extension. The core technical challenges are: (1) detecting diffs between an agent's branch and the staging branch using git commands, (2) presenting changed files and opening VS Code's native diff editor for per-file review, (3) shelling out to `gh pr create` for PR creation, and (4) guarding agent deletion against unmerged changes.

The existing codebase provides strong foundations: `GitService.exec()` for running git commands, `RepoConfigService.getForRepo()` for accessing the staging branch name, `AgentTreeItem.contextValue` for conditional menu visibility, and established patterns for command registration and service wiring. The main new capability needed is a `DiffService` that runs `git diff` and `git merge-base` commands, plus a `TextDocumentContentProvider` to serve file content at specific git refs so VS Code's built-in `vscode.diff` command can display diffs.

**Primary recommendation:** Use a QuickPick-based changed files list (each file opens a `vscode.diff` view), shell out to `gh pr create` via `execFile`, and add a merge guard check to both delete command paths before calling `agentService.deleteAgent()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Diff review trigger: both inline button on agent tile AND context menu "Review Changes" -- consistent with existing pattern (trash icon + Delete Agent)
- Diff scope: multi-file changed files list (like VS Code's SCM view) -- user clicks individual files for per-file diffs
- Diff detection: auto-detect on agent status change (finished, error, etc.) -- merge/review button appears/disappears automatically
- Button appears on ALL agents with diffs vs staging, not just finished ones -- user may want to review in-progress work
- PR creation: shell out to `gh pr create --base staging --head agent-branch` in a terminal
- Leverages user's existing `gh` auth -- no OAuth or GitHub API integration needed
- Show confirmation summary before creating: base branch, head branch, number of changed files, confirm button
- Show PR URL on success via VS Code information message
- Merge/review button opens the diff review (changed files list) -- NOT direct PR creation
- PR creation is a separate action available after reviewing diffs (separate button or command)
- Two-step workflow: review changes first, then create PR if satisfied
- Hard block: user CANNOT delete an agent with unmerged changes -- no force-delete option
- Error message: "Agent has unmerged changes vs staging. Review changes or create a PR first."
- Offer actionable buttons: "Review Changes" / "Cancel" -- guides user to the right action
- Both `deleteAgent` (command palette) and `deleteAgentFromTile` (sidebar) enforce the same guard

### Claude's Discretion
- Exact git diff commands for change detection (diff --stat, rev-list, merge-base)
- How changed files list is presented (QuickPick, custom webview, or SCM-like panel)
- Diff detection debouncing/caching strategy
- `gh` CLI error handling (not installed, not authenticated)
- PR title/body auto-generation from agent name and prompt

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GIT-03 | User can open VS Code's native diff view to review changes between an agent's branch and the staging branch | TextDocumentContentProvider + `vscode.diff` command pattern; git merge-base + diff --name-only for file list; QuickPick for file selection |
| GIT-04 | User can create a PR from an agent branch to the staging branch after reviewing diffs | `gh pr create --base staging --head agent-branch` via execFile; confirmation dialog pattern; PR URL display |
| AGENT-04 | User cannot delete an agent whose branch has unmerged changes vs staging (merge protection) | DiffService.hasUnmergedChanges() guard in both delete paths; actionable error dialog with "Review Changes" button |
| UI-05 | Agent tile shows a merge button when the agent's branch has diffs vs the staging branch | Conditional contextValue on AgentTreeItem ("agentItem" vs "agentItemWithDiffs"); package.json `when` clause filtering; diff status cache updated on agent status changes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode API | ^1.96.0 | Extension host APIs (diff command, QuickPick, TextDocumentContentProvider, TreeView) | Already in use; native diff editor is the highest-quality diff experience |
| git CLI | system | Branch comparison via merge-base, diff --name-only, show | Already used by GitService.exec(); no new dependency |
| gh CLI | system | PR creation via `gh pr create` | User decision -- leverages existing auth, no API integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:child_process | built-in | execFile for `gh pr create` | PR creation command; already used by GitService |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| QuickPick for changed files | `vscode.changes` (multi-diff editor) | `vscode.changes` resourceList format is undocumented; QuickPick is reliable, well-documented, and matches existing UX patterns |
| TextDocumentContentProvider | VS Code Git Extension API (`getAPI(1)`, `toGitUri`) | Git Extension API requires depending on vscode.git extension being active and its API shape; custom ContentProvider gives full control with no external dependency |
| execFile for gh | vscode.window.createTerminal for gh | execFile allows capturing stdout (PR URL) directly; terminal approach would require parsing terminal output |

**Installation:**
No new packages needed. All capabilities come from VS Code API and system CLIs already in use.

## Architecture Patterns

### Recommended Project Structure
```
src/
  services/
    diff.service.ts          # NEW: git diff detection, changed files list, unmerged check
  providers/
    git-content.provider.ts  # NEW: TextDocumentContentProvider for file content at git refs
  commands/
    diff.commands.ts         # NEW: reviewChanges, createPR command handlers
  views/
    agent-tree-items.ts      # MODIFIED: conditional contextValue for diff status
    agent-tree-provider.ts   # MODIFIED: pass diff status to AgentTreeItem constructor
```

### Pattern 1: DiffService for Git Comparison Logic
**What:** Centralizes all git diff operations (merge-base, changed files, has-unmerged-changes) into a single service
**When to use:** Whenever the extension needs to know if an agent has diffs or list changed files
**Example:**
```typescript
// Source: project pattern (GitService.exec + git CLI)
export class DiffService {
  constructor(
    private readonly git: GitService,
    private readonly repoConfig: RepoConfigService,
  ) {}

  /**
   * Returns true if the agent branch has commits not in the staging branch.
   * Uses merge-base to find common ancestor, then checks if branches have diverged.
   */
  async hasUnmergedChanges(repoPath: string, agentBranch: string): Promise<boolean> {
    const config = this.repoConfig.getForRepo(repoPath);
    if (!config) return false;

    const staging = config.stagingBranch;

    // Check if staging branch exists
    const stagingExists = await this.git.branchExists(repoPath, staging);
    if (!stagingExists) return false;

    try {
      // git diff --name-only staging...agentBranch (three-dot = since merge-base)
      const output = await this.git.exec(repoPath, [
        "diff", "--name-only", `${staging}...${agentBranch}`,
      ]);
      return output.trim().length > 0;
    } catch {
      return false; // If diff fails, assume no unmerged changes
    }
  }

  /**
   * Returns list of changed file paths between staging and agent branch.
   */
  async getChangedFiles(repoPath: string, agentBranch: string): Promise<string[]> {
    const config = this.repoConfig.getForRepo(repoPath);
    if (!config) return [];

    const staging = config.stagingBranch;
    try {
      const output = await this.git.exec(repoPath, [
        "diff", "--name-only", `${staging}...${agentBranch}`,
      ]);
      return output.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Returns the merge-base commit between staging and agent branch.
   */
  async getMergeBase(repoPath: string, agentBranch: string): Promise<string> {
    const config = this.repoConfig.getForRepo(repoPath);
    if (!config) throw new Error("Repo not configured");

    return this.git.exec(repoPath, [
      "merge-base", config.stagingBranch, agentBranch,
    ]);
  }
}
```

### Pattern 2: TextDocumentContentProvider for Git Ref Content
**What:** Registers a custom URI scheme (`agentic-git`) that serves file content at a specific git ref
**When to use:** To create read-only document URIs for the left side (staging) of diff views
**Example:**
```typescript
// Source: VS Code API docs (TextDocumentContentProvider + vscode.diff)
import * as vscode from "vscode";
import type { GitService } from "../services/git.service.js";

export class GitContentProvider implements vscode.TextDocumentContentProvider {
  static readonly SCHEME = "agentic-git";

  constructor(private readonly git: GitService) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    // URI format: agentic-git:/<repoPath>?ref=<ref>&path=<relativePath>
    const params = new URLSearchParams(uri.query);
    const ref = params.get("ref") ?? "HEAD";
    const filePath = params.get("path") ?? "";
    const repoPath = params.get("repo") ?? "";

    try {
      return await this.git.exec(repoPath, ["show", `${ref}:${filePath}`]);
    } catch {
      return ""; // File doesn't exist at this ref
    }
  }

  /**
   * Builds a URI for a file at a specific git ref.
   */
  static buildUri(repoPath: string, ref: string, filePath: string): vscode.Uri {
    return vscode.Uri.parse(
      `${GitContentProvider.SCHEME}:/${filePath}?repo=${encodeURIComponent(repoPath)}&ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(filePath)}`
    );
  }
}
```

### Pattern 3: Conditional contextValue for Dynamic Menu Visibility
**What:** Agent tiles get different contextValue based on whether they have diffs vs staging
**When to use:** To show/hide the "Review Changes" and "Create PR" inline buttons
**Example:**
```typescript
// Source: VS Code TreeView API docs (contextValue + when clauses)
// In AgentTreeItem constructor:
this.contextValue = hasDiffs ? "agentItemWithDiffs" : "agentItem";

// In package.json menus:
// {
//   "command": "vscode-agentic.reviewChanges",
//   "when": "view == vscode-agentic.agents && viewItem == agentItemWithDiffs",
//   "group": "inline"
// }
```

### Pattern 4: QuickPick for Changed Files List
**What:** Shows a QuickPick with changed files; selecting one opens vscode.diff for that file
**When to use:** When user clicks "Review Changes" on an agent tile
**Example:**
```typescript
// Source: VS Code QuickPick API + vscode.diff built-in command
async function showChangedFiles(
  repoPath: string,
  agentBranch: string,
  stagingBranch: string,
  changedFiles: string[],
): Promise<void> {
  const items = changedFiles.map(f => ({
    label: f.split("/").pop() || f,
    description: f,
    _filePath: f,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `${changedFiles.length} file(s) changed vs ${stagingBranch}`,
    title: `Changes: ${agentBranch} vs ${stagingBranch}`,
  });

  if (selected) {
    const leftUri = GitContentProvider.buildUri(repoPath, stagingBranch, selected._filePath);
    const rightUri = GitContentProvider.buildUri(repoPath, agentBranch, selected._filePath);
    await vscode.commands.executeCommand(
      "vscode.diff",
      leftUri,
      rightUri,
      `${selected._filePath} (${stagingBranch} <-> ${agentBranch})`,
    );
  }
}
```

### Pattern 5: Merge Guard on Delete
**What:** Checks for unmerged changes before allowing agent deletion, with actionable error
**When to use:** In both deleteAgent (command palette) and deleteAgentFromTile (sidebar)
**Example:**
```typescript
// Source: project pattern (showWarningMessage with action buttons)
async function guardedDelete(
  repoPath: string,
  agentName: string,
  diffService: DiffService,
  agentService: AgentService,
): Promise<boolean> {
  const hasUnmerged = await diffService.hasUnmergedChanges(repoPath, agentName);
  if (hasUnmerged) {
    const action = await vscode.window.showWarningMessage(
      `Agent '${agentName}' has unmerged changes vs staging. Review changes or create a PR first.`,
      "Review Changes",
      "Cancel",
    );
    if (action === "Review Changes") {
      await vscode.commands.executeCommand(
        "vscode-agentic.reviewChanges",
        repoPath,
        agentName,
      );
    }
    return false; // Block deletion
  }
  return true; // Allow deletion
}
```

### Anti-Patterns to Avoid
- **Depending on VS Code Git Extension API:** The `vscode.git` extension API (`getAPI(1)`) requires the Git extension to be active, introduces version coupling, and the `toGitUri` function is internal to that extension. Use our own `GitService.exec()` + `TextDocumentContentProvider` instead.
- **Running `gh` in a VS Code terminal:** Creates a terminal the user sees but cannot easily get output from. Use `execFile` to capture stdout/stderr directly.
- **Checking diffs synchronously in getChildren():** TreeDataProvider.getChildren must be fast. Cache diff status and update asynchronously on agent change events.
- **Using `vscode.changes` for multi-file diff:** The `resourceList` parameter format is undocumented in the public API. QuickPick is reliable and well-understood.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff editor UI | Custom webview diff viewer | `vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, title)` | VS Code's native diff editor has syntax highlighting, inline editing, minimap, and keyboard shortcuts |
| File content at git ref | Read worktree files directly, temp files | `git show <ref>:<path>` via GitService.exec() + TextDocumentContentProvider | Git show is the standard way to read content at any ref; ContentProvider makes it a proper URI |
| PR creation UI | Custom webview form | `gh pr create` CLI via execFile + confirmation dialog | User already has gh auth configured; CLI handles all GitHub API complexity |
| Branch comparison logic | Custom diff algorithm | `git diff --name-only staging...agentBranch` (three-dot notation) | Three-dot notation automatically computes merge-base; one command does what two would otherwise |

**Key insight:** VS Code's built-in diff command and git CLI's three-dot diff notation together provide a complete diff review experience with zero custom UI and zero new dependencies.

## Common Pitfalls

### Pitfall 1: Staging Branch Doesn't Exist
**What goes wrong:** `git diff --name-only staging...agent-branch` fails with a fatal error if the staging branch doesn't exist locally (e.g., user configured "staging" but never created it).
**Why it happens:** User may configure the staging branch name before the branch exists in the repo.
**How to avoid:** Always check `git.branchExists(repoPath, stagingBranch)` before running diff commands. If staging branch doesn't exist, treat as "no diffs" (not an error) and don't show the review button.
**Warning signs:** GitError with "unknown revision" in the error message.

### Pitfall 2: Diff Status Cache Stale After External Git Operations
**What goes wrong:** User pushes or merges outside VS Code, but the extension still shows "has diffs" or "no diffs" based on stale cache.
**Why it happens:** Extension only updates diff status on `onDidChangeAgents` events (status changes), not on external git operations.
**How to avoid:** Re-check diff status on each tree refresh (debounced). Consider a periodic refresh timer (e.g., every 30 seconds) or refresh on window focus. Keep the cache lifetime short.
**Warning signs:** Review button appearing/disappearing inconsistently.

### Pitfall 3: Async Diff Check in TreeDataProvider Blocks UI
**What goes wrong:** `getChildren()` awaits git commands for every agent on every tree refresh, causing visible lag in the sidebar.
**Why it happens:** Git exec calls take 50-200ms each; with 5 agents that's up to 1 second.
**How to avoid:** Maintain a `Map<string, boolean>` diff status cache. Update cache asynchronously on agent change events. `getChildren()` reads from cache only (synchronous). Fire a tree refresh after cache updates.
**Warning signs:** Sidebar flickers or freezes when switching agents.

### Pitfall 4: `gh` CLI Not Installed or Not Authenticated
**What goes wrong:** `execFile("gh", ...)` throws ENOENT if gh is not installed, or gh returns exit code 1 if not authenticated.
**Why it happens:** Not all users have gh CLI installed; those who do may not have run `gh auth login`.
**How to avoid:** Catch errors from gh execution. For ENOENT, show a message: "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/ to create PRs." For auth errors, show: "GitHub CLI is not authenticated. Run `gh auth login` in your terminal."
**Warning signs:** Command fails silently or shows cryptic error.

### Pitfall 5: Race Condition Between Diff Check and Delete
**What goes wrong:** User clicks delete, merge guard passes (no diffs), but between the check and the actual deletion, the agent gets new commits.
**Why it happens:** Async gap between diff check and worktree removal.
**How to avoid:** This is a very unlikely edge case (agent would need to receive commits in the milliseconds between check and delete). The guard is a user-facing safety check, not a database transaction. Accept the race condition as negligible.
**Warning signs:** None in practice; purely theoretical.

### Pitfall 6: URI Encoding Issues in TextDocumentContentProvider
**What goes wrong:** File paths with spaces, special characters, or non-ASCII characters break the URI parsing in `provideTextDocumentContent`.
**Why it happens:** Query parameters need proper encoding/decoding.
**How to avoid:** Always use `encodeURIComponent` when building URIs and `URLSearchParams` for parsing. Test with file paths containing spaces and special characters.
**Warning signs:** "file not found" errors for files that exist, broken diff views.

## Code Examples

Verified patterns from official sources and project conventions:

### Opening VS Code's Native Diff Editor
```typescript
// Source: https://code.visualstudio.com/api/references/commands (vscode.diff)
// Parameters: leftUri, rightUri, title, options?
await vscode.commands.executeCommand(
  "vscode.diff",
  vscode.Uri.parse("agentic-git:/file.ts?repo=/repo&ref=staging&path=src/file.ts"),
  vscode.Uri.parse("agentic-git:/file.ts?repo=/repo&ref=agent-branch&path=src/file.ts"),
  "src/file.ts (staging <-> agent-branch)",
);
```

### Registering a TextDocumentContentProvider
```typescript
// Source: https://code.visualstudio.com/api/extension-guides/virtual-documents
const provider = new GitContentProvider(gitService);
const registration = vscode.workspace.registerTextDocumentContentProvider(
  GitContentProvider.SCHEME,
  provider,
);
context.subscriptions.push(registration);
```

### Git Three-Dot Diff for Changed Files
```bash
# Source: https://git-scm.com/docs/git-diff
# Three-dot notation: diff since merge-base (what agent branch introduced)
git diff --name-only staging...agent-branch

# With stat for file summary (additions/deletions per file)
git diff --stat staging...agent-branch

# Get merge-base commit explicitly
git merge-base staging agent-branch
```

### Conditional contextValue in TreeItem
```typescript
// Source: https://code.visualstudio.com/api/extension-guides/tree-view
// Set different contextValue based on agent state:
this.contextValue = hasDiffs ? "agentItemWithDiffs" : "agentItem";

// package.json when clause:
// "when": "viewItem == agentItemWithDiffs"
// This makes the review button appear ONLY on agents with diffs
```

### Executing `gh pr create` via execFile
```typescript
// Source: https://cli.github.com/manual/gh_pr_create + Node.js child_process docs
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

async function createPR(
  repoPath: string,
  baseBranch: string,
  headBranch: string,
  title: string,
  body: string,
): Promise<string> {
  const { stdout } = await execFileAsync("gh", [
    "pr", "create",
    "--base", baseBranch,
    "--head", headBranch,
    "--title", title,
    "--body", body,
  ], {
    cwd: repoPath,
    timeout: 30_000,
  });
  return stdout.trim(); // Returns PR URL on success
}
```

### Agent Deletion with Merge Guard
```typescript
// Source: project pattern (showWarningMessage with modal + action buttons)
const action = await vscode.window.showWarningMessage(
  `Agent '${agentName}' has unmerged changes vs staging. Review changes or create a PR first.`,
  { modal: false },  // Non-modal so user can see the sidebar
  "Review Changes",
  "Cancel",
);
if (action === "Review Changes") {
  await vscode.commands.executeCommand(
    "vscode-agentic.reviewChanges",
    repoPath,
    agentName,
  );
}
// Return without deleting -- hard block
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Temp files for diff | TextDocumentContentProvider + custom URI scheme | VS Code 1.x (long established) | No temp file cleanup needed; URIs are virtual |
| Single-file diff only (`vscode.diff`) | Multi-diff editor (`vscode.changes`) | VS Code 1.85+ (2023) | Can show all changes in one view -- BUT resourceList format undocumented |
| Manual merge-base + diff | Three-dot diff notation (`A...B`) | Git 1.7+ (long established) | Single command replaces two; computes merge-base automatically |
| GitHub API for PR creation | `gh` CLI (`gh pr create`) | gh CLI 1.0 (2020) | No OAuth setup, no API tokens in extension; leverages user's existing auth |

**Deprecated/outdated:**
- Nothing relevant deprecated in this domain. All patterns are stable.

## Open Questions

1. **`vscode.changes` resourceList format**
   - What we know: The command exists and opens a multi-diff editor. Takes `title` and `resourceList` parameters.
   - What's unclear: The exact format of `resourceList` -- is it `[string, Uri, Uri][]`? Undocumented in public API.
   - Recommendation: Use QuickPick + per-file `vscode.diff` instead. Reliable, documented, matches project UX patterns.

2. **Diff status refresh frequency**
   - What we know: Git diff commands take 50-200ms per agent. Sidebar refreshes on `onDidChangeAgents`.
   - What's unclear: Whether refresh-on-agent-change is sufficient, or if periodic refresh is needed for external git operations.
   - Recommendation: Start with refresh-on-agent-change only. Add periodic refresh if users report stale status. Keep it simple.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (includes `test/unit/**/*.test.ts`, aliases `vscode` to mock) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GIT-03 | DiffService.getChangedFiles returns correct file list | unit | `npx vitest run test/unit/diff.service.test.ts -t "getChangedFiles" -x` | No -- Wave 0 |
| GIT-03 | GitContentProvider serves file content at git ref | unit | `npx vitest run test/unit/git-content.provider.test.ts -x` | No -- Wave 0 |
| GIT-03 | reviewChanges command shows QuickPick and opens vscode.diff | unit | `npx vitest run test/unit/diff.commands.test.ts -t "reviewChanges" -x` | No -- Wave 0 |
| GIT-04 | createPR command calls gh CLI with correct args | unit | `npx vitest run test/unit/diff.commands.test.ts -t "createPR" -x` | No -- Wave 0 |
| GIT-04 | createPR shows confirmation before executing | unit | `npx vitest run test/unit/diff.commands.test.ts -t "confirmation" -x` | No -- Wave 0 |
| GIT-04 | createPR handles gh not installed / not authenticated | unit | `npx vitest run test/unit/diff.commands.test.ts -t "gh error" -x` | No -- Wave 0 |
| AGENT-04 | deleteAgent blocked when hasUnmergedChanges returns true | unit | `npx vitest run test/unit/diff.commands.test.ts -t "merge guard" -x` | No -- Wave 0 |
| AGENT-04 | deleteAgentFromTile blocked when hasUnmergedChanges returns true | unit | `npx vitest run test/unit/diff.commands.test.ts -t "merge guard tile" -x` | No -- Wave 0 |
| AGENT-04 | merge guard offers "Review Changes" action button | unit | `npx vitest run test/unit/diff.commands.test.ts -t "Review Changes action" -x` | No -- Wave 0 |
| UI-05 | AgentTreeItem sets contextValue "agentItemWithDiffs" when hasDiffs=true | unit | `npx vitest run test/unit/agent-tree-items.test.ts -t "contextValue" -x` | Partially -- existing file, new tests needed |
| UI-05 | DiffService.hasUnmergedChanges returns true/false correctly | unit | `npx vitest run test/unit/diff.service.test.ts -t "hasUnmergedChanges" -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/unit/diff.service.test.ts` -- covers GIT-03, AGENT-04 (DiffService unit tests)
- [ ] `test/unit/git-content.provider.test.ts` -- covers GIT-03 (TextDocumentContentProvider tests)
- [ ] `test/unit/diff.commands.test.ts` -- covers GIT-03, GIT-04, AGENT-04 (command handler tests)
- [ ] Update `test/unit/agent-tree-items.test.ts` -- covers UI-05 (new contextValue tests)

No new framework install needed -- Vitest already configured and operational.

## Sources

### Primary (HIGH confidence)
- [VS Code Built-in Commands Reference](https://code.visualstudio.com/api/references/commands) -- `vscode.diff` and `vscode.changes` command documentation
- [VS Code TextDocumentContentProvider / Virtual Documents](https://code.visualstudio.com/api/extension-guides/virtual-documents) -- custom URI scheme for serving file content
- [VS Code TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view) -- contextValue for conditional menu visibility
- [VS Code When Clause Contexts](https://code.visualstudio.com/api/references/when-clause-contexts) -- viewItem context key for menu when clauses
- [gh pr create CLI manual](https://cli.github.com/manual/gh_pr_create) -- PR creation command options and output
- [Git diff documentation](https://git-scm.com/docs/git-diff) -- three-dot notation, --name-only, merge-base
- [VS Code Git Extension API (git.d.ts)](https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts) -- Repository interface, diffBetween, getMergeBase methods

### Secondary (MEDIUM confidence)
- [How VS Code Git Extension Creates Git URIs](https://www.codegenes.net/blog/how-does-git-diff-work-in-the-visual-studio-code-git-extension/) -- toGitUri pattern explanation
- [VS Code Git Extension DeepWiki](https://deepwiki.com/microsoft/vscode/10-git-extension) -- architecture overview
- [Git Tree Compare Extension](https://marketplace.visualstudio.com/items?itemName=letmaik.git-tree-compare) -- reference implementation of branch diff in VS Code extension

### Tertiary (LOW confidence)
- `vscode.changes` resourceList format -- undocumented publicly; only the command name and basic description are in official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- uses only VS Code built-in APIs, git CLI, and gh CLI; all well-documented
- Architecture: HIGH -- patterns follow existing project conventions (services, commands, views); TextDocumentContentProvider is a well-established VS Code pattern
- Pitfalls: HIGH -- identified from direct experience with VS Code extension development patterns and git CLI behavior; staging branch existence is a known edge case

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain -- VS Code extension APIs and git CLI are mature)
