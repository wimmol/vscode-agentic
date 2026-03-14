import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { StateStorage } from '../db';
import {
  WORKSPACE_SCOPE_KEY,
  PERSIST_DEBOUNCE_MS,
  CONTEXT_FILE,
  CONTEXT_FOLDER,
  URI_LIST_MIME,
} from '../constants/explorer';
import { GIT_DIR } from '../constants/paths';
import { LABEL_WORKSPACE, LABEL_OPEN_FILE, LABEL_AGENT_PREFIX } from '../constants/messages';

type ExplorerItem = ScopeHeaderItem | FileItem;

const CONTEXT_SCOPE_HEADER = 'scopeHeader';

/**
 * Provides a file-tree view of repository directories in the sidebar.
 *
 * Replaces `updateWorkspaceFolders` so that switching Explorer scope
 * never restarts the window, extensions, or terminals.
 * Persists expanded folder state per scope in SQLite (explorer_state table).
 *
 * Also implements TreeDragAndDropController to support:
 * - Dragging files/folders to move them within the tree
 * - Dragging files to the VS Code editor to open them
 */
export class FileExplorerProvider
  implements vscode.TreeDataProvider<ExplorerItem>, vscode.TreeDragAndDropController<ExplorerItem>, vscode.Disposable
{
  private roots: string[] = [];
  private mode: 'all' | 'scoped' = 'all';
  private scopeKey = WORKSPACE_SCOPE_KEY;
  private expandedPaths = new Set<string>();
  private generation = 0;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private headerItem: ScopeHeaderItem = ScopeHeaderItem.workspace();

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ExplorerItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // ── Drag & drop ──────────────────────────────────────────────────
  readonly dragMimeTypes = [URI_LIST_MIME];
  readonly dropMimeTypes = [URI_LIST_MIME];
  private draggedItems: FileItem[] = [];

  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly storage: StateStorage) {
    this.disposables.push(
      storage.onDidChange(() => {
        if (this.mode === 'all') {
          void this.loadAndRefresh();
        }
      }),
    );
    void this.loadAndRefresh();
  }

  // ── Public API ───────────────────────────────────────────────────

  attachTreeView(treeView: vscode.TreeView<ExplorerItem>): void {
    this.disposables.push(
      treeView.onDidExpandElement((e) => {
        if (e.element instanceof FileItem) {
          this.expandedPaths.add(e.element.filePath);
          this.debouncePersist();
        }
      }),
      treeView.onDidCollapseElement((e) => {
        if (e.element instanceof FileItem) {
          this.expandedPaths.delete(e.element.filePath);
          this.debouncePersist();
        }
      }),
    );
  }

  /** Force-refresh the entire tree. */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Current root paths displayed in the tree. */
  getRoots(): string[] {
    return this.roots;
  }

  showAllRepos(repoPaths?: string[]): void {
    if (this.mode === 'all' && !repoPaths) {
      return;
    }
    this.mode = 'all';
    this.scopeKey = WORKSPACE_SCOPE_KEY;
    this.headerItem = ScopeHeaderItem.workspace();
    if (repoPaths) {
      this.roots = repoPaths;
      void this.loadExpandedAndRefresh();
    } else {
      void this.loadAndRefresh();
    }
  }

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
    void this.loadExpandedAndRefresh();
  }

  // ── TreeDataProvider ─────────────────────────────────────────────

  getTreeItem(element: ExplorerItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
    if (!element) {
      const items: ExplorerItem[] = [this.headerItem];
      if (this.mode === 'scoped' && this.roots.length === 1) {
        items.push(...(await this.readDirectory(this.roots[0])));
      } else {
        items.push(...this.roots.map((r) => this.createItem(r, true)));
      }
      return items;
    }

    if (element instanceof ScopeHeaderItem || !element.isDir) {
      return [];
    }

    return this.readDirectory(element.filePath);
  }

  // ── TreeDragAndDropController ────────────────────────────────────

  handleDrag(source: readonly ExplorerItem[], dataTransfer: vscode.DataTransfer): void {
    const fileItems = source.filter((s): s is FileItem => s instanceof FileItem);
    if (fileItems.length === 0) return;

    this.draggedItems = fileItems;

    // text/uri-list enables drop-to-editor (VS Code opens the file)
    const uriList = fileItems.map((f) => f.resourceUri!.toString()).join('\r\n');
    dataTransfer.set(URI_LIST_MIME, new vscode.DataTransferItem(uriList));
  }

  async handleDrop(target: ExplorerItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    // Always consume draggedItems to avoid stale refs after cancelled drags
    const internalItems = this.draggedItems;
    this.draggedItems = [];

    const targetDir = this.resolveDropTarget(target);
    if (!targetDir) return;

    // Internal drag (from our tree)
    if (internalItems.length > 0) {
      await this.moveItems(internalItems, targetDir);
      return;
    }

    // External URI drop
    const uriItem = dataTransfer.get(URI_LIST_MIME);
    if (uriItem) {
      const raw = await uriItem.asString();
      const uris = raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((u) => vscode.Uri.parse(u));
      for (const uri of uris) {
        const dest = vscode.Uri.file(path.join(targetDir, path.basename(uri.fsPath)));
        if (uri.fsPath === dest.fsPath) continue;
        try {
          await vscode.workspace.fs.rename(uri, dest, { overwrite: false });
        } catch (err) {
          console.error('[FileExplorerProvider] drop move failed:', err);
          vscode.window.showErrorMessage(`Failed to move "${path.basename(uri.fsPath)}": ${err}`);
        }
      }
      this.refresh();
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  private resolveDropTarget(target: ExplorerItem | undefined): string | undefined {
    if (!target || target instanceof ScopeHeaderItem) {
      return this.roots[0];
    }
    return target.isDir ? target.filePath : path.dirname(target.filePath);
  }

  private async moveItems(items: FileItem[], targetDir: string): Promise<void> {
    for (const item of items) {
      const dest = path.join(targetDir, path.basename(item.filePath));
      if (item.filePath === dest) continue;
      if (dest.startsWith(item.filePath + path.sep)) continue;
      try {
        await vscode.workspace.fs.rename(
          vscode.Uri.file(item.filePath),
          vscode.Uri.file(dest),
          { overwrite: false },
        );
      } catch (err) {
        console.error('[FileExplorerProvider] move failed:', err);
        vscode.window.showErrorMessage(`Failed to move "${path.basename(item.filePath)}": ${err}`);
      }
    }
    this.refresh();
  }

  private async loadAndRefresh(): Promise<void> {
    const gen = ++this.generation;
    const repos = await this.storage.getAllRepositories();
    if (gen !== this.generation) return;
    this.roots = repos.map((r) => r.localPath);
    await this.loadExpandedAndRefresh(gen);
  }

  private async loadExpandedAndRefresh(gen?: number): Promise<void> {
    gen ??= ++this.generation;
    const paths = await this.storage.getExpandedPaths(this.scopeKey);
    if (gen !== this.generation) return;
    this.expandedPaths = new Set(paths);
    this._onDidChangeTreeData.fire(undefined);
  }

  private debouncePersist(): void {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void this.storage.setExpandedPaths(this.scopeKey, [...this.expandedPaths]);
    }, PERSIST_DEBOUNCE_MS);
  }

  private async readDirectory(dirPath: string): Promise<FileItem[]> {
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
      return [];
    }
  }

  private createItem(filePath: string, isDir: boolean): FileItem {
    const expanded = isDir && this.expandedPaths.has(filePath);
    return new FileItem(filePath, isDir, expanded);
  }

  dispose(): void {
    clearTimeout(this.persistTimer);
    this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

class ScopeHeaderItem extends vscode.TreeItem {
  static workspace(): ScopeHeaderItem {
    return new ScopeHeaderItem(LABEL_WORKSPACE, 'home');
  }

  static repo(repoName: string): ScopeHeaderItem {
    return new ScopeHeaderItem(repoName, 'repo');
  }

  static branch(repoName: string, branchName: string, isWorktree: boolean): ScopeHeaderItem {
    const icon = isWorktree ? 'repo-forked' : 'git-branch';
    return new ScopeHeaderItem(repoName, icon, `${LABEL_AGENT_PREFIX}${branchName}`);
  }

  private constructor(label: string, icon: 'home' | 'repo' | 'git-branch' | 'repo-forked', desc?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = CONTEXT_SCOPE_HEADER;
    if (desc) {
      this.description = desc;
    }
  }
}

export class FileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly isDir: boolean,
    expanded: boolean,
  ) {
    super(
      path.basename(filePath),
      isDir
        ? expanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.resourceUri = vscode.Uri.file(filePath);
    this.contextValue = isDir ? CONTEXT_FOLDER : CONTEXT_FILE;

    if (!isDir) {
      this.command = {
        command: 'vscode.open',
        title: LABEL_OPEN_FILE,
        arguments: [this.resourceUri],
      };
    }
  }
}
