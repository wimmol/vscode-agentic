import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import * as vscode from 'vscode';
import {
  TMUX_SOCKET_LABEL,
  TMUX_CONF_RELATIVE_PATH,
  TMUX_INSTALL_URL,
} from '../constants/terminal';
import { TMUX_EXEC_TIMEOUT_MS } from '../constants/timing';
import { CONFIG_SECTION, CONFIG_TERMINAL_MODE } from '../constants/views';
import { BTN_INSTALL_TMUX, BTN_OPEN_SETTINGS } from '../constants/messages';
import { logger } from './Logger';

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

/** True if a session with the given name exists on the agentic socket. */
export const hasSession = async (sessionName: string): Promise<boolean> => {
  try {
    await execFile('tmux', ['-L', TMUX_SOCKET_LABEL, 'has-session', '-t', `=${sessionName}`], {
      timeout: TMUX_EXEC_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
};

/** Kill a session if it exists. Idempotent — no error if missing. */
export const killSession = async (sessionName: string): Promise<void> => {
  try {
    await execFile('tmux', ['-L', TMUX_SOCKET_LABEL, 'kill-session', '-t', `=${sessionName}`], {
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
  sessionName: string;
  cwd: string;
  claudeCmd: string;
  confPath: string;
}): string[] => {
  return [
    '-L', TMUX_SOCKET_LABEL,
    '-f', opts.confPath,
    'new-session', '-A',
    '-s', opts.sessionName,
    '-c', opts.cwd,
    opts.claudeCmd,
    ';',
    'set-option', '-t', `=${opts.sessionName}`, '@workdir', opts.cwd,
  ];
};

/** argv for attaching to an existing session, no first command. */
export const attachShellArgs = (sessionName: string): string[] => {
  return [
    '-L', TMUX_SOCKET_LABEL,
    'attach-session', '-t', `=${sessionName}`,
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

/**
 * Apply the runtime-mutable subset of `agentic.tmux.conf` to an already-running
 * agentic server. Tmux only reads `-f confpath` on server start, so when the
 * extension ships a newer conf the existing server keeps the old settings
 * (mode-style stays default yellow, set-clipboard stays off, etc.) until the
 * server is killed. Calling this on activation catches the server up without
 * disturbing live sessions. No-op if the server isn't running.
 *
 * `source-file` can't replace this — the conf's `unbind-key -a` errors mid-
 * source on a server where the prefix table is already gone, aborting the
 * remaining settings.
 */
export const syncRunningServerSettings = async (): Promise<void> => {
  try {
    // `list-sessions` exits non-zero when no server is running on this socket;
    // treat that as the no-op signal.
    await execFile('tmux', ['-L', TMUX_SOCKET_LABEL, 'list-sessions'], {
      timeout: TMUX_EXEC_TIMEOUT_MS,
    });
  } catch {
    return;
  }
  const args: string[][] = [
    ['set', '-g', 'mode-style', 'bg=#264f78,fg=default'],
    ['set', '-g', 'set-clipboard', 'on'],
    ['set', '-g', 'allow-passthrough', 'on'],
    ['set', '-as', 'terminal-features', ',xterm-256color:RGB:bpaste:clipboard'],
    ['bind-key', '-T', 'copy-mode',    'MouseDragEnd1Pane', 'send', '-X', 'copy-pipe-and-cancel'],
    ['bind-key', '-T', 'copy-mode-vi', 'MouseDragEnd1Pane', 'send', '-X', 'copy-pipe-and-cancel'],
  ];
  await Promise.all(
    args.map(async (a) => {
      try {
        await execFile('tmux', ['-L', TMUX_SOCKET_LABEL, ...a], {
          timeout: TMUX_EXEC_TIMEOUT_MS,
        });
      } catch (err) {
        logger.warn('tmux syncRunningServerSettings failed', { args: a, err: String(err) });
      }
    }),
  );
};

