import type { RepoWithZones } from './index';
import {
  MSG_TYPE_UPDATE,
  PROTOCOL_VERSION,
  CMD_READY,
  CMD_TOGGLE_REPO_EXPANDED,
  CMD_ADD_REPO,
  CMD_REMOVE_REPO,
  CMD_ROOT_CLICK,
  CMD_REPO_ROOT_CLICK,
  CMD_ADD_AGENT,
  CMD_REMOVE_AGENT,
  CMD_AGENT_CLICK,
  CMD_TOGGLE_ZONE_EXPANDED,
  CMD_CLOSE_WORKTREE,
  CMD_SEND_PROMPT,
  CMD_FORK_AGENT,
  CMD_RENAME_AGENT,
  CMD_REMOVE_QUEUE_ITEM,
} from '../constants/commands';

// ── Extension → Webview ───────────────────────────────────────────

export interface StateUpdateMessage {
  type: typeof MSG_TYPE_UPDATE;
  /** Protocol version of the message envelope. Receiver compares to its own constant. */
  protocol: typeof PROTOCOL_VERSION;
  repos: RepoWithZones[];
}

export type ExtensionToWebviewMessage = StateUpdateMessage;

// ── Webview → Extension ───────────────────────────────────────────

interface MessageBase<F extends string, A> {
  function: F;
  args: A;
}

export type WebviewToExtensionMessage =
  | MessageBase<typeof CMD_READY, Record<string, never>>
  | MessageBase<typeof CMD_TOGGLE_REPO_EXPANDED, { repoId: string }>
  | MessageBase<typeof CMD_ADD_REPO, Record<string, never>>
  | MessageBase<typeof CMD_REMOVE_REPO, { repoId: string }>
  | MessageBase<typeof CMD_ROOT_CLICK, Record<string, never>>
  | MessageBase<typeof CMD_REPO_ROOT_CLICK, { repoId: string }>
  | MessageBase<typeof CMD_ADD_AGENT, { repoId: string }>
  | MessageBase<typeof CMD_REMOVE_AGENT, { agentId: string }>
  | MessageBase<typeof CMD_AGENT_CLICK, { agentId: string }>
  | MessageBase<typeof CMD_TOGGLE_ZONE_EXPANDED, { repoId: string; branch: string }>
  | MessageBase<typeof CMD_CLOSE_WORKTREE, { repoId: string; branch: string }>
  | MessageBase<typeof CMD_SEND_PROMPT, { agentId: string }>
  | MessageBase<typeof CMD_FORK_AGENT, { agentId: string }>
  | MessageBase<typeof CMD_RENAME_AGENT, { agentId: string }>
  | MessageBase<typeof CMD_REMOVE_QUEUE_ITEM, { agentId: string; index: number }>;

// ── Message creators ─────────────────────────────────────────────

export const toggleRepoExpandedMessage = (repoId: string): WebviewToExtensionMessage => ({
  function: CMD_TOGGLE_REPO_EXPANDED,
  args: { repoId },
});

export const addRepoMessage = (): WebviewToExtensionMessage => ({
  function: CMD_ADD_REPO,
  args: {},
});

export const removeRepoMessage = (repoId: string): WebviewToExtensionMessage => ({
  function: CMD_REMOVE_REPO,
  args: { repoId },
});

export const rootClickMessage = (): WebviewToExtensionMessage => ({
  function: CMD_ROOT_CLICK,
  args: {},
});

export const repoRootClickMessage = (repoId: string): WebviewToExtensionMessage => ({
  function: CMD_REPO_ROOT_CLICK,
  args: { repoId },
});

export const addAgentMessage = (repoId: string): WebviewToExtensionMessage => ({
  function: CMD_ADD_AGENT,
  args: { repoId },
});

export const removeAgentMessage = (agentId: string): WebviewToExtensionMessage => ({
  function: CMD_REMOVE_AGENT,
  args: { agentId },
});

export const agentClickMessage = (agentId: string): WebviewToExtensionMessage => ({
  function: CMD_AGENT_CLICK,
  args: { agentId },
});

export const toggleZoneExpandedMessage = (repoId: string, branch: string): WebviewToExtensionMessage => ({
  function: CMD_TOGGLE_ZONE_EXPANDED,
  args: { repoId, branch },
});

export const closeWorktreeMessage = (repoId: string, branch: string): WebviewToExtensionMessage => ({
  function: CMD_CLOSE_WORKTREE,
  args: { repoId, branch },
});

export const sendPromptMessage = (agentId: string): WebviewToExtensionMessage => ({
  function: CMD_SEND_PROMPT,
  args: { agentId },
});

export const forkAgentMessage = (agentId: string): WebviewToExtensionMessage => ({
  function: CMD_FORK_AGENT,
  args: { agentId },
});

export const renameAgentMessage = (agentId: string): WebviewToExtensionMessage => ({
  function: CMD_RENAME_AGENT,
  args: { agentId },
});

export const removeQueueItemMessage = (agentId: string, index: number): WebviewToExtensionMessage => ({
  function: CMD_REMOVE_QUEUE_ITEM,
  args: { agentId, index },
});
