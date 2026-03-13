import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import { terminalName } from '../constants/terminal';

export const agentClick = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  agentId: string,
): Promise<void> => {
  const agent = await storage.getAgent(agentId);
  if (!agent) {
    return;
  }

  const [repo, worktree] = await Promise.all([
    storage.getRepository(agent.repoId),
    storage.getWorktree(agentId),
  ]);

  if (!repo || !worktree) {
    return;
  }

  explorer.showRepo(agentId, worktree.path);

  const name = terminalName(agent.name, repo.name);
  const terminal = vscode.window.terminals.find((t) => t.name === name);
  if (terminal) {
    terminal.show(true);
  }
};
