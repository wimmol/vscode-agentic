import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { AgentPanelProvider } from './AgentPanelProvider';
import type { WebviewToExtensionMessage } from '../types/messages';
import { addRepo } from '../features/addRepo';

/**
 * Handles all webview → extension communication.
 *
 * Subscribes to the webview once it resolves, listens for incoming
 * commands via onDidReceiveMessage, and routes them by function name.
 */
export class WebviewCommandHandler implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private messageDisposable: vscode.Disposable | undefined;

  constructor(
    provider: AgentPanelProvider,
    private readonly storage: StateStorage,
  ) {
    this.disposables.push(
      provider.onDidResolveView((view) => {
        this.messageDisposable?.dispose();
        this.messageDisposable = view.webview.onDidReceiveMessage(
          (message: WebviewToExtensionMessage) => this.handler(message)
        );
      }),
    );
  }

  private handler = async (message: WebviewToExtensionMessage): Promise<void> => {
    console.log('[WebviewCommandHandler] received message:', message);
    try {
      switch (message.function) {
        case 'addRepo':
          await addRepo(this.storage);
          break;
        case 'toggleRepoExpanded':
          await this.storage.toggleRepoExpanded(message.args.repoId);
          break;
      }
      console.log('[WebviewCommandHandler] handled "%s" successfully', message.function);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WebviewCommandHandler] error handling "%s":', message.function, msg);
      vscode.window.showErrorMessage(msg);
    }
  };

  dispose(): void {
    this.messageDisposable?.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
