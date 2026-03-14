import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import type { TerminalService } from '../services/TerminalService';
import {
  newFile,
  newFolder,
  renameItem,
  deleteItems,
  copyItems,
  cutItems,
  pasteItems,
  copyPath,
  copyRelativePath,
  revealInOS,
  isFileItemLike,
  type FileItemLike,
} from './explorerFileOps';
import { sendToTerminal } from './sendToTerminal';
import { addAgentWithTask } from './addAgentWithTask';

const wrap = (fn: () => Promise<void>) =>
  fn().catch((err: unknown) => {
    console.error('[Agentic]', err);
    vscode.window.showErrorMessage(`Agentic: ${err instanceof Error ? err.message : String(err)}`);
  });

/**
 * Registers all explorer commands (file ops + agent actions)
 * and returns a single Disposable that tears them all down.
 */
export const registerExplorerCommands = (
  explorer: FileExplorerProvider,
  treeView: vscode.TreeView<unknown>,
  storage: StateStorage,
  terminalService: TerminalService,
): vscode.Disposable => {
  const resolveItems = (item?: unknown, selected?: readonly unknown[]) => {
    if (selected && selected.length > 0) return selected.filter(isFileItemLike);
    if (item && isFileItemLike(item)) return [item];
    return treeView.selection.filter(isFileItemLike);
  };

  const resolveSingle = (item?: unknown): FileItemLike | undefined =>
    item && isFileItemLike(item) ? item : treeView.selection.find(isFileItemLike);

  /** Prompt for optional custom instructions. Returns undefined if user cancels. */
  const promptCustomInstructions = (title: string) =>
    vscode.window.showInputBox({
      title,
      placeHolder: 'Optional extra instructions (leave empty for defaults)',
      ignoreFocusOut: true,
    });

  return vscode.Disposable.from(
    // ── File operations ──────────────────────────────────────────
    vscode.commands.registerCommand('vscode-agentic.explorer.newFile', (item?: unknown) =>
      wrap(() => newFile(explorer, isFileItemLike(item) ? item : undefined)),
    ),
    vscode.commands.registerCommand('vscode-agentic.explorer.newFolder', (item?: unknown) =>
      wrap(() => newFolder(explorer, isFileItemLike(item) ? item : undefined)),
    ),
    vscode.commands.registerCommand('vscode-agentic.explorer.rename', (item?: unknown) => {
      const target = resolveSingle(item);
      if (!target) return;
      return wrap(() => renameItem(explorer, target));
    }),
    vscode.commands.registerCommand('vscode-agentic.explorer.delete', (item?: unknown, selected?: readonly unknown[]) =>
      wrap(() => deleteItems(explorer, resolveItems(item, selected))),
    ),
    vscode.commands.registerCommand('vscode-agentic.explorer.copy', (item?: unknown, selected?: readonly unknown[]) => {
      copyItems(resolveItems(item, selected));
    }),
    vscode.commands.registerCommand('vscode-agentic.explorer.cut', (item?: unknown, selected?: readonly unknown[]) => {
      cutItems(resolveItems(item, selected));
    }),
    vscode.commands.registerCommand('vscode-agentic.explorer.paste', (item?: unknown) =>
      wrap(() => pasteItems(explorer, isFileItemLike(item) ? item : undefined)),
    ),
    vscode.commands.registerCommand('vscode-agentic.explorer.copyPath', (item?: unknown) => {
      const target = resolveSingle(item);
      if (target) copyPath(target);
    }),
    vscode.commands.registerCommand('vscode-agentic.explorer.copyRelativePath', (item?: unknown) => {
      const target = resolveSingle(item);
      if (target) copyRelativePath(target, explorer.getRoots());
    }),
    vscode.commands.registerCommand('vscode-agentic.explorer.revealInOS', (item?: unknown) => {
      const target = resolveSingle(item);
      if (target) revealInOS(target);
    }),

    // ── Agent actions ────────────────────────────────────────────
    vscode.commands.registerCommand('vscode-agentic.explorer.sendToTerminal', (item?: unknown, selected?: readonly unknown[]) =>
      wrap(() => sendToTerminal(storage, terminalService, resolveItems(item, selected))),
    ),
    vscode.commands.registerCommand('vscode-agentic.explorer.generateDocs', (item?: unknown, selected?: readonly unknown[]) =>
      wrap(async () => {
        const items = resolveItems(item, selected);
        if (items.length === 0) return;
        const custom = await promptCustomInstructions('Generate Documentation');
        if (custom === undefined) return;
        await addAgentWithTask(storage, explorer, terminalService, items, 'doc', custom);
      }),
    ),
    vscode.commands.registerCommand('vscode-agentic.explorer.refactor', (item?: unknown, selected?: readonly unknown[]) =>
      wrap(async () => {
        const items = resolveItems(item, selected);
        if (items.length === 0) return;
        const custom = await promptCustomInstructions('Refactor');
        if (custom === undefined) return;
        await addAgentWithTask(storage, explorer, terminalService, items, 'refactor', custom);
      }),
    ),
  );
};
