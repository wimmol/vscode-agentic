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

  constructor(
    private readonly extensionUri: vscode.Uri,
    explorer: FileExplorerProvider,
  ) {
    this.disposables.push(
      explorer.onDidChangeScope((roots) => {
        this.roots = roots;
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
            await this.refreshStatus();
          }
          await this.sendLoading(false);
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
      this.lastChanges = await gitStatus(cwd);
      await this.postMessage({
        type: SC_MSG_UPDATE,
        changes: this.lastChanges,
        repoName: path.basename(cwd),
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

  private getHtml = (webview: vscode.Webview): string =>
    buildWebviewHtml(webview, this.extensionUri, 'sourceControl.js', 'sourceControl.css');

  dispose(): void {
    clearTimeout(this.refreshTimer);
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
