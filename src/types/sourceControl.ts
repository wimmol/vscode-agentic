import type {
  SC_MSG_UPDATE,
  SC_MSG_SUGGEST_RESULT,
} from '../constants/sourceControl';

// ── Data ────────────────────────────────────────────────────────

export interface FileChange {
  status: string;   // M, A, D, ?, R, etc.
  path: string;     // relative to repo root
  absPath: string;  // absolute path for opening diff
}

// ── Extension → Webview ─────────────────────────────────────────

export interface ScStateUpdateMessage {
  type: typeof SC_MSG_UPDATE;
  changes: FileChange[];
  repoName: string;
  isLoading: boolean;
}

export interface ScSuggestResultMessage {
  type: typeof SC_MSG_SUGGEST_RESULT;
  message: string;
}

export type ScExtensionToWebviewMessage = ScStateUpdateMessage | ScSuggestResultMessage;

// ── Webview → Extension ─────────────────────────────────────────

export interface ScWebviewToExtensionMessage {
  function: string;
  args: Record<string, unknown>;
}
