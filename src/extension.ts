import * as vscode from 'vscode';
import { createStateStorage } from './db';
import { AgentPanelProvider } from './services/AgentPanelProvider';
import { WebviewCommandHandler } from './services/WebviewCommandHandler';

export const activate = async (context: vscode.ExtensionContext) => {
  const storage = await createStateStorage(context);
  context.subscriptions.push(storage);

  const provider = new AgentPanelProvider(context.extensionUri, storage);
  context.subscriptions.push(provider);

  const commandHandler = new WebviewCommandHandler(provider, storage);
  context.subscriptions.push(commandHandler);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, provider),
  );
};

export const deactivate = () => {};
