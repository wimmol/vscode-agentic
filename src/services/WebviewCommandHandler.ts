import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { AgentPanelProvider } from './AgentPanelProvider';
import { createToggleRepoExpanded } from '../types/messages';
import type { ToggleRepoExpandedMessage, WebviewToExtensionMessage } from '../types/messages';

/**
 * Handles all webview → extension communication.
 *
 * Subscribes to the webview once it resolves, listens for incoming
 * commands via onDidReceiveMessage, and routes them to StateStorage.
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
          (message: WebviewToExtensionMessage) => this.handle(message),
        );
      }),
    );
  }

  toggleRepoExpanded = () => ({
    onClick: (repoId: string): ToggleRepoExpandedMessage => createToggleRepoExpanded(repoId),
    onReceive: async (data: { repoId: string }): Promise<void> => {
      await this.storage.toggleRepoExpanded(data.repoId);
    },
  });

  private handle = async (message: WebviewToExtensionMessage): Promise<void> => {
    switch (message.command) {
      case 'toggleRepoExpanded':
        await this.toggleRepoExpanded().onReceive(message.data);
        break;
    }
  };

  dispose(): void {
    this.messageDisposable?.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
