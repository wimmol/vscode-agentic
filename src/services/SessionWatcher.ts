import { open, readdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import type { StateStorage } from '../db';
import { claudeProjectDir } from './TerminalService';
import { AGENT_STATUS_IDLE, AGENT_STATUS_RUNNING } from '../constants/agent';
import { UUID_RE } from '../constants/paths';
import { SESSION_WATCH_POLL_MS, SESSION_DIR_POLL_MS } from '../constants/timing';

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
  /** Set when stopWatching is called to prevent in-flight reads from writing stale data. */
  cancelled: boolean;
  sessionId: string;
  cwd: string;
  dir: string;
  filePath: string;
  dirTimer: NodeJS.Timeout;
  /** Files present when watching started. Null until snapshot completes. */
  knownFiles: Set<string> | null;
  /** Last observed directory mtime to skip readdir when unchanged. */
  lastDirMtime: number;
}

/**
 * Watches Claude session JSONL files to extract last prompt and task timing.
 *
 * Monitors session files for new entries. When a user message is detected,
 * updates the agent's lastPrompt and startedAt. When an assistant end_turn
 * is detected, sets completedAt.
 *
 * Also monitors the session directory for new session files. This handles
 * /clear (which creates a new session) and manual Claude Code relaunches
 * in the same terminal — the watcher automatically switches to the new
 * session file and updates the agent's sessionId.
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

  /** Session IDs currently being watched, for cross-agent deduplication. */
  private readonly trackedSessionIds = new Set<string>();

  constructor(private readonly storage: StateStorage) {}

  /**
   * Atomically claim a session ID if not already tracked.
   * Returns true if newly claimed, false if already taken by another agent.
   */
  claimSession = (sessionId: string): boolean => {
    if (this.trackedSessionIds.has(sessionId)) return false;
    this.trackedSessionIds.add(sessionId);
    return true;
  };

  /** Release a previously claimed session ID. */
  releaseSession = (sessionId: string): void => {
    this.trackedSessionIds.delete(sessionId);
  };

  /**
   * Start watching a session file for an agent.
   * Reads any existing content first, then polls for changes.
   * Also monitors the directory for new session files (handles /clear).
   */
  startWatching = (agentId: string, sessionId: string, cwd: string): void => {
    this.stopWatching(agentId);

    const dir = claudeProjectDir(cwd);
    const filePath = join(dir, `${sessionId}.jsonl`);
    console.log('[SessionWatcher] startWatching:', { agentId, filePath });

    this.trackedSessionIds.add(sessionId);

    const entry: WatcherEntry = {
      offset: 0,
      reading: false,
      cancelled: false,
      sessionId,
      cwd,
      dir,
      filePath,
      knownFiles: null,
      lastDirMtime: 0,
      timer: setInterval(() => {
        this.readNewContent(agentId, entry);
      }, SESSION_WATCH_POLL_MS),
      dirTimer: setInterval(() => {
        this.pollForNewSession(agentId, entry);
      }, SESSION_DIR_POLL_MS),
    };
    this.watchers.set(agentId, entry);

    // Snapshot existing .jsonl files so we can detect new ones later.
    readdir(dir)
      .then((files) => {
        entry.knownFiles = new Set(files.filter((f) => f.endsWith('.jsonl')));
      })
      .catch(() => {
        entry.knownFiles = new Set();
      });

    // Read existing content immediately to populate initial state.
    this.readNewContent(agentId, entry);
  };

  /** Stop watching a session file for an agent. */
  stopWatching = (agentId: string): void => {
    const entry = this.watchers.get(agentId);
    if (entry) {
      entry.cancelled = true;
      clearInterval(entry.timer);
      clearInterval(entry.dirTimer);
      this.trackedSessionIds.delete(entry.sessionId);
      this.watchers.delete(agentId);
    }
  };

  /** Stop all watchers. */
  dispose = (): void => {
    for (const entry of this.watchers.values()) {
      entry.cancelled = true;
      clearInterval(entry.timer);
      clearInterval(entry.dirTimer);
    }
    this.watchers.clear();
    this.trackedSessionIds.clear();
  };

  // ── Private ───────────────────────────────────────────────────────

  /**
   * Poll the session directory for new .jsonl files.
   * When a new file appears that isn't tracked by any agent, switch to it.
   * This handles /clear (new session) and manual Claude Code relaunches.
   */
  private pollForNewSession = async (agentId: string, entry: WatcherEntry): Promise<void> => {
    // Wait until the initial snapshot is ready.
    if (!entry.knownFiles || entry.cancelled) return;

    try {
      // Skip readdir when directory hasn't changed (mtime unchanged).
      const dirInfo = await stat(entry.dir);
      if (dirInfo.mtimeMs <= entry.lastDirMtime) return;
      entry.lastDirMtime = dirInfo.mtimeMs;

      if (entry.cancelled) return;

      const files = await readdir(entry.dir);

      let newSessionId: string | null = null;

      for (const f of files) {
        if (!f.endsWith('.jsonl') || entry.knownFiles.has(f)) continue;

        // Remember this file so we don't re-evaluate it every poll.
        entry.knownFiles.add(f);

        const id = basename(f, '.jsonl');
        if (!UUID_RE.test(id) || this.trackedSessionIds.has(id)) continue;

        newSessionId = id;
      }

      if (!newSessionId || entry.cancelled) return;

      console.log('[SessionWatcher] new session detected:', {
        agentId,
        oldSession: entry.sessionId,
        newSession: newSessionId,
      });

      // Reset agent to idle with the new session ID.
      // The old session's status is stale — the new session starts fresh.
      try {
        await this.storage.updateAgent(agentId, {
          sessionId: newSessionId,
          status: AGENT_STATUS_IDLE,
          lastPrompt: null,
          startedAt: null,
          completedAt: null,
        });
      } catch {
        // Agent may have been removed.
        return;
      }

      // Guard: agent may have been removed/stopped during the await above.
      if (entry.cancelled) return;

      // Restart watching with the new session (re-snapshots the directory).
      this.startWatching(agentId, newSessionId, entry.cwd);
    } catch {
      // Directory may not exist — not fatal.
    }
  };

  /** Read new content from the file starting at the tracked offset. */
  private readNewContent = async (agentId: string, entry: WatcherEntry): Promise<void> => {
    if (entry.reading) return;
    entry.reading = true;

    let fd;
    try {
      const fileInfo = await stat(entry.filePath);
      if (fileInfo.size <= entry.offset) return;

      fd = await open(entry.filePath, 'r');
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

      // Guard against stale writes: if this entry was cancelled while we
      // were awaiting I/O, skip the storage update to avoid overwriting
      // data from the new session.
      if (entry.cancelled) return;

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
