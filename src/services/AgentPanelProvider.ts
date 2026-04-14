import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { ExtensionToWebviewMessage } from '../types/messages';
import { VIEW_AGENTS } from '../constants/views';
import { CMD_READY, MSG_TYPE_UPDATE } from '../constants/commands';
import { syncWorktrees } from '../features/syncWorktrees';
import { buildWebviewHtml } from '../utils/webview';

/**
 * Bridges StateStorage and the Agent Panel webview.
 *
 * Registers as a WebviewViewProvider for the sidebar panel.
 * On every StateStorage change (and on initial resolve), reads the full
 * state, assembles RepoWithZones[], and pushes it to the webview.
 * This is the only place where extension→webview communication happens.
 */
export class AgentPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = VIEW_AGENTS;

  private readonly _onDidResolveView = new vscode.EventEmitter<vscode.WebviewView>();
  readonly onDidResolveView: vscode.Event<vscode.WebviewView> = this._onDidResolveView.event;

  private static readonly SYNC_COOLDOWN_MS = 5_000;

  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private pushStateTimer: ReturnType<typeof setTimeout> | undefined;
  private lastSyncTime = 0;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storage: StateStorage,
  ) {
    this.disposables.push(
      this.storage.onDidChange(() => this.debouncedPushState()),
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'ui')],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.syncAndPush();
      }
    }, null, this.disposables);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.function === CMD_READY) {
        console.log('[AgentPanelProvider] webview ready, pushing initial state');
        void this.pushState();
      }
    }, null, this.disposables);

    webviewView.onDidDispose(() => {
      this.view = undefined;
    }, null, this.disposables);

    this._onDidResolveView.fire(webviewView);
  }

  private syncAndPush = async (): Promise<void> => {
    const now = Date.now();
    if (now - this.lastSyncTime >= AgentPanelProvider.SYNC_COOLDOWN_MS) {
      this.lastSyncTime = now;
      await syncWorktrees(this.storage);
    }
    await this.pushState();
  };

  private debouncedPushState = (): void => {
    if (this.pushStateTimer) {
      clearTimeout(this.pushStateTimer);
    }
    this.pushStateTimer = setTimeout(() => {
      this.pushStateTimer = undefined;
      void this.pushState();
    }, 100);
  };

  private pushState = async (): Promise<void> => {
    if (!this.view) {
      return;
    }

    const repos = await this.storage.getAllReposWithZones();
    const message: ExtensionToWebviewMessage = { type: MSG_TYPE_UPDATE, repos };
    await this.view.webview.postMessage(message);
  };

  private getHtml = (webview: vscode.Webview): string =>
    buildWebviewHtml(webview, this.extensionUri, 'index.js', 'index.css');

  dispose(): void {
    if (this.pushStateTimer) {
      clearTimeout(this.pushStateTimer);
    }
    this._onDidResolveView.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
