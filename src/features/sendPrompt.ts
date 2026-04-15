import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { TerminalService } from '../services/TerminalService';
import { AGENT_STATUS_RUNNING } from '../constants/agent';
import {
  INPUT_SEND_PROMPT_PROMPT,
  INPUT_SEND_PROMPT_PLACEHOLDER,
  ERR_AGENT_NOT_FOUND,
  WARN_TERMINAL_NOT_RUNNING,
} from '../constants/messages';

export const sendPrompt = async (
  storage: StateStorage,
  terminalService: TerminalService,
  agentId: string,
): Promise<void> => {
  const agent = await storage.getAgent(agentId);
  if (!agent) {
    vscode.window.showErrorMessage(ERR_AGENT_NOT_FOUND);
    return;
  }

  const prompt = await vscode.window.showInputBox({
    prompt: INPUT_SEND_PROMPT_PROMPT,
    placeHolder: INPUT_SEND_PROMPT_PLACEHOLDER,
    ignoreFocusOut: true,
  });
  if (!prompt) return;

  if (agent.status === AGENT_STATUS_RUNNING) {
    await storage.pushToQueue(agentId, prompt);
    return;
  }

  const terminal = terminalService.getTerminal(agentId);
  if (!terminal) {
    vscode.window.showWarningMessage(WARN_TERMINAL_NOT_RUNNING);
    return;
  }

  terminal.sendText(prompt, true);
  terminal.show(true);
};
