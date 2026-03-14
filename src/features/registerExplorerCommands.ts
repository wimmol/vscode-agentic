import * as vscode from 'vscode';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
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
} from './explorerFileOps';

type ExplorerItem = { filePath: string; isDir: boolean; resourceUri: vscode.Uri };

const wrap = (fn: () => Promise<void>) =>
  fn().catch((err: unknown) => {
    console.error('[Agentic]', err);
    vscode.window.showErrorMessage(`Agentic: ${err instanceof Error ? err.message : String(err)}`);
  });

/**
 * Registers all explorer file-operation commands (new, rename, delete, copy/cut/paste, etc.)
 * and returns a single Disposable that tears them all down.
 */
export const registerExplorerCommands = (
  explorer: FileExplorerProvider,
  treeView: vscode.TreeView<unknown>,
): vscode.Disposable => {
  const resolveItems = (item?: unknown, selected?: readonly unknown[]) => {
    if (selected && selected.length > 0) return selected.filter(isFileItemLike);
    if (item && isFileItemLike(item)) return [item];
    return treeView.selection.filter(isFileItemLike);
  };

  const resolveSingle = (item?: unknown): ExplorerItem | undefined =>
    item && isFileItemLike(item) ? item : treeView.selection.find(isFileItemLike);

  return vscode.Disposable.from(
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
  );
};
