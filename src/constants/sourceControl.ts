// Webview → Extension commands
export const SC_CMD_COMMIT = 'sc.commit';
export const SC_CMD_PUSH = 'sc.push';
export const SC_CMD_PULL = 'sc.pull';
export const SC_CMD_SUGGEST = 'sc.suggest';
export const SC_CMD_OPEN_DIFF = 'sc.openDiff';
export const SC_CMD_READY = 'sc.ready';

// Extension → Webview message types
export const SC_MSG_UPDATE = 'sc.update';
export const SC_MSG_SUGGEST_RESULT = 'sc.suggestResult';

// Git operation timeouts (ms)
export const GIT_STATUS_TIMEOUT_MS = 10_000;
export const GIT_COMMIT_TIMEOUT_MS = 30_000;
export const GIT_PUSH_TIMEOUT_MS = 120_000;
export const GIT_PULL_TIMEOUT_MS = 120_000;
