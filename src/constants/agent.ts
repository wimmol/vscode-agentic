export const AGENT_STATUS_CREATED = 'created' as const;
export const AGENT_STATUS_RUNNING = 'running' as const;
export const AGENT_STATUS_IDLE = 'idle' as const;
export const AGENT_STATUS_ERROR = 'error' as const;

export const AGENT_CLI_CLAUDE_CODE = 'claude-code' as const;

export const DEFAULT_AGENT_COMMAND = 'claude';
export const CLI_FLAG_BYPASS_PERMISSIONS = '--dangerously-skip-permissions';
export const CLI_FLAG_APPEND_SYSTEM_PROMPT = '--append-system-prompt';

export const DEFAULT_CONTEXT_WINDOW = 1_000_000;

/** Set in the spawned shell's env in tmux mode so Claude's fullscreen
 *  renderer doesn't capture mouse-wheel events — tmux owns the wheel
 *  and uses it to enter copy-mode for scrollback. */
export const ENV_CLAUDE_DISABLE_MOUSE = 'CLAUDE_CODE_DISABLE_MOUSE';

/** Env passed to every tmux-mode VS Code terminal. Shared between the
 *  fresh-create and silent-re-attach paths. */
export const TMUX_TERMINAL_ENV: Record<string, string> = {
  [ENV_CLAUDE_DISABLE_MOUSE]: '1',
};
