import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { ERR_AGENT_NOT_FOUND, INPUT_RENAME_PROMPT, INPUT_RENAME_PLACEHOLDER } from '../constants/messages';

export const renameAgent = async (storage: StateStorage, agentId: string): Promise<void> => {
  const agent = await storage.getAgent(agentId);
  if (!agent) {
    vscode.window.showErrorMessage(ERR_AGENT_NOT_FOUND);
    return;
  }

  const newName = await vscode.window.showInputBox({
    prompt: INPUT_RENAME_PROMPT,
    placeHolder: INPUT_RENAME_PLACEHOLDER,
    value: agent.name,
    ignoreFocusOut: true,
    validateInput: (v) => !v.trim() ? 'Name cannot be empty' : v.trim().length > 20 ? 'Max 20 characters' : undefined,
  });
  if (!newName) return;

  await storage.updateAgent(agentId, { name: newName.trim() });
};
