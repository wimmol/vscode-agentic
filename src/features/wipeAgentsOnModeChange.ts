import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { TerminalService } from '../services/TerminalService';
import { CONFIG_SECTION, CONFIG_TERMINAL_MODE } from '../constants/views';
import { TERMINAL_MODE_TMUX, type TerminalMode } from '../constants/terminal';
import { BTN_SWITCH_AND_WIPE } from '../constants/messages';
import { logger } from '../services/Logger';
import * as tmux from '../services/TmuxSession';

/**
 * Revert `vscode-agentic.terminalMode` to its previous value at whichever
 * scope the user changed it in. Avoids the case where a Global-scoped
 * setting is reverted at Workspace scope, leaving an inconsistent override.
 */
const revertSetting = async (previousMode: TerminalMode): Promise<void> => {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const inspected = cfg.inspect<TerminalMode>(CONFIG_TERMINAL_MODE);
  let target: vscode.ConfigurationTarget;
  if (inspected?.workspaceFolderValue !== undefined) {
    target = vscode.ConfigurationTarget.WorkspaceFolder;
  } else if (inspected?.workspaceValue !== undefined) {
    target = vscode.ConfigurationTarget.Workspace;
  } else {
    target = vscode.ConfigurationTarget.Global;
  }
  await cfg.update(CONFIG_TERMINAL_MODE, previousMode, target);
};

/**
 * Handle a runtime change to `vscode-agentic.terminalMode`. Warns that
 * all agents will be reset, then either:
 *   - confirms: closes terminals (incl. tmux kill) and deletes agent rows.
 *     Worktrees and branches are intentionally preserved on disk.
 *   - cancels:  reverts the setting to `previousMode`.
 *
 * If newMode is `tmux` but tmux is not installed, surface an error and
 * revert without touching any agents.
 */
export const wipeAgentsOnModeChange = async (
  storage: StateStorage,
  terminalService: TerminalService,
  newMode: TerminalMode,
  previousMode: TerminalMode,
): Promise<boolean> => {
  if (newMode === TERMINAL_MODE_TMUX && !(await tmux.isInstalled())) {
    await tmux.showMissingDialog(
      'Agentic: tmux is not installed. Install it before switching terminal mode to "tmux".',
    );
    await revertSetting(previousMode);
    return false;
  }

  const agents = await storage.getAllAgents();
  if (agents.length === 0) {
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    `Agentic: switching terminal mode to "${newMode}" will reset all ${agents.length} agent(s). Worktrees and branches will be kept on disk. Continue?`,
    { modal: true },
    BTN_SWITCH_AND_WIPE,
  );

  if (choice !== BTN_SWITCH_AND_WIPE) {
    await revertSetting(previousMode);
    return false;
  }

  await Promise.all(
    agents.map(async (agent) => {
      terminalService.closeTerminal(agent.agentId);
      try {
        await storage.removeAgent(agent.agentId);
      } catch (err) {
        logger.warn('wipeAgentsOnModeChange removeAgent failed', {
          agentId: agent.agentId,
          err: String(err),
        });
      }
    }),
  );
  logger.info('terminalMode wipe complete', { from: previousMode, to: newMode, count: agents.length });
  return true;
};
