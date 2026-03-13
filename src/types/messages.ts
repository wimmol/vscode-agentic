import type { RepoWithAgents } from './index';
import {
  MSG_TYPE_UPDATE,
  CMD_TOGGLE_REPO_EXPANDED,
  CMD_ADD_REPO,
  CMD_REMOVE_REPO,
  CMD_ROOT_CLICK,
  CMD_REPO_ROOT_CLICK,
  CMD_ADD_AGENT,
  CMD_REMOVE_AGENT,
  CMD_AGENT_CLICK,
} from '../constants/commands';

// ── Extension → Webview ───────────────────────────────────────────

export interface StateUpdateMessage {
  type: typeof MSG_TYPE_UPDATE;
  repos: RepoWithAgents[];
}

export type ExtensionToWebviewMessage = StateUpdateMessage;

// ── Webview → Extension ───────────────────────────────────────────

export interface WebviewToExtensionMessage {
  function: string;
  args: any;
}

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
