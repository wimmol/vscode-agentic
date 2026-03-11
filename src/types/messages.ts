import type { RepoWithAgents } from './index';

// ── Extension → Webview ───────────────────────────────────────────

export interface StateUpdateMessage {
  type: 'update';
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
  function: 'toggleRepoExpanded',
  args: { repoId },
});

export const addRepoMessage = (): WebviewToExtensionMessage => ({
  function: 'addRepo',
  args: {},
});

export const removeRepoMessage = (repoId: string): WebviewToExtensionMessage => ({
  function: 'removeRepo',
  args: { repoId },
});

export const rootClickMessage = (): WebviewToExtensionMessage => ({
  function: 'rootClick',
  args: {},
});

export const repoRootClickMessage = (repoId: string): WebviewToExtensionMessage => ({
  function: 'repoRootClick',
  args: { repoId },
});
