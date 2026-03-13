import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import type { TerminalService } from '../services/TerminalService';
import { ERR_AGENT_NOT_FOUND } from '../constants/messages';

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
    throw new Error(ERR_AGENT_NOT_FOUND);
  }
  if (gen !== generation) {
    return;
  }

  explorer.showRepo(agentId, ctx.worktree.path, ctx.repo.name, ctx.agent.name);

  const terminal = terminalService.getTerminal(agentId);
  if (terminal) {
    terminal.show(false);
  }
};
