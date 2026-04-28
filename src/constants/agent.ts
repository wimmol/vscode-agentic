export const AGENT_STATUS_CREATED = 'created' as const;
export const AGENT_STATUS_RUNNING = 'running' as const;
export const AGENT_STATUS_IDLE = 'idle' as const;
export const AGENT_STATUS_ERROR = 'error' as const;

export const AGENT_CLI_CLAUDE_CODE = 'claude-code' as const;

export const DEFAULT_AGENT_COMMAND = 'claude';
export const CLI_FLAG_BYPASS_PERMISSIONS = '--dangerously-skip-permissions';
export const CLI_FLAG_APPEND_SYSTEM_PROMPT = '--append-system-prompt';

export const DEFAULT_CONTEXT_WINDOW = 1_000_000;
