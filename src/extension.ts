import * as vscode from 'vscode';
import { createStateStorage } from './db';
import { registerExplorerCommands } from './features/registerExplorerCommands';
import { syncWorkspaceRepos, refreshCurrentBranches } from './features/syncWorkspaceRepos';
import { syncWorktrees } from './features/syncWorktrees';
import { AgentPanelProvider } from './services/AgentPanelProvider';
import { FileExplorerProvider } from './services/FileExplorerProvider';
import { SourceControlProvider } from './services/SourceControlProvider';
import { SummariserService } from './services/SummariserService';
import { TemplateEditorProvider } from './services/TemplateEditorProvider';
import { TerminalService } from './services/TerminalService';
import { WebviewCommandHandler } from './services/WebviewCommandHandler';
import { VIEW_EXPLORER, CONFIG_SECTION, CONFIG_BYPASS_PERMISSIONS } from './constants/views';
import { TE_COMMAND_OPEN } from './constants/templateEditor';
import { logger } from './services/Logger';

const CTX_HAS_REPOS = 'vscode-agentic.hasRepos';

// Module-level reference so `deactivate` can flush in-flight writes (#65).
let activeExplorer: FileExplorerProvider | undefined;

export const activate = async (context: vscode.ExtensionContext) => {
  const storage = await createStateStorage(context);
  context.subscriptions.push(storage);

  // Seed the default "basic" template on first activation. Idempotent.
  await storage.ensureDefaultTemplate();

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

  const summariser = new SummariserService(
    storage,
    vscode.Uri.joinPath(context.globalStorageUri, 'transformers'),
  );
  context.subscriptions.push(summariser);

  const terminalService = new TerminalService(storage, summariser);
  context.subscriptions.push(terminalService);

  const templateEditor = new TemplateEditorProvider(context.extensionUri, storage);
  context.subscriptions.push(templateEditor);

  const commandHandler = new WebviewCommandHandler(provider, storage, explorer, terminalService, templateEditor);
  context.subscriptions.push(commandHandler);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, provider),
    vscode.window.registerWebviewViewProvider(SourceControlProvider.viewType, sourceControl),
    registerExplorerCommands(explorer, treeView, storage, terminalService),
    vscode.commands.registerCommand('vscode-agentic.explorer.refresh', () => explorer.refresh()),
    vscode.commands.registerCommand(TE_COMMAND_OPEN, () => templateEditor.open()),
  );

  // Track whether any repositories are configured so menus / when-clauses can react (#43).
  // Cached because `onDidChange` fires on every agent mutation; skipping the
  // setContext dispatch when the value hasn't changed avoids thousands of
  // no-op commands during an active agent run.
  let lastHasRepos: boolean | undefined;
  const updateHasReposContext = async (): Promise<void> => {
    const repos = await storage.getAllRepositories();
    const has = repos.length > 0;
    if (has === lastHasRepos) return;
    lastHasRepos = has;
    await vscode.commands.executeCommand('setContext', CTX_HAS_REPOS, has);
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
