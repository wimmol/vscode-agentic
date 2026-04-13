import * as vscode from 'vscode';
import * as path from 'path';

/** Duck-typed subset of FileItem used by file operations. */
export interface FileItemLike {
  filePath: string;
  isDir: boolean;
  resourceUri: vscode.Uri;
}

interface ExplorerRef {
  refresh(): void;
  getRoots(): string[];
}

export const isFileItemLike = (item: unknown): item is FileItemLike =>
  typeof item === 'object' && item !== null && 'filePath' in item && 'isDir' in item;

const validateNotEmpty = (v: string): string | undefined => (v.trim() ? undefined : 'Name cannot be empty');

// ── Clipboard ────────────────────────────────────────────────────

let clipboard: { uris: vscode.Uri[]; cut: boolean } | undefined;

// ── Helpers ──────────────────────────────────────────────────────

const getTargetDir = (item: FileItemLike | undefined, roots: string[]): string | undefined => {
  if (!item) return roots[0];
  return item.isDir ? item.filePath : path.dirname(item.filePath);
};

const exists = async (uri: vscode.Uri): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
};

// ── Create ───────────────────────────────────────────────────────

export const newFile = async (explorer: ExplorerRef, item?: FileItemLike): Promise<void> => {
  const dir = getTargetDir(item, explorer.getRoots());
  if (!dir) return;

  const name = await vscode.window.showInputBox({
    prompt: 'File name',
    placeHolder: 'example.ts',
    ignoreFocusOut: true,
    validateInput: validateNotEmpty,
  });
  if (!name) return;

  const uri = vscode.Uri.file(path.join(dir, name));
  if (await exists(uri)) {
    vscode.window.showWarningMessage(`"${name}" already exists.`);
    return;
  }

  const parentUri = vscode.Uri.file(path.dirname(uri.fsPath));
  await vscode.workspace.fs.createDirectory(parentUri);
  await vscode.workspace.fs.writeFile(uri, new Uint8Array());
  explorer.refresh();
  await vscode.commands.executeCommand('vscode.open', uri, { viewColumn: vscode.ViewColumn.One });
};

export const newFolder = async (explorer: ExplorerRef, item?: FileItemLike): Promise<void> => {
  const dir = getTargetDir(item, explorer.getRoots());
  if (!dir) return;

  const name = await vscode.window.showInputBox({
    prompt: 'Folder name',
    placeHolder: 'new-folder',
    ignoreFocusOut: true,
    validateInput: validateNotEmpty,
  });
  if (!name) return;

  const uri = vscode.Uri.file(path.join(dir, name));
  if (await exists(uri)) {
    vscode.window.showWarningMessage(`"${name}" already exists.`);
    return;
  }

  await vscode.workspace.fs.createDirectory(uri);
  explorer.refresh();
};

// ── Rename ───────────────────────────────────────────────────────

export const renameItem = async (explorer: ExplorerRef, item: FileItemLike): Promise<void> => {
  const oldName = path.basename(item.filePath);
  const dotIdx = oldName.lastIndexOf('.');
  const selEnd = dotIdx > 0 ? dotIdx : oldName.length;

  const newName = await vscode.window.showInputBox({
    prompt: 'New name',
    value: oldName,
    valueSelection: [0, selEnd],
    ignoreFocusOut: true,
    validateInput: validateNotEmpty,
  });
  if (!newName || newName === oldName) return;

  const newUri = vscode.Uri.file(path.join(path.dirname(item.filePath), newName));
  if (await exists(newUri)) {
    vscode.window.showWarningMessage(`"${newName}" already exists.`);
    return;
  }

  await vscode.workspace.fs.rename(item.resourceUri, newUri);
  explorer.refresh();
};

// ── Delete ───────────────────────────────────────────────────────

export const deleteItems = async (explorer: ExplorerRef, items: FileItemLike[]): Promise<void> => {
  if (items.length === 0) return;

  const label =
    items.length === 1 ? `"${path.basename(items[0].filePath)}"` : `${items.length} items`;

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete ${label}?`,
    { modal: true },
    'Move to Trash',
    'Delete Permanently',
  );
  if (!confirm) return;

  const useTrash = confirm === 'Move to Trash';
  for (const item of items) {
    await vscode.workspace.fs.delete(item.resourceUri, { recursive: true, useTrash });
  }
  explorer.refresh();
};

// ── Copy / Cut / Paste ───────────────────────────────────────────

export const copyItems = (items: FileItemLike[]): void => {
  if (items.length === 0) return;
  clipboard = { uris: items.map((i) => i.resourceUri), cut: false };
};

export const cutItems = (items: FileItemLike[]): void => {
  if (items.length === 0) return;
  clipboard = { uris: items.map((i) => i.resourceUri), cut: true };
};

export const pasteItems = async (explorer: ExplorerRef, item?: FileItemLike): Promise<void> => {
  if (!clipboard || clipboard.uris.length === 0) return;

  const dir = getTargetDir(item, explorer.getRoots());
  if (!dir) return;

  const { uris, cut } = clipboard;

  for (const sourceUri of uris) {
    const baseName = path.basename(sourceUri.fsPath);
    let targetUri = vscode.Uri.file(path.join(dir, baseName));

    if (cut) {
      if (sourceUri.fsPath === targetUri.fsPath) continue;
      if (targetUri.fsPath.startsWith(sourceUri.fsPath + path.sep)) continue;
      let overwrite = false;
      if (await exists(targetUri)) {
        const choice = await vscode.window.showQuickPick(
          ['Replace', 'Keep Both', 'Cancel'],
          { placeHolder: `"${baseName}" already exists in destination`, ignoreFocusOut: true },
        );
        if (!choice || choice === 'Cancel') continue;
        if (choice === 'Keep Both') {
          const ext = path.extname(baseName);
          const nameNoExt = path.basename(baseName, ext);
          let counter = 1;
          do {
            const suffix = counter === 1 ? ' copy' : ` copy ${counter}`;
            targetUri = vscode.Uri.file(path.join(dir, `${nameNoExt}${suffix}${ext}`));
            counter++;
          } while (await exists(targetUri));
        } else {
          overwrite = true;
        }
      }
      await vscode.workspace.fs.rename(sourceUri, targetUri, { overwrite });
    } else {
      // Generate unique name if target exists
      if (await exists(targetUri)) {
        const ext = path.extname(baseName);
        const nameNoExt = path.basename(baseName, ext);
        let counter = 1;
        do {
          const suffix = counter === 1 ? ' copy' : ` copy ${counter}`;
          targetUri = vscode.Uri.file(path.join(dir, `${nameNoExt}${suffix}${ext}`));
          counter++;
        } while (await exists(targetUri));
      }
      await vscode.workspace.fs.copy(sourceUri, targetUri, { overwrite: false });
    }
  }

  if (cut) clipboard = undefined;
  explorer.refresh();
};

// ── Path utilities ───────────────────────────────────────────────

export const copyPath = (item: FileItemLike): void => {
  void vscode.env.clipboard.writeText(item.filePath);
};

export const copyRelativePath = (item: FileItemLike, roots: string[]): void => {
  const root = roots.find((r) => item.filePath.startsWith(r));
  const rel = root ? path.relative(root, item.filePath) : item.filePath;
  void vscode.env.clipboard.writeText(rel);
};

export const revealInOS = (item: FileItemLike): void => {
  void vscode.commands.executeCommand('revealFileInOS', item.resourceUri);
};
