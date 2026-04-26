import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { ExtensionToWebviewMessage } from '../types/messages';
import { VIEW_AGENTS } from '../constants/views';
import { CMD_READY, MSG_TYPE_UPDATE, PROTOCOL_VERSION } from '../constants/commands';
import type { AgentTemplate } from '../types';
import { syncWorktrees } from '../features/syncWorktrees';
import { buildWebviewHtml } from '../utils/webview';
import { logger } from './Logger';

/** Cheap string digest of the template list; used to detect when the list
 *  has actually changed so we can reuse the previous reference on the wire. */
const templatesSignature = (list: AgentTemplate[]): string =>
  list.map((t) => `${t.templateId}:${t.name}:${t.color}:${t.isDefault}:${t.prompt.length}`).join('|');

/**
 * Bridges StateStorage and the Agent Panel webview.
 *
 * Registers as a WebviewViewProvider for the sidebar panel.
 * On every StateStorage change (and on initial resolve), reads the full
 * state, assembles RepoWithScopes[], and pushes it to the webview.
 * This is the only place where extension→webview communication happens.
 */
export class AgentPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = VIEW_AGENTS;

  private readonly _onDidResolveView = new vscode.EventEmitter<vscode.WebviewView>();
  readonly onDidResolveView: vscode.Event<vscode.WebviewView> = this._onDidResolveView.event;

  private static readonly SYNC_COOLDOWN_MS = 5_000;

  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  /** Listeners scoped to the current webview instance; replaced on every resolve. */
  private viewDisposables: vscode.Disposable[] = [];
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
    // Dispose any previously-resolved view's listeners before wiring up new ones.
    for (const d of this.viewDisposables) d.dispose();
    this.viewDisposables = [];

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
    }, null, this.viewDisposables);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.function === CMD_READY) {
        logger.trace('AgentPanelProvider webview ready, pushing initial state');
        void this.pushState();
      }
    }, null, this.viewDisposables);

    webviewView.onDidDispose(() => {
      this.view = undefined;
      for (const d of this.viewDisposables) d.dispose();
      this.viewDisposables = [];
    }, null, this.viewDisposables);

    this._onDidResolveView.fire(webviewView);
  }

  private syncAndPush = async (): Promise<void> => {
    const now = Date.now();
    if (now - this.lastSyncTime >= AgentPanelProvider.SYNC_COOLDOWN_MS) {
      this.lastSyncTime = now;
      await syncWorktrees(this.storage);
    }
    // syncWorktrees may have fired storage.onDidChange which scheduled a
    // debounced push. Cancel it — the immediate push below is authoritative.
    if (this.pushStateTimer) {
      clearTimeout(this.pushStateTimer);
      this.pushStateTimer = undefined;
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

  /** Snapshot of the last templates array, compared by shallow identity of
   *  each template's fields — lets us skip shipping the list on pushes that
   *  only changed agent state (which is most of them). */
  private lastTemplatesSig: string | undefined;
  private lastTemplates: ExtensionToWebviewMessage['templates'] = [];

  private pushState = async (): Promise<void> => {
    if (!this.view) {
      return;
    }

    const repos = await this.storage.getAllReposWithScopes();
    const templates = this.storage.getAllTemplates();
    const sig = templatesSignature(templates);
    if (sig !== this.lastTemplatesSig) {
      this.lastTemplatesSig = sig;
      this.lastTemplates = templates;
    }
    const message: ExtensionToWebviewMessage = {
      type: MSG_TYPE_UPDATE,
      protocol: PROTOCOL_VERSION,
      repos,
      templates: this.lastTemplates,
    };
    await this.view.webview.postMessage(message);
  };

  private getHtml = (webview: vscode.Webview): string =>
    buildWebviewHtml(webview, this.extensionUri, 'index.js', 'index.css');

  dispose(): void {
    if (this.pushStateTimer) {
      clearTimeout(this.pushStateTimer);
    }
    this._onDidResolveView.dispose();
    for (const d of this.viewDisposables) d.dispose();
    this.viewDisposables = [];
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
