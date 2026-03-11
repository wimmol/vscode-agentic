import * as vscode from 'vscode';

export const rootClick = async (): Promise<void> => {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    await vscode.commands.executeCommand('revealInExplorer', folder.uri);
  } else {
    vscode.window.showInformationMessage('No workspace folder is open.');
  }
};
