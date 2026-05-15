import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import * as vscode from 'vscode';
import {
  TMUX_SOCKET_LABEL,
  TMUX_CONF_RELATIVE_PATH,
  TMUX_INSTALL_URL,
  tmuxSessionName,
} from '../constants/terminal';
import { TMUX_EXEC_TIMEOUT_MS } from '../constants/timing';
import { CONFIG_SECTION, CONFIG_TERMINAL_MODE } from '../constants/views';
import { BTN_INSTALL_TMUX, BTN_OPEN_SETTINGS } from '../constants/messages';

const execFile = promisify(execFileCb);

/**
 * Helpers for talking to a tmux server on the Agentic private socket
 * (`-L agentic`), plus the shared "tmux is missing" dialog. Subprocess
 * helpers swallow "session not found" exit codes or return `false`/no-op
 * so callers can compose without try/catch.
 */

/** Absolute path to the bundled agentic.tmux.conf inside the extension. */
export const confPath = (extensionFsPath: string): string =>
  join(extensionFsPath, TMUX_CONF_RELATIVE_PATH);

/** Cached `tmux -V` probe. Cleared when the user changes terminalMode so
 *  installing tmux mid-session and toggling the setting re-probes. */
let installedCache: Promise<boolean> | undefined;
const probeTmux = async (): Promise<boolean> => {
  try {
    await execFile('tmux', ['-V'], { timeout: TMUX_EXEC_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
};
export const isInstalled = (): Promise<boolean> => {
  if (!installedCache) installedCache = probeTmux();
  return installedCache;
};
export const invalidateInstalledCache = (): void => {
  installedCache = undefined;
};

/** True if a session for the given agent exists on the agentic socket. */
export const hasSession = async (agentId: string): Promise<boolean> => {
  const name = tmuxSessionName(agentId);
  try {
    await execFile('tmux', ['-L', TMUX_SOCKET_LABEL, 'has-session', '-t', `=${name}`], {
      timeout: TMUX_EXEC_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
};

/** Kill a session if it exists. Idempotent — no error if missing. */
export const killSession = async (agentId: string): Promise<void> => {
  const name = tmuxSessionName(agentId);
  try {
    await execFile('tmux', ['-L', TMUX_SOCKET_LABEL, 'kill-session', '-t', `=${name}`], {
      timeout: TMUX_EXEC_TIMEOUT_MS,
    });
  } catch {
    // Session doesn't exist or server already gone — both fine.
  }
};

/**
 * argv for `vscode.window.createTerminal({ shellPath: 'tmux', shellArgs })`
 * that spawns an attach-or-create session. The window's first command is
 * `claudeCmd`; we also chain a `set-option @workdir <cwd>` so the session
 * carries its repo path for diagnostic listing — atomically, no separate
 * subprocess and no race with the not-yet-spawned server.
 */
export const newSessionShellArgs = (opts: {
  agentId: string;
  cwd: string;
  claudeCmd: string;
  confPath: string;
}): string[] => {
  const name = tmuxSessionName(opts.agentId);
  return [
    '-L', TMUX_SOCKET_LABEL,
    '-f', opts.confPath,
    'new-session', '-A',
    '-s', name,
    '-c', opts.cwd,
    opts.claudeCmd,
    ';',
    'set-option', '-t', `=${name}`, '@workdir', opts.cwd,
  ];
};

/** argv for attaching to an existing session, no first command. */
export const attachShellArgs = (agentId: string): string[] => {
  const name = tmuxSessionName(agentId);
  return [
    '-L', TMUX_SOCKET_LABEL,
    'attach-session', '-t', `=${name}`,
  ];
};

/** Shared "tmux is missing" error dialog. Caller passes a context-specific
 *  message; the Install button opens the upstream guide; the optional
 *  Open-settings button takes the user to terminalMode so they can revert. */
export const showMissingDialog = async (
  message: string,
  options: { offerSettings?: boolean } = {},
): Promise<void> => {
  const buttons = options.offerSettings
    ? [BTN_INSTALL_TMUX, BTN_OPEN_SETTINGS]
    : [BTN_INSTALL_TMUX];
  const sel = await vscode.window.showErrorMessage(message, ...buttons);
  if (sel === BTN_INSTALL_TMUX) {
    void vscode.env.openExternal(vscode.Uri.parse(TMUX_INSTALL_URL));
  } else if (sel === BTN_OPEN_SETTINGS) {
    void vscode.commands.executeCommand(
      'workbench.action.openSettings',
      `${CONFIG_SECTION}.${CONFIG_TERMINAL_MODE}`,
    );
  }
};
