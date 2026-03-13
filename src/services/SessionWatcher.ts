import { open, stat } from 'fs/promises';
import { join } from 'path';
import type { StateStorage } from '../db';
import { claudeProjectDir } from './TerminalService';
import { AGENT_STATUS_IDLE, AGENT_STATUS_RUNNING } from '../constants/agent';
import { SESSION_WATCH_POLL_MS } from '../constants/timing';

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
  offset: number;
  timer: NodeJS.Timeout;
  reading: boolean;
}

/**
 * Watches Claude session JSONL files to extract last prompt and task timing.
 *
 * Monitors session files for new entries. When a user message is detected,
 * updates the agent's lastPrompt and startedAt. When an assistant end_turn
 * is detected, sets completedAt.
 *
 * Uses interval-based polling instead of fs.watch because fs.watch (kqueue)
 * on macOS unreliably detects file appends, causing agent status to stay
 * stuck on "running".
 *
 * Exists as a class because it owns per-agent watcher state and timers
 * that share a lifetime.
 */
export class SessionWatcher {
  private readonly watchers = new Map<string, WatcherEntry>();

  constructor(private readonly storage: StateStorage) {}

  /**
   * Start watching a session file for an agent.
   * Reads any existing content first, then polls for changes.
   */
  startWatching = (agentId: string, sessionId: string, cwd: string): void => {
    this.stopWatching(agentId);

    const dir = claudeProjectDir(cwd);
    const filePath = join(dir, `${sessionId}.jsonl`);
    console.log('[SessionWatcher] startWatching:', { agentId, filePath });
    const entry: WatcherEntry = {
      offset: 0,
      reading: false,
      timer: setInterval(() => {
        this.readNewContent(agentId, filePath, entry);
      }, SESSION_WATCH_POLL_MS),
    };
    this.watchers.set(agentId, entry);

    // Read existing content immediately to populate initial state.
    this.readNewContent(agentId, filePath, entry);
  };

  /** Stop watching a session file for an agent. */
  stopWatching = (agentId: string): void => {
    const entry = this.watchers.get(agentId);
    if (entry) {
      clearInterval(entry.timer);
      this.watchers.delete(agentId);
    }
  };

  /** Stop all watchers. */
  dispose = (): void => {
    for (const entry of this.watchers.values()) {
      clearInterval(entry.timer);
    }
    this.watchers.clear();
  };

  // ── Private ───────────────────────────────────────────────────────

  /** Read new content from the file starting at the tracked offset. */
  private readNewContent = async (
    agentId: string,
    filePath: string,
    entry: WatcherEntry,
  ): Promise<void> => {
    if (entry.reading) return;
    entry.reading = true;

    let fd;
    try {
      const fileInfo = await stat(filePath);
      if (fileInfo.size <= entry.offset) return;

      fd = await open(filePath, 'r');
      const buf = Buffer.alloc(fileInfo.size - entry.offset);
      await fd.read(buf, 0, buf.length, entry.offset);

      const newContent = buf.toString('utf-8');

      // Only process complete lines (up to last newline).
      // A partial trailing line is re-read on the next poll to avoid
      // permanently missing an entry if the file was mid-write.
      const lastNewline = newContent.lastIndexOf('\n');
      if (lastNewline === -1) return;

      entry.offset += lastNewline + 1;
      const lines = newContent.slice(0, lastNewline + 1).split('\n').filter((l) => l.trim());
      console.log('[SessionWatcher] read', lines.length, 'lines for', agentId);

      await this.processLines(agentId, lines);
    } catch {
      // File read errors are non-fatal.
    } finally {
      await fd?.close();
      entry.reading = false;
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
      const status = endTurnTimestamp ? AGENT_STATUS_IDLE : AGENT_STATUS_RUNNING;
      console.log('[SessionWatcher] status →', status, '| prompt:', lastPrompt?.slice(0, 40), '| agentId:', agentId);
      try {
        await this.storage.updateAgent(agentId, {
          lastPrompt,
          startedAt: promptTimestamp,
          completedAt: endTurnTimestamp,
          status,
        });
      } catch {
        // Agent may have been removed.
      }
    } else if (endTurnTimestamp !== null) {
      console.log('[SessionWatcher] status → idle (end_turn only) | agentId:', agentId);
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
