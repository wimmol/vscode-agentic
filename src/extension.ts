import * as vscode from 'vscode';
import { createStateStorage } from './db';
import { syncWorkspaceRepos } from './features/syncWorkspaceRepos';
import { AgentPanelProvider } from './services/AgentPanelProvider';
import { FileExplorerProvider } from './services/FileExplorerProvider';
import { TerminalService } from './services/TerminalService';
import { WebviewCommandHandler } from './services/WebviewCommandHandler';
import { VIEW_EXPLORER } from './constants/views';

export const activate = (context: vscode.ExtensionContext) => {
  const storage = createStateStorage(context);
  context.subscriptions.push(storage);

  const provider = new AgentPanelProvider(context.extensionUri, storage);
  context.subscriptions.push(provider);

  const explorer = new FileExplorerProvider(storage);
  context.subscriptions.push(explorer);

  const treeView = vscode.window.createTreeView(VIEW_EXPLORER, {
    treeDataProvider: explorer,
  });
  explorer.attachTreeView(treeView);
  context.subscriptions.push(treeView);

  const terminalService = new TerminalService(storage);
  context.subscriptions.push(terminalService);

  const commandHandler = new WebviewCommandHandler(provider, storage, explorer, terminalService);
  context.subscriptions.push(commandHandler);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, provider),
  );

  // Deferred: sync workspace git folders and restore agent terminals.
  setTimeout(() => {
    syncWorkspaceRepos(storage).catch((err) => console.error('[Agentic] workspace sync failed:', err));
    terminalService.restoreAll().catch((err) => console.error('[Agentic] terminal restore failed:', err));
  }, 0);
};

export const deactivate = () => {};
