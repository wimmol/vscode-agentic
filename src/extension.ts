import * as vscode from 'vscode';
import { createStateStorage } from './db';
import type { StateStorage } from './db';
import { AgentPanelProvider } from './services/AgentPanelProvider';
import { WebviewCommandHandler } from './services/WebviewCommandHandler';

let storage: StateStorage | undefined;

export const activate = async (context: vscode.ExtensionContext) => {
  if (!storage) {
    storage = await createStateStorage(context);
  }
  context.subscriptions.push({ dispose: () => { storage?.dispose(); storage = undefined; } });

  const provider = new AgentPanelProvider(context.extensionUri, storage);
  context.subscriptions.push(provider);

  const commandHandler = new WebviewCommandHandler(provider, storage);
  context.subscriptions.push(commandHandler);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, provider),
  );
};

export const deactivate = () => {};
