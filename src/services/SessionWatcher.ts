import { open, watch, stat } from 'fs/promises';
import { join } from 'path';
import type { StateStorage } from '../db';
import { claudeProjectDir } from './TerminalService';
import { AGENT_STATUS_IDLE, AGENT_STATUS_RUNNING } from '../constants/agent';

/**
 * Extract the user prompt text from a JSONL user message content field.
 * Content can be a string or an array of content blocks.
 */
const extractPromptText = (content: unknown): string | null => {
  if (typeof content === 'string') {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    for (const block of content) {
      if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        return block.text.trim();
      }
    }
  }

  return null;
};

interface WatcherEntry {
  abort: AbortController;
  offset: number;
}

/**
 * Watches Claude session JSONL files to extract last prompt and task timing.
 *
 * Monitors session files for new entries. When a user message is detected,
 * updates the agent's lastPrompt and startedAt. When an assistant end_turn
 * is detected, sets completedAt.
 *
 * Exists as a class because it owns per-agent watcher state and abort
 * controllers that share a lifetime.
 */
export class SessionWatcher {
  private readonly watchers = new Map<string, WatcherEntry>();

  constructor(private readonly storage: StateStorage) {}

  /**
   * Start watching a session file for an agent.
   * Reads any existing content first, then watches for changes.
   */
  startWatching = (agentId: string, sessionId: string, cwd: string): void => {
    this.stopWatching(agentId);

    const dir = claudeProjectDir(cwd);
    const filePath = join(dir, `${sessionId}.jsonl`);
    const abort = new AbortController();
    const entry: WatcherEntry = { abort, offset: 0 };
    this.watchers.set(agentId, entry);

    // Read existing content to populate initial state, then start watching.
    this.readNewContent(agentId, filePath, entry)
      .then(() => this.watchFile(agentId, filePath, entry, abort.signal))
      .catch(() => {
        // File may not exist yet — try watching anyway.
        this.watchFile(agentId, filePath, entry, abort.signal);
      });
  };

  /** Stop watching a session file for an agent. */
  stopWatching = (agentId: string): void => {
    const entry = this.watchers.get(agentId);
    if (entry) {
      entry.abort.abort();
      this.watchers.delete(agentId);
    }
  };

  /** Stop all watchers. */
  dispose = (): void => {
    for (const entry of this.watchers.values()) {
      entry.abort.abort();
    }
    this.watchers.clear();
  };

  // ── Private ───────────────────────────────────────────────────────

  /** Watch the file for changes using fs.watch. */
  private watchFile = async (
    agentId: string,
    filePath: string,
    entry: WatcherEntry,
    signal: AbortSignal,
  ): Promise<void> => {
    try {
      const watcher = watch(filePath, { signal });
      for await (const event of watcher) {
        if (event.eventType === 'change') {
          await this.readNewContent(agentId, filePath, entry);
        }
      }
    } catch (err: unknown) {
      // AbortError is expected when we stop watching.
      if (err instanceof Error && err.name === 'AbortError') return;
      // File may not exist — silently ignore.
    }
  };

  /** Read new content from the file starting at the tracked offset. */
  private readNewContent = async (
    agentId: string,
    filePath: string,
    entry: WatcherEntry,
  ): Promise<void> => {
    let fd;
    try {
      const fileInfo = await stat(filePath);
      if (fileInfo.size <= entry.offset) return;

      fd = await open(filePath, 'r');
      const buf = Buffer.alloc(fileInfo.size - entry.offset);
      await fd.read(buf, 0, buf.length, entry.offset);
      entry.offset = fileInfo.size;

      const newContent = buf.toString('utf-8');
      const lines = newContent.split('\n').filter((l) => l.trim());

      await this.processLines(agentId, lines);
    } catch {
      // File read errors are non-fatal.
    } finally {
      await fd?.close();
    }
  };

  /** Parse JSONL lines and update agent state. */
  private processLines = async (agentId: string, lines: string[]): Promise<void> => {
    let lastPrompt: string | null = null;
    let promptTimestamp: number | null = null;
    let endTurnTimestamp: number | null = null;

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);

        if (obj.type === 'user' && obj.message?.role === 'user') {
          const text = extractPromptText(obj.message.content);
          if (text) {
            lastPrompt = text;
            promptTimestamp = obj.timestamp ? new Date(obj.timestamp).getTime() : Date.now();
            // New prompt clears previous completion.
            endTurnTimestamp = null;
          }
        }

        if (obj.type === 'assistant' && obj.message?.stop_reason === 'end_turn') {
          endTurnTimestamp = obj.timestamp ? new Date(obj.timestamp).getTime() : Date.now();
        }
      } catch {
        // Skip malformed lines.
      }
    }

    // Apply the latest state to the agent.
    if (lastPrompt !== null && promptTimestamp !== null) {
      try {
        await this.storage.updateAgent(agentId, {
          lastPrompt,
          startedAt: promptTimestamp,
          completedAt: endTurnTimestamp,
          status: endTurnTimestamp ? AGENT_STATUS_IDLE : AGENT_STATUS_RUNNING,
        });
      } catch {
        // Agent may have been removed.
      }
    } else if (endTurnTimestamp !== null) {
      try {
        await this.storage.updateAgent(agentId, {
          completedAt: endTurnTimestamp,
          status: AGENT_STATUS_IDLE,
        });
      } catch {
        // Agent may have been removed.
      }
    }
  };
}
