import type { RepoWithAgents } from './index';

// ── Extension → Webview ───────────────────────────────────────────

export interface StateUpdateMessage {
  type: 'update';
  repos: RepoWithAgents[];
}

export type ExtensionToWebviewMessage = StateUpdateMessage;

// ── Webview → Extension ───────────────────────────────────────────

export interface ToggleRepoExpandedMessage {
  type: 'command';
  command: 'toggleRepoExpanded';
  data: { repoId: string };
}

export type WebviewToExtensionMessage = ToggleRepoExpandedMessage;

// ── Message creators (shared between UI and extension) ───────────

export const createToggleRepoExpanded = (repoId: string): ToggleRepoExpandedMessage => ({
  type: 'command',
  command: 'toggleRepoExpanded',
  data: { repoId },
});
