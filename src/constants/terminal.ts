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

/** Session-name prefix; the rest is the Agent UUID. Used both to build
 *  names (`tmuxSessionName`) and to identify Agentic-owned sessions
 *  during cleanup or listing. */
export const TMUX_SESSION_PREFIX = 'agentic-';

/** tmux session names disallow `.`, `:`, whitespace. Agent IDs are UUIDs,
 *  so no further sanitization is needed. */
export const tmuxSessionName = (agentId: string): string => `${TMUX_SESSION_PREFIX}${agentId}`;

/** Linked from "Install tmux" buttons in error dialogs. */
export const TMUX_INSTALL_URL = 'https://github.com/tmux/tmux/wiki/Installing';
