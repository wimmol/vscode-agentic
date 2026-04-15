import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import type { TerminalService } from '../services/TerminalService';
import { ERR_AGENT_CONTEXT_NOT_FOUND } from '../constants/messages';
import { addAgent } from './addAgent';

export const forkAgent = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  terminalService: TerminalService,
  agentId: string,
): Promise<string | undefined> => {
  const ctx = await storage.getAgentContext(agentId);
  if (!ctx) {
    vscode.window.showErrorMessage(ERR_AGENT_CONTEXT_NOT_FOUND);
    return;
  }

  const { agent, repo } = ctx;

  // Build a context prompt from the source agent
  const parts: string[] = ['Continue from the previous agent\'s work.'];
  if (agent.lastPrompt) {
    parts.push(`Last task: ${agent.lastPrompt}`);
  }
  if (agent.outputSummary) {
    parts.push(`Result: ${agent.outputSummary}`);
  }
  const forkPrompt = parts.join(' ');

  const newAgentId = await addAgent(
    storage,
    explorer,
    terminalService,
    repo.repositoryId,
    forkPrompt,
    'fork',
  );

  if (newAgentId) {
    await storage.updateAgent(newAgentId, { forkedFrom: agentId, templateName: agent.templateName });
  }

  return newAgentId;
};
