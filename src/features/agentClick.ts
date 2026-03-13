import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import { terminalName } from '../constants/terminal';

/** Monotonic counter — prevents stale clicks from mutating explorer state. */
let generation = 0;

export const agentClick = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  agentId: string,
): Promise<void> => {
  const gen = ++generation;

  const agent = await storage.getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent not found`);
  }
  if (gen !== generation) {
    return;
  }

  const [repo, worktree] = await Promise.all([
    storage.getRepository(agent.repoId),
    storage.getWorktree(agentId),
  ]);

  if (!repo) {
    throw new Error(`Repository not found for agent "${agent.name}"`);
  }
  if (!worktree) {
    throw new Error(`Worktree not found for agent "${agent.name}"`);
  }
  if (gen !== generation) {
    return;
  }

  explorer.showRepo(agentId, worktree.path);

  const name = terminalName(agent.name, repo.name);
  const terminal = vscode.window.terminals.find((t) => t.name === name);
  if (terminal) {
    terminal.show(true);
  }
};
