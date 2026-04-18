import * as path from 'path';
import * as vscode from 'vscode';
import type { FileExplorerProvider } from './FileExplorerProvider';
import { VIEW_SOURCE_CONTROL } from '../constants/views';
import { buildWebviewHtml } from '../utils/webview';
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
import { logger } from './Logger';

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
  private lastChanges: FileChange[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  /** Listeners scoped to the current webview instance; replaced on every resolve. */
  private viewDisposables: vscode.Disposable[] = [];
  private watchers: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    explorer: FileExplorerProvider,
  ) {
    this.disposables.push(
      explorer.onDidChangeScope((roots) => {
        this.roots = roots;
        this.setupWatchers();
        this.debouncedRefresh();
      }),
    );

    this.roots = explorer.getRoots();
    this.setupWatchers();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    for (const d of this.viewDisposables) d.dispose();
    this.viewDisposables = [];

    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'ui')],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: ScWebviewToExtensionMessage) => this.handleMessage(message),
      null,
      this.viewDisposables,
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.refreshStatus();
      }
    }, null, this.viewDisposables);

    webviewView.onDidDispose(() => {
      this.view = undefined;
      for (const d of this.viewDisposables) d.dispose();
      this.viewDisposables = [];
    }, null, this.viewDisposables);
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
          const result = await gitCommit(cwd, commitMessage, this.lastChanges.map((c) => c.path));
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
          try {
            await this.runPushWithRetry(cwd);
          } finally {
            await this.sendLoading(false);
          }
          break;
        }

        case SC_CMD_PULL: {
          await this.sendLoading(true);
          try {
            const result = await vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: 'Agentic: pulling…', cancellable: true },
              (_progress, token) => gitPull(cwd, token),
            );
            if (result.exitCode !== 0) {
              vscode.window.showErrorMessage(`Pull failed: ${result.stderr.trim()}`);
            } else {
              vscode.window.showInformationMessage('Pulled successfully.');
              await this.refreshStatus();
            }
          } finally {
            await this.sendLoading(false);
          }
          break;
        }

        case SC_CMD_SUGGEST: {
          const suggested = suggestCommitMessage(this.lastChanges);
          await this.postMessage({
            type: SC_MSG_SUGGEST_RESULT,
            message: suggested,
          });
          break;
        }

        case SC_CMD_OPEN_DIFF: {
          const relPath = message.args.path;
          if (typeof relPath !== 'string' || !relPath) return;
          const uri = vscode.Uri.file(path.join(cwd, relPath));
          await vscode.commands.executeCommand('git.openChange', uri);
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('SourceControlProvider handleMessage', err);
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
      this.lastChanges = await gitStatus(cwd);
      await this.postMessage({
        type: SC_MSG_UPDATE,
        changes: this.lastChanges,
        repoName: path.basename(cwd),
        isLoading: false,
      });
    } catch (err) {
      logger.error('SourceControlProvider status failed', err);
      this.lastChanges = [];
      await this.postMessage({
        type: SC_MSG_UPDATE,
        changes: [],
        repoName: path.basename(cwd),
        isLoading: false,
      });
    }
  };

  /**
   * Push the working branch. On failure (typically non-fast-forward), prompt
   * the user to pull-and-retry instead of dropping raw stderr at them.
   */
  private runPushWithRetry = async (cwd: string): Promise<void> => {
    const pushResult = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Agentic: pushing…', cancellable: true },
      (_progress, token) => gitPush(cwd, token),
    );

    if (pushResult.exitCode === 0) {
      vscode.window.showInformationMessage('Pushed successfully.');
      return;
    }

    const stderr = pushResult.stderr.trim();
    const looksLikeNonFastForward = /non-fast-forward|rejected|fetch first|behind/i.test(stderr);

    if (!looksLikeNonFastForward) {
      vscode.window.showErrorMessage(`Push failed: ${stderr}`);
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      'Push rejected by remote (likely non-fast-forward). Pull and retry?',
      { modal: false },
      'Pull & Retry',
      'Cancel',
    );
    if (choice !== 'Pull & Retry') return;

    const pullResult = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Agentic: pulling before retry…', cancellable: true },
      (_progress, token) => gitPull(cwd, token),
    );
    if (pullResult.exitCode !== 0) {
      vscode.window.showErrorMessage(`Pull failed: ${pullResult.stderr.trim()}`);
      return;
    }

    const retryResult = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Agentic: pushing (retry)…', cancellable: true },
      (_progress, token) => gitPush(cwd, token),
    );
    if (retryResult.exitCode !== 0) {
      vscode.window.showErrorMessage(`Push failed after pull: ${retryResult.stderr.trim()}`);
    } else {
      vscode.window.showInformationMessage('Pushed successfully (after pull).');
      await this.refreshStatus();
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
    const cwd = this.roots[0];
    await this.postMessage({
      type: SC_MSG_UPDATE,
      changes: this.lastChanges,
      repoName: cwd ? path.basename(cwd) : '',
      isLoading,
    });
  };

  private postMessage = async (message: ScExtensionToWebviewMessage): Promise<void> => {
    await this.view?.webview.postMessage(message);
  };

  private isNoisyPath(uri: vscode.Uri): boolean {
    const fsPath = uri.fsPath;
    return (
      fsPath.includes(`${path.sep}.git${path.sep}`)
      || fsPath.includes(`${path.sep}node_modules${path.sep}`)
    );
  }

  private setupWatchers(): void {
    this.disposeWatchers();
    for (const root of this.roots) {
      const pattern = new vscode.RelativePattern(vscode.Uri.file(root), '**/*');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const onChange = (uri: vscode.Uri) => {
        if (this.isNoisyPath(uri)) return;
        this.debouncedRefresh();
      };
      this.watchers.push(
        watcher,
        watcher.onDidCreate(onChange),
        watcher.onDidChange(onChange),
        watcher.onDidDelete(onChange),
      );
    }
  }

  private disposeWatchers(): void {
    for (const w of this.watchers) w.dispose();
    this.watchers = [];
  }

  private getHtml = (webview: vscode.Webview): string =>
    buildWebviewHtml(webview, this.extensionUri, 'sourceControl.js', 'sourceControl.css');

  dispose(): void {
    clearTimeout(this.refreshTimer);
    this.disposeWatchers();
    for (const d of this.viewDisposables) d.dispose();
    this.viewDisposables = [];
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
