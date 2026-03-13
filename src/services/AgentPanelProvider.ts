import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { ExtensionToWebviewMessage } from '../types/messages';
import { VIEW_AGENTS } from '../constants/views';
import { CMD_READY, MSG_TYPE_UPDATE } from '../constants/commands';

/**
 * Bridges StateStorage and the Agent Panel webview.
 *
 * Registers as a WebviewViewProvider for the sidebar panel.
 * On every StateStorage change (and on initial resolve), reads the full
 * state, assembles RepoWithAgents[], and pushes it to the webview.
 * This is the only place where extension→webview communication happens.
 */
export class AgentPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = VIEW_AGENTS;

  private readonly _onDidResolveView = new vscode.EventEmitter<vscode.WebviewView>();
  readonly onDidResolveView: vscode.Event<vscode.WebviewView> = this._onDidResolveView.event;

  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private pushStateTimer: ReturnType<typeof setTimeout> | undefined;

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
        void this.pushState();
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

    const repos = await this.storage.getAllReposWithAgents();
    const message: ExtensionToWebviewMessage = { type: MSG_TYPE_UPDATE, repos };
    await this.view.webview.postMessage(message);
  };

  private getHtml = (webview: vscode.Webview): string => {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'ui', 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'ui', 'index.css'),
    );

    const nonce = getNonce();

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
    if (this.pushStateTimer) {
      clearTimeout(this.pushStateTimer);
    }
    this._onDidResolveView.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

const getNonce = (): string => randomBytes(16).toString('hex');
