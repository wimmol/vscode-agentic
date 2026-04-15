import * as vscode from 'vscode';
import { createStateStorage } from './db';
import { registerExplorerCommands } from './features/registerExplorerCommands';
import { syncWorkspaceRepos } from './features/syncWorkspaceRepos';
import { syncWorktrees } from './features/syncWorktrees';
import { AgentPanelProvider } from './services/AgentPanelProvider';
import { FileExplorerProvider } from './services/FileExplorerProvider';
import { SourceControlProvider } from './services/SourceControlProvider';
import { TerminalService } from './services/TerminalService';
import { WebviewCommandHandler } from './services/WebviewCommandHandler';
import { VIEW_EXPLORER } from './constants/views';
import { createTemplate, removeTemplate } from './features/manageTemplates';

export const activate = (context: vscode.ExtensionContext) => {
  const storage = createStateStorage(context);
  context.subscriptions.push(storage);

  const provider = new AgentPanelProvider(context.extensionUri, storage);
  context.subscriptions.push(provider);

  const explorer = new FileExplorerProvider(storage);
  context.subscriptions.push(explorer);

  const treeView = vscode.window.createTreeView(VIEW_EXPLORER, {
    treeDataProvider: explorer,
    canSelectMany: true,
    dragAndDropController: explorer,
  });
  explorer.attachTreeView(treeView);
  context.subscriptions.push(treeView);

  const sourceControl = new SourceControlProvider(context.extensionUri, explorer);
  context.subscriptions.push(sourceControl);

  const terminalService = new TerminalService(storage);
  context.subscriptions.push(terminalService);

  const commandHandler = new WebviewCommandHandler(provider, storage, explorer, terminalService);
  context.subscriptions.push(commandHandler);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, provider),
    vscode.window.registerWebviewViewProvider(SourceControlProvider.viewType, sourceControl),
    registerExplorerCommands(explorer, treeView, storage, terminalService),
    vscode.commands.registerCommand('vscode-agentic.explorer.refresh', () => explorer.refresh()),
    vscode.commands.registerCommand('vscode-agentic.createTemplate', () => createTemplate(storage)),
    vscode.commands.registerCommand('vscode-agentic.removeTemplate', () => removeTemplate(storage)),
  );

  // Deferred: sync workspace git folders, worktrees, and restore agent terminals.
  setTimeout(() => {
    syncWorkspaceRepos(storage)
      .then(() => syncWorktrees(storage))
      .catch((err) => console.error('[Agentic] workspace/worktree sync failed:', err));
    terminalService.restoreAll().catch((err) => console.error('[Agentic] terminal restore failed:', err));
  }, 0);
};

export const deactivate = () => {};
