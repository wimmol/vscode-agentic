import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { AgentPanelProvider } from './AgentPanelProvider';
import type { FileExplorerProvider } from './FileExplorerProvider';
import type { TerminalService } from './TerminalService';
import type { WebviewToExtensionMessage } from '../types/messages';
import {
  CMD_ADD_AGENT,
  CMD_ADD_REPO,
  CMD_REMOVE_AGENT,
  CMD_REMOVE_REPO,
  CMD_TOGGLE_REPO_EXPANDED,
  CMD_ROOT_CLICK,
  CMD_REPO_ROOT_CLICK,
  CMD_AGENT_CLICK,
} from '../constants/commands';
import { addAgent } from '../features/addAgent';
import { addRepo } from '../features/addRepo';
import { removeAgent } from '../features/removeAgent';
import { removeRepo } from '../features/removeRepo';
import { rootClick } from '../features/rootClick';
import { repoRootClick } from '../features/repoRootClick';
import { agentClick } from '../features/agentClick';

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
    private readonly explorer: FileExplorerProvider,
    private readonly terminalService: TerminalService,
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
        case CMD_ADD_AGENT: {
          await addAgent(this.storage, this.explorer, this.terminalService, message.args.repoId);
          break;
        }
        case CMD_ADD_REPO:
          await addRepo(this.storage);
          break;
        case CMD_REMOVE_AGENT:
          await removeAgent(this.storage, this.terminalService, message.args.agentId);
          break;
        case CMD_REMOVE_REPO:
          await removeRepo(this.storage, message.args.repoId);
          break;
        case CMD_TOGGLE_REPO_EXPANDED:
          await this.storage.toggleRepoExpanded(message.args.repoId);
          break;
        case CMD_ROOT_CLICK:
          await rootClick(this.storage, this.explorer);
          break;
        case CMD_REPO_ROOT_CLICK:
          await repoRootClick(this.storage, this.explorer, message.args.repoId);
          break;
        case CMD_AGENT_CLICK:
          await agentClick(this.storage, this.explorer, this.terminalService, message.args.agentId);
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
