import type {
  SC_MSG_UPDATE,
  SC_MSG_SUGGEST_RESULT,
} from '../constants/sourceControl';

// ── Data ────────────────────────────────────────────────────────

export interface FileChange {
  /** Two-character porcelain XY (e.g. "MM", " M", "M ", "A ", "??", "R "). */
  status: string;
  /** Destination path, relative to repo root. */
  path: string;
  /** For renames/copies, the original path. */
  fromPath?: string;
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
