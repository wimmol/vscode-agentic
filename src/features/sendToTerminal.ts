import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { TerminalService } from '../services/TerminalService';
import type { FileItemLike } from './explorerFileOps';

/**
 * Sends file/folder paths to the currently focused agent's Claude terminal
 * without pressing Enter, so the user can compose a prompt around them.
 */
export const sendToTerminal = async (
  storage: StateStorage,
  terminalService: TerminalService,
  items: FileItemLike[],
): Promise<void> => {
  if (items.length === 0) return;

  const focused = await storage.getFocusedAgent();
  if (!focused) {
    vscode.window.showWarningMessage('No focused agent. Click an agent first.');
    return;
  }

  const terminal = terminalService.getTerminal(focused.agentId);
  if (!terminal) {
    vscode.window.showWarningMessage('Agent terminal is not running.');
    return;
  }

  const paths = items.map((i) => i.filePath).join(' ');
  terminal.sendText(paths, false);
  terminal.show(true);
};
