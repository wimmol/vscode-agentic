// Webview → Extension message function names
export const CMD_TOGGLE_REPO_EXPANDED = 'toggleRepoExpanded';
export const CMD_ADD_REPO = 'addRepo';
export const CMD_REMOVE_REPO = 'removeRepo';
export const CMD_ROOT_CLICK = 'rootClick';
export const CMD_REPO_ROOT_CLICK = 'repoRootClick';
export const CMD_ADD_AGENT = 'addAgent';
export const CMD_REMOVE_AGENT = 'removeAgent';
export const CMD_AGENT_CLICK = 'agentClick';
export const CMD_TOGGLE_ZONE_EXPANDED = 'toggleZoneExpanded';
export const CMD_CLOSE_WORKTREE = 'closeWorktree';
export const CMD_SEND_PROMPT = 'sendPrompt';
export const CMD_FORK_AGENT = 'forkAgent';
export const CMD_RENAME_AGENT = 'renameAgent';
export const CMD_REMOVE_QUEUE_ITEM = 'removeQueueItem';
export const CMD_READY = 'ready';

// Extension → Webview message types
export const MSG_TYPE_UPDATE = 'update';

/**
 * Protocol version for extension ↔ webview message envelopes. Bump this
 * whenever a breaking change to message shapes ships, so the receiving side
 * can detect a mismatched cached webview state and recover.
 */
export const PROTOCOL_VERSION = 1;
