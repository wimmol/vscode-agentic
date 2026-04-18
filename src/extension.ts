import * as vscode from 'vscode';
import { createStateStorage } from './db';
import { registerExplorerCommands } from './features/registerExplorerCommands';
import { syncWorkspaceRepos, refreshCurrentBranches } from './features/syncWorkspaceRepos';
import { syncWorktrees } from './features/syncWorktrees';
import { AgentPanelProvider } from './services/AgentPanelProvider';
import { FileExplorerProvider } from './services/FileExplorerProvider';
import { SourceControlProvider } from './services/SourceControlProvider';
import { TerminalService } from './services/TerminalService';
import { WebviewCommandHandler } from './services/WebviewCommandHandler';
import { VIEW_EXPLORER, CONFIG_SECTION, CONFIG_BYPASS_PERMISSIONS } from './constants/views';
import { createTemplate, removeTemplate } from './features/manageTemplates';
import { logger } from './services/Logger';

const CTX_HAS_REPOS = 'vscode-agentic.hasRepos';

// Module-level reference so `deactivate` can flush in-flight writes (#65).
let activeExplorer: FileExplorerProvider | undefined;

export const activate = async (context: vscode.ExtensionContext) => {
  const storage = await createStateStorage(context);
  context.subscriptions.push(storage);

  const provider = new AgentPanelProvider(context.extensionUri, storage);
  context.subscriptions.push(provider);

  const explorer = new FileExplorerProvider(storage);
  activeExplorer = explorer;
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

  // Track whether any repositories are configured so menus / when-clauses can react (#43).
  const updateHasReposContext = async (): Promise<void> => {
    const repos = await storage.getAllRepositories();
    await vscode.commands.executeCommand('setContext', CTX_HAS_REPOS, repos.length > 0);
  };
  context.subscriptions.push(storage.onDidChange(() => { void updateHasReposContext(); }));
  void updateHasReposContext();

  // Surface config changes (#44). The Claude CLI is launched once per terminal,
  // so toggling `dangerouslyBypassPermissions` only affects new agents — tell the user.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`${CONFIG_SECTION}.${CONFIG_BYPASS_PERMISSIONS}`)) {
        logger.info('dangerouslyBypassPermissions changed', {});
        vscode.window.showInformationMessage(
          'Agentic: setting changed. Existing terminals keep the old flag — restart agents to apply.',
        );
      }
    }),
  );

  // Deferred: sync workspace git folders, worktrees, refresh branches, then restore agent terminals.
  // Awaited sequentially so the storage migration finishes before terminal restoration races against it (#38).
  setTimeout(() => {
    (async () => {
      try {
        await syncWorkspaceRepos(storage);
        await syncWorktrees(storage);
        await refreshCurrentBranches(storage);
        await terminalService.restoreAll();
      } catch (err) {
        logger.error('Agentic activation sync failed', err);
      }
    })();
  }, 0);

  logger.info('Agentic activated', { mode: vscode.ExtensionMode[context.extensionMode] });
};

/**
 * VS Code waits up to 5s for deactivate. We flush any pending explorer-state
 * writes here so the last collapse/expand toggle before reload isn't lost.
 */
export const deactivate = async (): Promise<void> => {
  try {
    await activeExplorer?.flush();
  } catch (err) {
    logger.warn('deactivate flush failed', { err: String(err) });
  }
  activeExplorer = undefined;
};
