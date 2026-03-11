import * as vscode from 'vscode';
import { createStateStorage } from './db';
import { AgentPanelProvider } from './services/AgentPanelProvider';
import { FileExplorerProvider } from './services/FileExplorerProvider';
import { WebviewCommandHandler } from './services/WebviewCommandHandler';

export const activate = async (context: vscode.ExtensionContext) => {
  const storage = await createStateStorage(context);
  context.subscriptions.push(storage);

  const provider = new AgentPanelProvider(context.extensionUri, storage);
  context.subscriptions.push(provider);

  const explorer = new FileExplorerProvider(storage);
  context.subscriptions.push(explorer);

  const treeView = vscode.window.createTreeView('vscode-agentic.explorer', {
    treeDataProvider: explorer,
  });
  explorer.attachTreeView(treeView);
  context.subscriptions.push(treeView);

  const commandHandler = new WebviewCommandHandler(provider, storage, explorer);
  context.subscriptions.push(commandHandler);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, provider),
  );
};

export const deactivate = () => {};
