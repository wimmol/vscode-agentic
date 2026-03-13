import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import type { TerminalService } from '../services/TerminalService';

/** Monotonic counter — prevents stale clicks from mutating explorer state. */
let generation = 0;

export const agentClick = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  terminalService: TerminalService,
  agentId: string,
): Promise<void> => {
  const gen = ++generation;

  const ctx = await storage.getAgentContext(agentId);
  if (!ctx) {
    throw new Error('Agent not found');
  }
  if (gen !== generation) {
    return;
  }

  explorer.showRepo(agentId, ctx.worktree.path);

  const terminal = terminalService.getTerminal(agentId);
  if (terminal) {
    terminal.show(false);
  }
};
