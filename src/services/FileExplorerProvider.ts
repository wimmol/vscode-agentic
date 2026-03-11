import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { StateStorage } from '../db';

const WORKSPACE_SCOPE_KEY = 'workspace';
const PERSIST_DEBOUNCE_MS = 500;

/**
 * Provides a file-tree view of repository directories in the sidebar.
 *
 * Replaces `updateWorkspaceFolders` so that switching Explorer scope
 * never restarts the window, extensions, or terminals.
 * Persists expanded folder state per scope in SQLite (explorer_state table).
 */
export class FileExplorerProvider implements vscode.TreeDataProvider<FileItem>, vscode.Disposable {
  private roots: string[] = [];
  private mode: 'all' | 'scoped' = 'all';
  private scopeKey = WORKSPACE_SCOPE_KEY;
  private expandedPaths = new Set<string>();
  private generation = 0;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<FileItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

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

  attachTreeView(treeView: vscode.TreeView<FileItem>): void {
    this.disposables.push(
      treeView.onDidExpandElement((e) => {
        this.expandedPaths.add(e.element.filePath);
        this.debouncePersist();
      }),
      treeView.onDidCollapseElement((e) => {
        this.expandedPaths.delete(e.element.filePath);
        this.debouncePersist();
      }),
    );
  }

  showAllRepos(repoPaths?: string[]): void {
    this.mode = 'all';
    this.scopeKey = WORKSPACE_SCOPE_KEY;
    if (repoPaths) {
      this.roots = repoPaths;
      void this.loadExpandedAndRefresh();
    } else {
      void this.loadAndRefresh();
    }
  }

  showRepo(repoId: string, repoPath: string): void {
    this.mode = 'scoped';
    this.scopeKey = repoId;
    this.roots = [repoPath];
    void this.loadExpandedAndRefresh();
  }

  getTreeItem(element: FileItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FileItem): Promise<FileItem[]> {
    if (!element) {
      if (this.mode === 'scoped' && this.roots.length === 1) {
        return this.readDirectory(this.roots[0]);
      }
      return this.roots.map((r) => this.createItem(r, true));
    }

    if (!element.isDir) {
      return [];
    }

    return this.readDirectory(element.filePath);
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
        .filter((e) => e.name !== '.git')
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

class FileItem extends vscode.TreeItem {
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

    if (!isDir) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [this.resourceUri],
      };
    }
  }
}
