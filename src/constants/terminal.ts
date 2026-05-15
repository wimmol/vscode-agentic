export const terminalName = (agentName: string, branch: string, repoName: string): string =>
  `${agentName} · ${branch} (${repoName})`;

export const TERMINAL_MODE_DEFAULT = 'default' as const;
export const TERMINAL_MODE_TMUX = 'tmux' as const;
export type TerminalMode = typeof TERMINAL_MODE_DEFAULT | typeof TERMINAL_MODE_TMUX;

/** Private tmux socket so Agentic never touches the user's default tmux
 *  server and a crash here doesn't affect their personal sessions. */
export const TMUX_SOCKET_LABEL = 'agentic';

/** Bundled tmux config file under the extension's `resources/` dir. */
export const TMUX_CONF_RELATIVE_PATH = 'resources/agentic.tmux.conf';

/** Session-name prefix; the rest is the sanitized tile descriptor. Used
 *  both to build names (`tmuxSessionName`) and to identify Agentic-owned
 *  sessions during cleanup or listing. */
export const TMUX_SESSION_PREFIX = 'agentic-';

/** Build a tmux session name that matches the Agentic tile / VS Code
 *  terminal name. tmux forbids `.`, `:`, whitespace in session names, so
 *  those characters are replaced with `_`. The middle-dot and parentheses
 *  used in `terminalName` are allowed and kept intact for readability. */
export const tmuxSessionName = (agentName: string, branch: string, repoName: string): string => {
  const display = terminalName(agentName, branch, repoName);
  return `${TMUX_SESSION_PREFIX}${display.replace(/[.:\s]/g, '_')}`;
};

/** Pattern that matches any terminal Agentic owns. Used to identify
 *  orphan / empty terminals on startup so they can be disposed. */
export const AGENTIC_TERMINAL_NAME_RE = /^.+ · .+ \(.+\)$/;

/** Linked from "Install tmux" buttons in error dialogs. */
export const TMUX_INSTALL_URL = 'https://github.com/tmux/tmux/wiki/Installing';
