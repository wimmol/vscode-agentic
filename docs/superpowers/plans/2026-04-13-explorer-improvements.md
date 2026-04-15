# Explorer Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live file watching, a Source Control webview with commit/push/pull, and fix explorer bugs.

**Architecture:** Three independent work streams: (1) `FileExplorerProvider` gains `FileSystemWatcher` instances that auto-refresh the tree on disk changes. (2) A new `SourceControlProvider` webview below the explorer shows changed files, a commit message input with suggest, and commit/push/pull buttons. (3) Targeted bug fixes in the explorer for silent errors, stale state, and missing refresh.

**Tech Stack:** VS Code Extension API (`FileSystemWatcher`, `WebviewViewProvider`, `RelativePattern`), React 19, `child_process.spawn` for git commands, VS Code theme CSS variables, Codicons.

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `src/services/SourceControlProvider.ts` | WebviewViewProvider for the Source Control panel. Manages git commands (status, commit, push, pull, suggest), scoping to current explorer root, and webview communication. |
| `src/services/GitService.ts` | Thin wrapper around git CLI. Spawns git processes with timeouts and `--no-optional-locks`. Methods: `status`, `commit`, `push`, `pull`, `diffStat`. Used by SourceControlProvider. |
| `src/ui/sourceControl/SourceControlPage.tsx` | Page component — hooks for state, renders SourceControlView. |
| `src/ui/sourceControl/SourceControlView.tsx` | Presentational view — renders commit input, buttons, changed files list. |
| `src/ui/sourceControl/useSourceControl.ts` | Hook — manages webview state, message handling, postMessage commands. |
| `src/ui/sourceControl/index.tsx` | Webview entry point — acquireVsCodeApi, createRoot, render. |
| `src/ui/sourceControl/styles/sourceControl.css` | Styles for the source control view using VS Code theme vars. |
| `src/constants/sourceControl.ts` | Constants for source control view ID, command names, messages. |
| `src/types/sourceControl.ts` | Shared types for extension <-> webview messages. |

### Modified files

| File | Changes |
|------|---------|
| `src/services/FileExplorerProvider.ts` | Add watcher lifecycle, debounced refresh on fs events, stale expanded path cleanup, scope change event, error placeholder items. |
| `src/constants/explorer.ts` | Add `WATCHER_DEBOUNCE_MS`. |
| `src/extension.ts` | Register SourceControlProvider, refresh command, wire scope events. |
| `src/ui/App.tsx` | Route to SourceControlPage when mounted in sourceControl webview. |
| `src/ui/index.tsx` | Detect which webview we're in, export vscode API for both panels. |
| `package.json` | Add sourceControl view, refresh command, view/title menu for refresh, new esbuild entry point in compile scripts. |
| `src/features/explorerFileOps.ts` | Fix paste conflict handling for cut operations. |

---

## Task 1: Add constants and types for Source Control

**Files:**
- Create: `src/constants/sourceControl.ts`
- Create: `src/types/sourceControl.ts`
- Modify: `src/constants/explorer.ts`
- Modify: `src/constants/views.ts`

- [ ] **Step 1: Create source control constants**

```typescript
// src/constants/sourceControl.ts

// Webview → Extension commands
export const SC_CMD_COMMIT = 'sc.commit';
export const SC_CMD_PUSH = 'sc.push';
export const SC_CMD_PULL = 'sc.pull';
export const SC_CMD_SUGGEST = 'sc.suggest';
export const SC_CMD_OPEN_DIFF = 'sc.openDiff';
export const SC_CMD_READY = 'sc.ready';

// Extension → Webview message types
export const SC_MSG_UPDATE = 'sc.update';
export const SC_MSG_SUGGEST_RESULT = 'sc.suggestResult';

// Git operation timeouts (ms)
export const GIT_STATUS_TIMEOUT_MS = 10_000;
export const GIT_COMMIT_TIMEOUT_MS = 30_000;
export const GIT_PUSH_TIMEOUT_MS = 120_000;
export const GIT_PULL_TIMEOUT_MS = 120_000;
```

- [ ] **Step 2: Create source control message types**

```typescript
// src/types/sourceControl.ts

import type {
  SC_MSG_UPDATE,
  SC_MSG_SUGGEST_RESULT,
} from '../constants/sourceControl';

// ── Data ────────────────────────────────────────────────────────

export interface FileChange {
  status: string;   // M, A, D, ?, R, etc.
  path: string;     // relative to repo root
  absPath: string;  // absolute path for opening diff
}

// ── Extension → Webview ─────────────────────────────────────────

export interface ScStateUpdateMessage {
  type: typeof SC_MSG_UPDATE;
  changes: FileChange[];
  repoName: string;
  isLoading: boolean;
}

export interface ScSuggestResultMessage {
  type: typeof SC_MSG_SUGGEST_RESULT;
  message: string;
}

export type ScExtensionToWebviewMessage = ScStateUpdateMessage | ScSuggestResultMessage;

// ── Webview → Extension ─────────────────────────────────────────

export interface ScWebviewToExtensionMessage {
  function: string;
  args: Record<string, unknown>;
}
```

- [ ] **Step 3: Add watcher debounce constant to explorer constants**

Add to `src/constants/explorer.ts`:

```typescript
export const WATCHER_DEBOUNCE_MS = 300;
```

- [ ] **Step 4: Add view constant**

Add to `src/constants/views.ts`:

```typescript
export const VIEW_SOURCE_CONTROL = 'vscode-agentic.sourceControl';
```

- [ ] **Step 5: Commit**

```bash
git add src/constants/sourceControl.ts src/types/sourceControl.ts src/constants/explorer.ts src/constants/views.ts
git commit -m "feat: add constants and types for source control view and file watcher"
```

---

## Task 2: Add file system watching to FileExplorerProvider

**Files:**
- Modify: `src/services/FileExplorerProvider.ts`

- [ ] **Step 1: Add watcher fields and scope change event**

Add these fields to the `FileExplorerProvider` class after the existing private fields (after line 48):

```typescript
  private watchers: vscode.Disposable[] = [];
  private watcherRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly _onDidChangeScope = new vscode.EventEmitter<string[]>();
  /** Fires when explorer roots change (for source control to subscribe). */
  readonly onDidChangeScope = this._onDidChangeScope.event;
```

- [ ] **Step 2: Add watcher lifecycle methods**

Add these private methods before the `dispose()` method:

```typescript
  private setupWatchers(): void {
    this.disposeWatchers();
    for (const root of this.roots) {
      const pattern = new vscode.RelativePattern(vscode.Uri.file(root), '**/*');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidCreate(() => this.debouncedWatcherRefresh());
      watcher.onDidDelete((uri) => {
        this.cleanupDeletedPath(uri.fsPath);
        this.debouncedWatcherRefresh();
      });
      // onDidChange intentionally ignored — content changes don't affect tree structure

      this.watchers.push(watcher);
    }
  }

  private disposeWatchers(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
  }

  private debouncedWatcherRefresh(): void {
    clearTimeout(this.watcherRefreshTimer);
    this.watcherRefreshTimer = setTimeout(() => {
      this._onDidChangeTreeData.fire(undefined);
    }, WATCHER_DEBOUNCE_MS);
  }

  private cleanupDeletedPath(deletedPath: string): void {
    this.expandedPaths.delete(deletedPath);
    const prefix = deletedPath + path.sep;
    for (const p of this.expandedPaths) {
      if (p.startsWith(prefix)) {
        this.expandedPaths.delete(p);
      }
    }
    this.debouncePersist();
  }
```

- [ ] **Step 3: Add WATCHER_DEBOUNCE_MS import**

Update the import from `../constants/explorer` at the top of the file (line 5-11) to include `WATCHER_DEBOUNCE_MS`:

```typescript
import {
  WORKSPACE_SCOPE_KEY,
  PERSIST_DEBOUNCE_MS,
  WATCHER_DEBOUNCE_MS,
  CONTEXT_FILE,
  CONTEXT_FOLDER,
  URI_LIST_MIME,
} from '../constants/explorer';
```

- [ ] **Step 4: Call setupWatchers on scope changes and fire scope event**

In `showAllRepos` method, add `this.setupWatchers()` and fire scope event. Replace lines 91-104:

```typescript
  showAllRepos(repoPaths?: string[]): void {
    if (this.mode === 'all' && !repoPaths) {
      return;
    }
    this.mode = 'all';
    this.scopeKey = WORKSPACE_SCOPE_KEY;
    this.headerItem = ScopeHeaderItem.workspace();
    if (repoPaths) {
      this.roots = repoPaths;
      this.setupWatchers();
      this._onDidChangeScope.fire(this.roots);
      void this.loadExpandedAndRefresh();
    } else {
      void this.loadAndRefresh();
    }
  }
```

In `showRepo` method, add `this.setupWatchers()` and fire scope event. Replace lines 106-122:

```typescript
  showRepo(repoId: string, repoPath: string, repoName: string, branchName?: string, isWorktree?: boolean): void {
    const header = branchName
      ? ScopeHeaderItem.branch(repoName, branchName, isWorktree ?? false)
      : ScopeHeaderItem.repo(repoName);
    if (this.mode === 'scoped' && this.scopeKey === repoId) {
      if (this.headerItem.label !== header.label || this.headerItem.description !== header.description) {
        this.headerItem = header;
        this._onDidChangeTreeData.fire(undefined);
      }
      return;
    }
    this.headerItem = header;
    this.mode = 'scoped';
    this.scopeKey = repoId;
    this.roots = [repoPath];
    this.setupWatchers();
    this._onDidChangeScope.fire(this.roots);
    void this.loadExpandedAndRefresh();
  }
```

In `loadAndRefresh`, add `this.setupWatchers()` and fire scope event after roots are loaded. Replace lines 225-231:

```typescript
  private async loadAndRefresh(): Promise<void> {
    const gen = ++this.generation;
    const repos = await this.storage.getAllRepositories();
    if (gen !== this.generation) return;
    this.roots = repos.map((r) => r.localPath);
    this.setupWatchers();
    this._onDidChangeScope.fire(this.roots);
    await this.loadExpandedAndRefresh(gen);
  }
```

- [ ] **Step 5: Update dispose to clean up watchers and new event emitter**

Replace the `dispose()` method:

```typescript
  dispose(): void {
    clearTimeout(this.persistTimer);
    clearTimeout(this.watcherRefreshTimer);
    this.disposeWatchers();
    this._onDidChangeTreeData.dispose();
    this._onDidChangeScope.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
```

- [ ] **Step 6: Compile and verify no errors**

Run: `cd /Users/norules/Documents/code/vscode-agentic && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/services/FileExplorerProvider.ts
git commit -m "feat: add file system watching to explorer with debounced refresh"
```

---

## Task 3: Add explorer bug fixes

**Files:**
- Modify: `src/services/FileExplorerProvider.ts`
- Modify: `src/features/explorerFileOps.ts`
- Modify: `package.json`

- [ ] **Step 1: Add error placeholder item**

In `src/services/FileExplorerProvider.ts`, add a new class after `ScopeHeaderItem` (after line 302):

```typescript
class ErrorPlaceholderItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'explorerError';
    this.iconPath = new vscode.ThemeIcon('warning');
  }
}
```

Update the `ExplorerItem` type at line 15:

```typescript
type ExplorerItem = ScopeHeaderItem | FileItem | ErrorPlaceholderItem;
```

- [ ] **Step 2: Update readDirectory to return error placeholder**

Replace the `readDirectory` method (lines 248-264):

```typescript
  private async readDirectory(dirPath: string): Promise<(FileItem | ErrorPlaceholderItem)[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => e.name !== GIT_DIR)
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        })
        .map((e) => this.createItem(path.join(dirPath, e.name), e.isDirectory()));
    } catch (err) {
      console.error('[FileExplorerProvider] readDirectory failed:', dirPath, err);
      return [new ErrorPlaceholderItem('Unable to read directory')];
    }
  }
```

- [ ] **Step 3: Add refresh command to package.json**

Add to the `commands` array in `package.json` (after the refactor command at line 150):

```json
      {
        "command": "vscode-agentic.explorer.refresh",
        "title": "Refresh",
        "icon": "$(refresh)",
        "category": "Agentic"
      }
```

Add to the `view/title` menus (after the newFolder entry at line 163):

```json
        {
          "command": "vscode-agentic.explorer.refresh",
          "when": "view == 'vscode-agentic.explorer'",
          "group": "navigation"
        }
```

- [ ] **Step 4: Register the refresh command in extension.ts**

In `src/extension.ts`, add after the `registerExplorerCommands` call at line 38:

```typescript
    vscode.commands.registerCommand('vscode-agentic.explorer.refresh', () => explorer.refresh()),
```

Add it inside the existing `context.subscriptions.push(...)` block so it becomes:

```typescript
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, provider),
    registerExplorerCommands(explorer, treeView, storage, terminalService),
    vscode.commands.registerCommand('vscode-agentic.explorer.refresh', () => explorer.refresh()),
  );
```

- [ ] **Step 5: Fix partial drop failure reporting**

In `src/services/FileExplorerProvider.ts`, replace the external URI drop handling in `handleDrop` (lines 176-194):

```typescript
    // External URI drop
    const uriItem = dataTransfer.get(URI_LIST_MIME);
    if (uriItem) {
      const raw = await uriItem.asString();
      const uris = raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((u) => vscode.Uri.parse(u));
      const errors: string[] = [];
      for (const uri of uris) {
        const dest = vscode.Uri.file(path.join(targetDir, path.basename(uri.fsPath)));
        if (uri.fsPath === dest.fsPath) continue;
        try {
          await vscode.workspace.fs.rename(uri, dest, { overwrite: false });
        } catch (err) {
          errors.push(`${path.basename(uri.fsPath)}: ${err}`);
        }
      }
      if (errors.length > 0) {
        const moved = uris.length - errors.length;
        vscode.window.showErrorMessage(
          `Moved ${moved} of ${uris.length} items. Failed: ${errors.join('; ')}`,
        );
      }
      this.refresh();
    }
```

- [ ] **Step 6: Fix cut-paste conflict handling**

In `src/features/explorerFileOps.ts`, replace the cut branch in `pasteItems` (lines 163-166):

```typescript
    if (cut) {
      if (sourceUri.fsPath === targetUri.fsPath) continue;
      if (targetUri.fsPath.startsWith(sourceUri.fsPath + path.sep)) continue;
      if (await exists(targetUri)) {
        const choice = await vscode.window.showQuickPick(
          ['Replace', 'Keep Both', 'Cancel'],
          { placeHolder: `"${baseName}" already exists in destination` },
        );
        if (!choice || choice === 'Cancel') continue;
        if (choice === 'Keep Both') {
          const ext = path.extname(baseName);
          const nameNoExt = path.basename(baseName, ext);
          let counter = 1;
          do {
            const suffix = counter === 1 ? ' copy' : ` copy ${counter}`;
            targetUri = vscode.Uri.file(path.join(dir, `${nameNoExt}${suffix}${ext}`));
            counter++;
          } while (await exists(targetUri));
        }
        // 'Replace' falls through to rename with overwrite
      }
      await vscode.workspace.fs.rename(sourceUri, targetUri, { overwrite: choice === 'Replace' });
    }
```

Wait — there's a scoping issue. The `choice` variable needs to be accessible at the `rename` call. Let me fix:

```typescript
    if (cut) {
      if (sourceUri.fsPath === targetUri.fsPath) continue;
      if (targetUri.fsPath.startsWith(sourceUri.fsPath + path.sep)) continue;
      let overwrite = false;
      if (await exists(targetUri)) {
        const choice = await vscode.window.showQuickPick(
          ['Replace', 'Keep Both', 'Cancel'],
          { placeHolder: `"${baseName}" already exists in destination` },
        );
        if (!choice || choice === 'Cancel') continue;
        if (choice === 'Keep Both') {
          const ext = path.extname(baseName);
          const nameNoExt = path.basename(baseName, ext);
          let counter = 1;
          do {
            const suffix = counter === 1 ? ' copy' : ` copy ${counter}`;
            targetUri = vscode.Uri.file(path.join(dir, `${nameNoExt}${suffix}${ext}`));
            counter++;
          } while (await exists(targetUri));
        } else {
          overwrite = true;
        }
      }
      await vscode.workspace.fs.rename(sourceUri, targetUri, { overwrite });
    }
```

- [ ] **Step 7: Compile and verify**

Run: `cd /Users/norules/Documents/code/vscode-agentic && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/services/FileExplorerProvider.ts src/features/explorerFileOps.ts src/extension.ts package.json
git commit -m "fix: explorer bug fixes — error placeholders, drop reporting, paste conflicts, refresh button"
```

---

## Task 4: Create GitService

**Files:**
- Create: `src/services/GitService.ts`

- [ ] **Step 1: Create GitService with status, commit, push, pull, diffStat methods**

```typescript
// src/services/GitService.ts

import { spawn } from 'child_process';
import * as path from 'path';
import {
  GIT_STATUS_TIMEOUT_MS,
  GIT_COMMIT_TIMEOUT_MS,
  GIT_PUSH_TIMEOUT_MS,
  GIT_PULL_TIMEOUT_MS,
} from '../constants/sourceControl';
import type { FileChange } from '../types/sourceControl';

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const run = (args: string[], cwd: string, timeoutMs: number): Promise<GitResult> =>
  new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });

export const gitStatus = async (cwd: string): Promise<FileChange[]> => {
  const { stdout } = await run(
    ['--no-optional-locks', 'status', '--porcelain', '-z'],
    cwd,
    GIT_STATUS_TIMEOUT_MS,
  );

  if (!stdout) return [];

  const changes: FileChange[] = [];
  const entries = stdout.split('\0').filter(Boolean);
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    const status = entry.substring(0, 2).trim();
    const filePath = entry.substring(3);

    // Renames have a second NUL-delimited field (the original name) — skip it
    if (status.startsWith('R')) {
      i += 2;
    } else {
      i += 1;
    }

    changes.push({
      status,
      path: filePath,
      absPath: path.join(cwd, filePath),
    });
  }

  return changes;
};

export const gitCommit = async (cwd: string, message: string): Promise<GitResult> => {
  await run(['add', '-A'], cwd, GIT_COMMIT_TIMEOUT_MS);
  return run(['commit', '-m', message], cwd, GIT_COMMIT_TIMEOUT_MS);
};

export const gitPush = async (cwd: string): Promise<GitResult> =>
  run(['push'], cwd, GIT_PUSH_TIMEOUT_MS);

export const gitPull = async (cwd: string): Promise<GitResult> =>
  run(['pull'], cwd, GIT_PULL_TIMEOUT_MS);

export const gitDiffStat = async (cwd: string): Promise<string> => {
  // Try staged first, fallback to unstaged
  const staged = await run(
    ['--no-optional-locks', 'diff', '--cached', '--stat'],
    cwd,
    GIT_STATUS_TIMEOUT_MS,
  );
  if (staged.stdout.trim()) return staged.stdout;

  const unstaged = await run(
    ['--no-optional-locks', 'diff', '--stat'],
    cwd,
    GIT_STATUS_TIMEOUT_MS,
  );
  return unstaged.stdout;
};

/**
 * Generate a short commit message from diff stats.
 * Parses filenames from `git diff --stat` output and produces
 * a phrase like "update FileExplorerProvider, add watcher".
 */
export const suggestCommitMessage = async (cwd: string): Promise<string> => {
  const changes = await gitStatus(cwd);
  if (changes.length === 0) return 'no changes';

  // Group by status
  const added = changes.filter((c) => c.status === '?' || c.status === 'A');
  const modified = changes.filter((c) => c.status === 'M' || c.status === 'MM');
  const deleted = changes.filter((c) => c.status === 'D');

  const parts: string[] = [];

  const formatNames = (items: FileChange[], limit: number): string => {
    const names = items.map((i) => path.basename(i.path, path.extname(i.path)));
    if (names.length <= limit) return names.join(', ');

    // Find common directory
    const dirs = new Set(items.map((i) => {
      const dir = path.dirname(i.path);
      return dir === '.' ? 'root' : dir.split(path.sep).pop()!;
    }));
    if (dirs.size === 1) return `${items.length} files in ${[...dirs][0]}`;
    return `${items.length} files`;
  };

  if (added.length > 0) parts.push(`add ${formatNames(added, 3)}`);
  if (modified.length > 0) parts.push(`update ${formatNames(modified, 3)}`);
  if (deleted.length > 0) parts.push(`remove ${formatNames(deleted, 3)}`);

  return parts.join(', ') || 'update files';
};
```

- [ ] **Step 2: Compile and verify**

Run: `cd /Users/norules/Documents/code/vscode-agentic && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/services/GitService.ts
git commit -m "feat: add GitService for status, commit, push, pull, suggest"
```

---

## Task 5: Create SourceControlProvider (extension side)

**Files:**
- Create: `src/services/SourceControlProvider.ts`

- [ ] **Step 1: Create the SourceControlProvider class**

```typescript
// src/services/SourceControlProvider.ts

import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import type { FileExplorerProvider } from './FileExplorerProvider';
import { VIEW_SOURCE_CONTROL } from '../constants/views';
import {
  SC_CMD_COMMIT,
  SC_CMD_PUSH,
  SC_CMD_PULL,
  SC_CMD_SUGGEST,
  SC_CMD_OPEN_DIFF,
  SC_CMD_READY,
  SC_MSG_UPDATE,
  SC_MSG_SUGGEST_RESULT,
} from '../constants/sourceControl';
import type {
  ScExtensionToWebviewMessage,
  ScWebviewToExtensionMessage,
  FileChange,
} from '../types/sourceControl';
import { gitStatus, gitCommit, gitPush, gitPull, suggestCommitMessage } from './GitService';

/**
 * Source control panel in the Agentic sidebar.
 *
 * Shows changed files, commit message input, and commit/push/pull buttons.
 * Scopes automatically to whichever repo/worktree the explorer is viewing.
 */
export class SourceControlProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = VIEW_SOURCE_CONTROL;

  private view: vscode.WebviewView | undefined;
  private roots: string[] = [];
  private repoName = '';
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    explorer: FileExplorerProvider,
  ) {
    // Subscribe to explorer scope changes
    this.disposables.push(
      explorer.onDidChangeScope((roots) => {
        this.roots = roots;
        void this.refreshStatus();
      }),
    );

    // Also refresh when file watcher fires (explorer tree data changes)
    this.disposables.push(
      explorer.onDidChangeTreeData(() => {
        this.debouncedRefresh();
      }),
    );

    this.roots = explorer.getRoots();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'ui')],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: ScWebviewToExtensionMessage) => this.handleMessage(message),
      null,
      this.disposables,
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.refreshStatus();
      }
    }, null, this.disposables);

    webviewView.onDidDispose(() => {
      this.view = undefined;
    }, null, this.disposables);
  }

  private handleMessage = async (message: ScWebviewToExtensionMessage): Promise<void> => {
    try {
      const cwd = this.roots[0];
      if (!cwd) return;

      switch (message.function) {
        case SC_CMD_READY:
          await this.refreshStatus();
          break;

        case SC_CMD_COMMIT: {
          const commitMessage = message.args.message as string;
          if (!commitMessage?.trim()) {
            vscode.window.showWarningMessage('Commit message cannot be empty.');
            return;
          }
          const result = await gitCommit(cwd, commitMessage);
          if (result.exitCode !== 0) {
            vscode.window.showErrorMessage(`Commit failed: ${result.stderr.trim()}`);
          } else {
            vscode.window.showInformationMessage('Committed successfully.');
          }
          await this.refreshStatus();
          break;
        }

        case SC_CMD_PUSH: {
          await this.sendLoading(true);
          const result = await gitPush(cwd);
          if (result.exitCode !== 0) {
            vscode.window.showErrorMessage(`Push failed: ${result.stderr.trim()}`);
          } else {
            vscode.window.showInformationMessage('Pushed successfully.');
          }
          await this.sendLoading(false);
          break;
        }

        case SC_CMD_PULL: {
          await this.sendLoading(true);
          const result = await gitPull(cwd);
          if (result.exitCode !== 0) {
            vscode.window.showErrorMessage(`Pull failed: ${result.stderr.trim()}`);
          } else {
            vscode.window.showInformationMessage('Pulled successfully.');
          }
          await this.refreshStatus();
          await this.sendLoading(false);
          break;
        }

        case SC_CMD_SUGGEST: {
          const suggested = await suggestCommitMessage(cwd);
          await this.postMessage({
            type: SC_MSG_SUGGEST_RESULT,
            message: suggested,
          });
          break;
        }

        case SC_CMD_OPEN_DIFF: {
          const filePath = message.args.absPath as string;
          const uri = vscode.Uri.file(filePath);
          await vscode.commands.executeCommand('git.openChange', uri);
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[SourceControlProvider] error:', msg);
      vscode.window.showErrorMessage(`Source Control: ${msg}`);
    }
  };

  private refreshStatus = async (): Promise<void> => {
    if (!this.view) return;
    const cwd = this.roots[0];
    if (!cwd) {
      await this.postMessage({
        type: SC_MSG_UPDATE,
        changes: [],
        repoName: '',
        isLoading: false,
      });
      return;
    }

    try {
      const changes = await gitStatus(cwd);
      const parts = cwd.split('/');
      this.repoName = parts[parts.length - 1];
      await this.postMessage({
        type: SC_MSG_UPDATE,
        changes,
        repoName: this.repoName,
        isLoading: false,
      });
    } catch (err) {
      console.error('[SourceControlProvider] status failed:', err);
    }
  };

  private debouncedRefresh(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      void this.refreshStatus();
    }, 500);
  }

  private sendLoading = async (isLoading: boolean): Promise<void> => {
    if (!this.view) return;
    // Send update with current state but changed loading flag
    const cwd = this.roots[0];
    const changes = cwd ? await gitStatus(cwd) : [];
    await this.postMessage({
      type: SC_MSG_UPDATE,
      changes,
      repoName: this.repoName,
      isLoading,
    });
  };

  private postMessage = async (message: ScExtensionToWebviewMessage): Promise<void> => {
    await this.view?.webview.postMessage(message);
  };

  private getHtml = (webview: vscode.Webview): string => {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'ui', 'sourceControl.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'ui', 'sourceControl.css'),
    );
    const nonce = randomBytes(16).toString('hex');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource}; font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  };

  dispose(): void {
    clearTimeout(this.refreshTimer);
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
```

- [ ] **Step 2: Compile and verify**

Run: `cd /Users/norules/Documents/code/vscode-agentic && npx tsc --noEmit`
Expected: may fail on missing webview files and missing `onDidChangeTreeData` as public — we'll fix in next steps.

- [ ] **Step 3: Expose onDidChangeTreeData for SourceControlProvider subscription**

The `SourceControlProvider` subscribes to `explorer.onDidChangeTreeData` for refreshing on file changes. This is already public on `FileExplorerProvider` (line 42). No change needed.

- [ ] **Step 4: Commit**

```bash
git add src/services/SourceControlProvider.ts
git commit -m "feat: add SourceControlProvider with commit/push/pull/suggest"
```

---

## Task 6: Create Source Control webview UI

**Files:**
- Create: `src/ui/sourceControl/index.tsx`
- Create: `src/ui/sourceControl/SourceControlPage.tsx`
- Create: `src/ui/sourceControl/SourceControlView.tsx`
- Create: `src/ui/sourceControl/useSourceControl.ts`
- Create: `src/ui/sourceControl/styles/sourceControl.css`

- [ ] **Step 1: Create the webview entry point**

```tsx
// src/ui/sourceControl/index.tsx

import { createRoot } from 'react-dom/client';
import { SourceControlPage } from './SourceControlPage';
import './styles/sourceControl.css';
import '@vscode/codicons/dist/codicon.css';
import type { ScWebviewToExtensionMessage } from '../../types/sourceControl';

interface VsCodeApi {
  postMessage: (msg: ScWebviewToExtensionMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare const acquireVsCodeApi: () => VsCodeApi;

export const vscode = acquireVsCodeApi();

const root = createRoot(document.getElementById('root')!);
root.render(<SourceControlPage />);
```

- [ ] **Step 2: Create the useSourceControl hook**

```tsx
// src/ui/sourceControl/useSourceControl.ts

import { useState, useEffect, useCallback } from 'react';
import { vscode } from './index';
import type { FileChange, ScExtensionToWebviewMessage } from '../../types/sourceControl';
import {
  SC_CMD_COMMIT,
  SC_CMD_PUSH,
  SC_CMD_PULL,
  SC_CMD_SUGGEST,
  SC_CMD_OPEN_DIFF,
  SC_CMD_READY,
  SC_MSG_UPDATE,
  SC_MSG_SUGGEST_RESULT,
} from '../../constants/sourceControl';

interface SourceControlState {
  changes: FileChange[];
  repoName: string;
  isLoading: boolean;
  commitMessage: string;
}

export const useSourceControl = () => {
  const [state, setState] = useState<SourceControlState>({
    changes: [],
    repoName: '',
    isLoading: false,
    commitMessage: '',
  });

  useEffect(() => {
    const handler = (event: MessageEvent<ScExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type === SC_MSG_UPDATE) {
        setState((prev) => ({
          ...prev,
          changes: message.changes,
          repoName: message.repoName,
          isLoading: message.isLoading,
        }));
      } else if (message.type === SC_MSG_SUGGEST_RESULT) {
        setState((prev) => ({
          ...prev,
          commitMessage: message.message,
        }));
      }
    };

    window.addEventListener('message', handler);
    vscode.postMessage({ function: SC_CMD_READY, args: {} });

    return () => window.removeEventListener('message', handler);
  }, []);

  const setCommitMessage = useCallback((msg: string) => {
    setState((prev) => ({ ...prev, commitMessage: msg }));
  }, []);

  const commit = useCallback(() => {
    if (!state.commitMessage.trim()) return;
    vscode.postMessage({ function: SC_CMD_COMMIT, args: { message: state.commitMessage } });
    setState((prev) => ({ ...prev, commitMessage: '' }));
  }, [state.commitMessage]);

  const push = useCallback(() => {
    vscode.postMessage({ function: SC_CMD_PUSH, args: {} });
  }, []);

  const pull = useCallback(() => {
    vscode.postMessage({ function: SC_CMD_PULL, args: {} });
  }, []);

  const suggest = useCallback(() => {
    vscode.postMessage({ function: SC_CMD_SUGGEST, args: {} });
  }, []);

  const openDiff = useCallback((absPath: string) => {
    vscode.postMessage({ function: SC_CMD_OPEN_DIFF, args: { absPath } });
  }, []);

  return {
    ...state,
    setCommitMessage,
    commit,
    push,
    pull,
    suggest,
    openDiff,
  };
};
```

- [ ] **Step 3: Create the SourceControlView (presentational)**

```tsx
// src/ui/sourceControl/SourceControlView.tsx

import type { FileChange } from '../../types/sourceControl';

interface Props {
  changes: FileChange[];
  repoName: string;
  isLoading: boolean;
  commitMessage: string;
  onCommitMessageChange: (msg: string) => void;
  onCommit: () => void;
  onPush: () => void;
  onPull: () => void;
  onSuggest: () => void;
  onOpenDiff: (absPath: string) => void;
}

const statusLabel = (status: string): string => {
  switch (status) {
    case 'M': case 'MM': return 'M';
    case 'A': return 'A';
    case 'D': return 'D';
    case 'R': return 'R';
    case '?': case '??': return 'U';
    default: return status;
  }
};

const statusClass = (status: string): string => {
  switch (status) {
    case 'M': case 'MM': return 'sc-status-modified';
    case 'A': return 'sc-status-added';
    case 'D': return 'sc-status-deleted';
    case '?': case '??': return 'sc-status-untracked';
    default: return '';
  }
};

export const SourceControlView = ({
  changes,
  repoName,
  isLoading,
  commitMessage,
  onCommitMessageChange,
  onCommit,
  onPush,
  onPull,
  onSuggest,
  onOpenDiff,
}: Props) => (
  <div className="sc-container">
    <div className="sc-input-row">
      <input
        className="sc-commit-input"
        type="text"
        placeholder="Commit message..."
        value={commitMessage}
        onChange={(e) => onCommitMessageChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCommit();
          }
        }}
        disabled={isLoading}
      />
    </div>
    <div className="sc-button-row">
      <button
        className="sc-btn sc-btn-suggest"
        onClick={onSuggest}
        disabled={isLoading || changes.length === 0}
        title="Suggest commit message"
      >
        <i className="codicon codicon-sparkle" />
      </button>
      <button
        className="sc-btn sc-btn-primary"
        onClick={onCommit}
        disabled={isLoading || !commitMessage.trim()}
        title="Commit all changes"
      >
        <i className="codicon codicon-check" /> Commit
      </button>
      <button
        className="sc-btn"
        onClick={onPush}
        disabled={isLoading}
        title="Push to remote"
      >
        <i className="codicon codicon-cloud-upload" />
      </button>
      <button
        className="sc-btn"
        onClick={onPull}
        disabled={isLoading}
        title="Pull from remote"
      >
        <i className="codicon codicon-cloud-download" />
      </button>
    </div>

    {changes.length > 0 && (
      <div className="sc-changes">
        <div className="sc-changes-header">
          Changes ({changes.length})
        </div>
        <ul className="sc-file-list">
          {changes.map((change) => (
            <li key={change.path} className="sc-file-item">
              <button
                className="sc-file-button"
                onClick={() => onOpenDiff(change.absPath)}
                title={`Open diff: ${change.path}`}
              >
                <span className={`sc-file-status ${statusClass(change.status)}`}>
                  {statusLabel(change.status)}
                </span>
                <span className="sc-file-path">{change.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}

    {!repoName && (
      <div className="sc-empty">Select a repo or agent to see changes</div>
    )}
  </div>
);
```

- [ ] **Step 4: Create the SourceControlPage (page component)**

```tsx
// src/ui/sourceControl/SourceControlPage.tsx

import { useSourceControl } from './useSourceControl';
import { SourceControlView } from './SourceControlView';

export const SourceControlPage = () => {
  const {
    changes,
    repoName,
    isLoading,
    commitMessage,
    setCommitMessage,
    commit,
    push,
    pull,
    suggest,
    openDiff,
  } = useSourceControl();

  return (
    <SourceControlView
      changes={changes}
      repoName={repoName}
      isLoading={isLoading}
      commitMessage={commitMessage}
      onCommitMessageChange={setCommitMessage}
      onCommit={commit}
      onPush={push}
      onPull={pull}
      onSuggest={suggest}
      onOpenDiff={openDiff}
    />
  );
};
```

- [ ] **Step 5: Create the styles**

```css
/* src/ui/sourceControl/styles/sourceControl.css */

@import '@vscode/codicons/dist/codicon.css';

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.sc-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
}

/* ── Commit input ─────────────────────────────────────────────── */

.sc-input-row {
  display: flex;
}

.sc-commit-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 2px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  outline: none;
}

.sc-commit-input:focus {
  border-color: var(--vscode-focusBorder);
}

.sc-commit-input::placeholder {
  color: var(--vscode-input-placeholderForeground);
}

/* ── Button row ───────────────────────────────────────────────── */

.sc-button-row {
  display: flex;
  gap: 4px;
}

.sc-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: none;
  border-radius: 2px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  cursor: pointer;
  white-space: nowrap;
}

.sc-btn:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground);
}

.sc-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.sc-btn-primary {
  flex: 1;
  justify-content: center;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.sc-btn-primary:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.sc-btn-suggest {
  padding: 3px 6px;
}

/* ── Changes list ─────────────────────────────────────────────── */

.sc-changes {
  display: flex;
  flex-direction: column;
}

.sc-changes-header {
  padding: 4px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--vscode-descriptionForeground);
}

.sc-file-list {
  list-style: none;
}

.sc-file-item {
  display: flex;
}

.sc-file-button {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 2px 4px;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  text-align: left;
  cursor: pointer;
}

.sc-file-button:hover {
  background: var(--vscode-list-hoverBackground);
}

.sc-file-status {
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  font-weight: 600;
  font-size: 11px;
}

.sc-status-modified { color: var(--vscode-gitDecoration-modifiedResourceForeground, var(--vscode-charts-orange)); }
.sc-status-added { color: var(--vscode-gitDecoration-untrackedResourceForeground, var(--vscode-charts-green)); }
.sc-status-deleted { color: var(--vscode-gitDecoration-deletedResourceForeground, var(--vscode-charts-red)); }
.sc-status-untracked { color: var(--vscode-gitDecoration-untrackedResourceForeground, var(--vscode-charts-green)); }

.sc-file-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Empty state ──────────────────────────────────────────────── */

.sc-empty {
  padding: 12px 0;
  text-align: center;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/sourceControl/
git commit -m "feat: add Source Control webview UI components and styles"
```

---

## Task 7: Wire everything in package.json, extension.ts, and build scripts

**Files:**
- Modify: `package.json`
- Modify: `src/extension.ts`
- Modify: `src/constants/views.ts`

- [ ] **Step 1: Add Source Control view to package.json**

Add the third view to `views.vscode-agentic` array (after the explorer view at line 76):

```json
        {
          "type": "webview",
          "id": "vscode-agentic.sourceControl",
          "name": "Source Control"
        }
```

- [ ] **Step 2: Add esbuild entry for Source Control webview**

Update the compile scripts in `package.json`. The `compile:prod` script (line 272) becomes:

```
"compile:prod": "esbuild src/extension.ts --bundle --outfile=out/extension.js --external:vscode --format=cjs --platform=node --minify && esbuild src/ui/index.tsx --bundle --outfile=out/ui/index.js --format=esm --jsx=automatic --loader:.ttf=file --minify && esbuild src/ui/sourceControl/index.tsx --bundle --outfile=out/ui/sourceControl.js --format=esm --jsx=automatic --loader:.ttf=file --minify"
```

The `compile` script (line 273) becomes:

```
"compile": "esbuild src/extension.ts --bundle --outfile=out/extension.js --external:vscode --format=cjs --platform=node --sourcemap && esbuild src/ui/index.tsx --bundle --outfile=out/ui/index.js --format=esm --jsx=automatic --loader:.ttf=file --sourcemap && esbuild src/ui/sourceControl/index.tsx --bundle --outfile=out/ui/sourceControl.js --format=esm --jsx=automatic --loader:.ttf=file --sourcemap"
```

- [ ] **Step 3: Register SourceControlProvider in extension.ts**

Update `src/extension.ts`:

```typescript
import * as vscode from 'vscode';
import { createStateStorage } from './db';
import { registerExplorerCommands } from './features/registerExplorerCommands';
import { syncWorkspaceRepos } from './features/syncWorkspaceRepos';
import { syncWorktrees } from './features/syncWorktrees';
import { AgentPanelProvider } from './services/AgentPanelProvider';
import { FileExplorerProvider } from './services/FileExplorerProvider';
import { SourceControlProvider } from './services/SourceControlProvider';
import { TerminalService } from './services/TerminalService';
import { WebviewCommandHandler } from './services/WebviewCommandHandler';
import { VIEW_EXPLORER, VIEW_SOURCE_CONTROL } from './constants/views';

export const activate = (context: vscode.ExtensionContext) => {
  const storage = createStateStorage(context);
  context.subscriptions.push(storage);

  const provider = new AgentPanelProvider(context.extensionUri, storage);
  context.subscriptions.push(provider);

  const explorer = new FileExplorerProvider(storage);
  context.subscriptions.push(explorer);

  const treeView = vscode.window.createTreeView(VIEW_EXPLORER, {
    treeDataProvider: explorer,
    canSelectMany: true,
    dragAndDropController: explorer,
  });
  explorer.attachTreeView(treeView);
  context.subscriptions.push(treeView);

  const sourceControl = new SourceControlProvider(context.extensionUri, explorer);
  context.subscriptions.push(sourceControl);

  const terminalService = new TerminalService(storage);
  context.subscriptions.push(terminalService);

  const commandHandler = new WebviewCommandHandler(provider, storage, explorer, terminalService);
  context.subscriptions.push(commandHandler);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, provider),
    vscode.window.registerWebviewViewProvider(SourceControlProvider.viewType, sourceControl),
    registerExplorerCommands(explorer, treeView, storage, terminalService),
    vscode.commands.registerCommand('vscode-agentic.explorer.refresh', () => explorer.refresh()),
  );

  // Deferred: sync workspace git folders, worktrees, and restore agent terminals.
  setTimeout(() => {
    syncWorkspaceRepos(storage)
      .then(() => syncWorktrees(storage))
      .catch((err) => console.error('[Agentic] workspace/worktree sync failed:', err));
    terminalService.restoreAll().catch((err) => console.error('[Agentic] terminal restore failed:', err));
  }, 0);
};

export const deactivate = () => {};
```

- [ ] **Step 4: Add VIEW_SOURCE_CONTROL to views constants**

This was done in Task 1 Step 4. Verify `src/constants/views.ts` includes:

```typescript
export const VIEW_SOURCE_CONTROL = 'vscode-agentic.sourceControl';
```

- [ ] **Step 5: Compile and verify**

Run: `cd /Users/norules/Documents/code/vscode-agentic && npm run compile`
Expected: builds three bundles without errors — `out/extension.js`, `out/ui/index.js`, `out/ui/sourceControl.js`

- [ ] **Step 6: Commit**

```bash
git add package.json src/extension.ts src/constants/views.ts
git commit -m "feat: wire source control view into sidebar, build, and extension activation"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Build the extension**

```bash
cd /Users/norules/Documents/code/vscode-agentic && npm run compile
```

Verify three output files exist:
- `out/extension.js`
- `out/ui/index.js`
- `out/ui/sourceControl.js`

- [ ] **Step 2: Test in VS Code**

Press F5 in VS Code to launch the Extension Development Host. Verify:

1. **Agentic sidebar** shows three sections: Agents, Agentic Explorer, Source Control
2. **Explorer file watching**: Click on a repo/agent, then create a file in that directory from terminal. Verify it appears in the explorer within ~300ms without manual refresh.
3. **Refresh button**: The explorer title bar shows a refresh icon. Click it — tree reloads.
4. **Source Control - scoping**: Click different agents/repos. Source control changes list should update to match.
5. **Source Control - changes**: Modified files in the repo appear with status letters (M, U, D).
6. **Source Control - diff**: Click a changed file. The diff editor opens (same as Changes tab).
7. **Source Control - suggest**: Click the sparkle button. A commit message appears in the input.
8. **Source Control - commit**: Type a message, click Commit. Verify changes are committed (check terminal with `git log`).
9. **Source Control - push/pull**: Click Push. Verify it pushes to remote (or shows error if no upstream).
10. **Bug fix - error placeholder**: Temporarily chmod 000 a directory, expand it in explorer. Should show "(Unable to read directory)" with warning icon.
11. **Bug fix - paste conflict**: Copy a file, paste into a directory that already has a file with the same name. Should show Replace/Keep Both/Cancel picker.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
