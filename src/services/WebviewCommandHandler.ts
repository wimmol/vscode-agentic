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
  CMD_TOGGLE_ZONE_EXPANDED,
  CMD_CLOSE_WORKTREE,
  CMD_SEND_PROMPT,
  CMD_FORK_AGENT,
  CMD_RENAME_AGENT,
  CMD_REMOVE_QUEUE_ITEM,
} from '../constants/commands';
import { sendPrompt } from '../features/sendPrompt';
import { forkAgent } from '../features/forkAgent';
import { renameAgent } from '../features/renameAgent';
import { addAgent } from '../features/addAgent';
import { addRepo } from '../features/addRepo';
import { removeAgent } from '../features/removeAgent';
import { removeRepo } from '../features/removeRepo';
import { rootClick } from '../features/rootClick';
import { repoRootClick } from '../features/repoRootClick';
import { agentClick } from '../features/agentClick';
import { closeWorktree } from '../features/closeWorktree';
import { logger } from './Logger';

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

  private isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  private requireString = (args: Record<string, unknown>, key: string): string => {
    const value = args[key];
    if (typeof value !== 'string' || !value) {
      throw new Error(`Invalid ${key}: expected non-empty string`);
    }
    return value;
  };

  private requireNumber = (args: Record<string, unknown>, key: string): number => {
    const value = args[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Invalid ${key}: expected number`);
    }
    return value;
  };

  private handler = async (message: WebviewToExtensionMessage): Promise<void> => {
    logger.trace('WebviewCommandHandler received', { function: message?.function });
    try {
      if (!message || typeof message.function !== 'string') {
        throw new Error('Invalid message: missing function name');
      }
      const args: Record<string, unknown> = this.isPlainObject(message.args) ? message.args : {};

      switch (message.function) {
        case CMD_ADD_AGENT: {
          await addAgent(this.storage, this.explorer, this.terminalService, this.requireString(args, 'repoId'));
          break;
        }
        case CMD_ADD_REPO:
          await addRepo(this.storage);
          break;
        case CMD_REMOVE_AGENT:
          await removeAgent(this.storage, this.terminalService, this.requireString(args, 'agentId'));
          break;
        case CMD_REMOVE_REPO:
          await removeRepo(this.storage, this.terminalService, this.requireString(args, 'repoId'));
          break;
        case CMD_TOGGLE_REPO_EXPANDED:
          await this.storage.toggleRepoExpanded(this.requireString(args, 'repoId'));
          break;
        case CMD_ROOT_CLICK:
          await rootClick(this.storage, this.explorer);
          break;
        case CMD_REPO_ROOT_CLICK:
          await repoRootClick(this.storage, this.explorer, this.requireString(args, 'repoId'));
          break;
        case CMD_AGENT_CLICK:
          await agentClick(this.storage, this.explorer, this.terminalService, this.requireString(args, 'agentId'));
          break;
        case CMD_TOGGLE_ZONE_EXPANDED:
          await this.storage.toggleZoneExpanded(this.requireString(args, 'repoId'), this.requireString(args, 'branch'));
          break;
        case CMD_CLOSE_WORKTREE:
          await closeWorktree(
            this.storage,
            this.terminalService,
            this.requireString(args, 'repoId'),
            this.requireString(args, 'branch'),
          );
          break;
        case CMD_SEND_PROMPT:
          await sendPrompt(this.storage, this.terminalService, this.requireString(args, 'agentId'));
          break;
        case CMD_FORK_AGENT:
          await forkAgent(this.storage, this.explorer, this.terminalService, this.requireString(args, 'agentId'));
          break;
        case CMD_RENAME_AGENT:
          await renameAgent(this.storage, this.requireString(args, 'agentId'));
          break;
        case CMD_REMOVE_QUEUE_ITEM:
          await this.storage.removeFromQueue(
            this.requireString(args, 'agentId'),
            this.requireNumber(args, 'index'),
          );
          break;
      }
      logger.trace('WebviewCommandHandler handled', { function: message.function });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('WebviewCommandHandler error', err, { function: message?.function });
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
