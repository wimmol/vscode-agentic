import * as vscode from 'vscode';
import { open, readdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import type { StateStorage } from '../db';
import { claudeProjectDir } from './TerminalService';
import { logger } from './Logger';
import { AGENT_STATUS_IDLE, AGENT_STATUS_RUNNING, DEFAULT_CONTEXT_WINDOW } from '../constants/agent';
import type { ContextUsage } from '../types/agent';
import { notifAgentFinished } from '../constants/messages';
import { UUID_RE } from '../constants/paths';
import {
  SESSION_WATCH_POLL_MS,
  SESSION_DIR_POLL_MS,
  STALE_RUNNING_TIMEOUT_MS,
  SESSION_ACTIVE_THRESHOLD_MS,
  QUEUE_DRAIN_DELAY_MS,
} from '../constants/timing';

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
  /** Timestamp when watching started — used to compute stale-timeout duration. */
  startedAt: number;
  /** Timestamp of last time new JSONL content was read. Used for staleness detection. */
  lastNewContentAt: number;
  /** Whether the most recent processLines call set the agent to RUNNING. */
  isRunning: boolean;
  /** True when the last assistant message was stop_reason=tool_use — a tool is executing and more content is expected. */
  awaitingToolResult: boolean;
  /** Unclaimed session ID from a previous poll, awaiting re-evaluation. */
  pendingCandidate: string | null;
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

  constructor(
    private readonly storage: StateStorage,
    private readonly onQueueDrain?: (agentId: string, prompt: string) => void,
    /** Optional — when present, long prompts / outputs are summarised into
     *  the agent's `lastPromptShort` / `outputShort` fields. */
    private readonly summariser?: {
      schedule: (agentId: string, kind: 'prompt' | 'output', text: string | null) => void;
      cancel: (agentId: string) => void;
    },
  ) {}

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
   *
   * @param initialRunning — Set to true when the stored agent status is RUNNING.
   *   This seeds `entry.isRunning` so stale detection can transition the agent
   *   to IDLE even if the session file is empty/missing (e.g., after extension reload).
   */
  startWatching = (agentId: string, sessionId: string, cwd: string, initialRunning = false): void => {
    this.stopWatching(agentId);

    const dir = claudeProjectDir(cwd);
    const filePath = join(dir, `${sessionId}.jsonl`);
    logger.trace('SessionWatcher.startWatching', { agentId, filePath });

    this.trackedSessionIds.add(sessionId);

    const now = Date.now();
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
      startedAt: now,
      lastNewContentAt: now,
      isRunning: initialRunning,
      awaitingToolResult: false,
      pendingCandidate: null,
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
      .catch((err) => {
        logger.warn('SessionWatcher initial readdir failed', String(err));
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
    this.summariser?.cancel(agentId);
  };

  /** Send VS Code notification when agent finishes. */
  private notifyCompletion = async (agentId: string, durationMs: number): Promise<void> => {
    try {
      const ctx = await this.storage.getAgentContext(agentId);
      if (!ctx) return;
      const seconds = Math.round(durationMs / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      vscode.window.showInformationMessage(notifAgentFinished(ctx.agent.name, ctx.repo.name, duration));

      // Auto-drain queue
      await this.drainQueue(agentId);
    } catch (err) {
      logger.trace('notifyCompletion failed (non-fatal)', { agentId, err: String(err) });
    }
  };

  /** Check and execute next queued prompt for an agent. */
  private drainQueue = async (agentId: string): Promise<void> => {
    const next = await this.storage.shiftFromQueue(agentId);
    if (!next) return;

    await new Promise((resolve) => setTimeout(resolve, QUEUE_DRAIN_DELAY_MS));

    this.onQueueDrain?.(agentId, next);
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
   *
   * When multiple agents share the same directory, uses a heuristic to
   * determine which agent should claim the new file: the agent whose session
   * was most recently active (but is no longer) is the most likely creator
   * of the new session (e.g., the one that typed /clear).
   */
  private pollForNewSession = async (agentId: string, entry: WatcherEntry): Promise<void> => {
    if (!entry.knownFiles || entry.cancelled) return;

    // Re-evaluate a pending candidate from a previous poll cheaply (no readdir).
    if (entry.pendingCandidate) {
      if (this.trackedSessionIds.has(entry.pendingCandidate)) {
        // Another agent claimed it.
        entry.knownFiles.add(`${entry.pendingCandidate}.jsonl`);
        entry.pendingCandidate = null;
      } else if (this.shouldClaimNewSession(agentId, entry.dir)) {
        const id = entry.pendingCandidate;
        entry.pendingCandidate = null;
        await this.adoptNewSession(agentId, id, entry);
      }
      return;
    }

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

        const id = basename(f, '.jsonl');

        if (!UUID_RE.test(id) || this.trackedSessionIds.has(id)) {
          entry.knownFiles.add(f);
          continue;
        }

        newSessionId = id;
      }

      if (!newSessionId || entry.cancelled) return;

      // When multiple agents share this directory, only the best candidate
      // should claim. Losers store the candidate for cheap re-evaluation
      // on subsequent polls (no readdir needed).
      if (!this.shouldClaimNewSession(agentId, entry.dir)) {
        entry.pendingCandidate = newSessionId;
        return;
      }

      entry.knownFiles.add(`${newSessionId}.jsonl`);
      await this.adoptNewSession(agentId, newSessionId, entry);
    } catch (err) {
      logger.trace('pollForNewSession failed (non-fatal)', { agentId, err: String(err) });
    }
  };

  /** Adopt a new session file: update the agent record and restart the watcher. */
  private adoptNewSession = async (agentId: string, sessionId: string, entry: WatcherEntry): Promise<void> => {
    logger.info('SessionWatcher new session detected', {
      agentId,
      oldSession: entry.sessionId,
      newSession: sessionId,
    });

    try {
      await this.storage.updateAgent(agentId, {
        sessionId,
        status: AGENT_STATUS_IDLE,
        lastPrompt: null,
        startedAt: null,
        completedAt: null,
      });
    } catch (err) {
      logger.trace('adoptNewSession updateAgent failed (likely removed)', { agentId, err: String(err) });
      return;
    }

    if (entry.cancelled) return;

    this.startWatching(agentId, sessionId, entry.cwd);
  };

  /**
   * When multiple agents share the same Claude project directory, determine
   * whether this agent should claim a newly discovered session file.
   *
   * Heuristic: among agents on the same directory that are NOT currently
   * receiving content, the one most recently active gets priority — it's
   * the most likely to have triggered the new session (e.g., via /clear).
   */
  private shouldClaimNewSession = (agentId: string, dir: string): boolean => {
    const now = Date.now();
    let peerCount = 0;
    let bestId: string | null = null;
    let latestContentAt = -1;

    for (const [id, e] of this.watchers) {
      if (e.dir !== dir || e.cancelled) continue;
      peerCount++;
      // Skip agents still actively receiving content.
      if (now - e.lastNewContentAt < SESSION_ACTIVE_THRESHOLD_MS) continue;
      if (e.lastNewContentAt > latestContentAt) {
        latestContentAt = e.lastNewContentAt;
        bestId = id;
      }
    }

    // Single agent on this directory — always claim.
    if (peerCount <= 1) return true;
    // All peers still active — defer to the next poll.
    if (bestId === null) return false;
    return bestId === agentId;
  };

  /** Read new content from the file starting at the tracked offset. */
  private readNewContent = async (agentId: string, entry: WatcherEntry): Promise<void> => {
    if (entry.reading) return;
    entry.reading = true;

    let fd;
    try {
      let fileSize: number;
      try {
        fileSize = (await stat(entry.filePath)).size;
      } catch {
        // File doesn't exist yet — check staleness anyway.
        this.transitionIfStale(agentId, entry);
        return;
      }

      if (fileSize <= entry.offset) {
        // No new content — check for stale running state.
        this.transitionIfStale(agentId, entry);
        return;
      }

      entry.lastNewContentAt = Date.now();

      fd = await open(entry.filePath, 'r');
      const buf = Buffer.alloc(fileSize - entry.offset);
      await fd.read(buf, 0, buf.length, entry.offset);

      const newContent = buf.toString('utf-8');

      // Only process complete lines (up to last newline).
      // A partial trailing line is re-read on the next poll to avoid
      // permanently missing an entry if the file was mid-write.
      const lastNewline = newContent.lastIndexOf('\n');
      if (lastNewline === -1) return;

      entry.offset += lastNewline + 1;
      const lines = newContent.slice(0, lastNewline + 1).split('\n').filter((l) => l.trim());
      logger.trace('SessionWatcher read lines', { count: lines.length, agentId });

      // Guard against stale writes: if this entry was cancelled while we
      // were awaiting I/O, skip the storage update to avoid overwriting
      // data from the new session.
      if (entry.cancelled) return;

      await this.processLines(agentId, lines, entry);
    } catch (err) {
      logger.trace('readNewContent failed (non-fatal)', { agentId, err: String(err) });
    } finally {
      await fd?.close();
      entry.reading = false;
    }
  };

  /**
   * If the agent has been RUNNING with no new JSONL content for longer than
   * STALE_RUNNING_TIMEOUT_MS, transition to IDLE. Handles local/slash commands
   * that don't produce an assistant end_turn in the session file.
   */
  private transitionIfStale = (agentId: string, entry: WatcherEntry): void => {
    if (!entry.isRunning || entry.cancelled) return;
    // Don't timeout while a tool is executing — more content is expected when it finishes.
    if (entry.awaitingToolResult) return;
    if (Date.now() - entry.lastNewContentAt < STALE_RUNNING_TIMEOUT_MS) return;

    entry.isRunning = false;
    const completedAt = Date.now();
    const approxDuration = Math.max(0, completedAt - entry.startedAt);
    logger.trace('stale running → idle', { agentId, approxDurationMs: approxDuration });
    this.storage.updateAgent(agentId, {
      status: AGENT_STATUS_IDLE,
      completedAt,
    }).then(() => this.notifyCompletion(agentId, approxDuration))
      .catch((err) => {
        logger.trace('updateAgent after stale detection failed (likely removed)', String(err));
      });
  };

  /** Parse JSONL lines and update agent state. Also updates entry.isRunning for staleness tracking. */
  private processLines = async (agentId: string, lines: string[], entry: WatcherEntry): Promise<void> => {
    let lastPrompt: string | null = null;
    let promptTimestamp: number | null = null;
    let endTurnTimestamp: number | null = null;
    let lastAssistantText: string | null = null;
    let lastContextUsage: ContextUsage | null = null;
    let hasAssistantActivity = false;
    let lastStopReason: string | null = null;

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);

        if (obj.type === 'user' && obj.message?.role === 'user') {
          const text = extractPromptText(obj.message.content);
          if (text) {
            lastPrompt = text;
            promptTimestamp = obj.timestamp ? new Date(obj.timestamp).getTime() : Date.now();
            endTurnTimestamp = null;
          }
        }

        if (obj.type === 'assistant') {
          hasAssistantActivity = true;
          lastStopReason = obj.message?.stop_reason ?? null;
          // Extract assistant summary text
          if (obj.message?.content) {
            const text = extractPromptText(obj.message.content);
            if (text) lastAssistantText = text;
          }
          // Extract context usage (sum all input token types — uncached + cache creation + cache read)
          if (obj.message?.usage && typeof obj.message.usage.input_tokens === 'number') {
            const u = obj.message.usage;
            const totalInput = (u.input_tokens || 0)
              + (u.cache_creation_input_tokens || 0)
              + (u.cache_read_input_tokens || 0);
            lastContextUsage = { used: totalInput, total: DEFAULT_CONTEXT_WINDOW };
          }
          if (obj.message?.stop_reason === 'end_turn') {
            endTurnTimestamp = obj.timestamp ? new Date(obj.timestamp).getTime() : Date.now();
          }
        }
      } catch (err) {
        logger.trace('malformed JSONL line skipped', { agentId, err: String(err) });
      }
    }

    if (hasAssistantActivity) {
      entry.awaitingToolResult = lastStopReason === 'tool_use';
    } else if (lastPrompt !== null) {
      // New user turn with no assistant response yet — clear stale tool expectation.
      entry.awaitingToolResult = false;
    }

    // Keep the full assistant text for the summariser; clip only the stored
    // `outputSummary` so the untruncated raw string can still be summarised.
    const fullAssistantText = lastAssistantText;
    if (lastAssistantText && lastAssistantText.length > 200) {
      lastAssistantText = lastAssistantText.slice(0, 200) + '…';
    }

    // Apply the latest state to the agent.
    if (lastPrompt !== null && promptTimestamp !== null) {
      const status = endTurnTimestamp ? AGENT_STATUS_IDLE : AGENT_STATUS_RUNNING;
      const wasRunning = entry.isRunning;
      entry.isRunning = status === AGENT_STATUS_RUNNING;

      const outputSummary = endTurnTimestamp ? lastAssistantText : undefined;

      logger.trace('SessionWatcher status update', { status, prompt: lastPrompt?.slice(0, 40), agentId });
      try {
        await this.storage.updateAgent(agentId, {
          lastPrompt,
          startedAt: promptTimestamp,
          completedAt: endTurnTimestamp,
          status,
          ...(outputSummary !== undefined && { outputSummary }),
          ...(lastContextUsage && { contextUsage: lastContextUsage }),
        });
        this.summariser?.schedule(agentId, 'prompt', lastPrompt);
        if (endTurnTimestamp) {
          this.summariser?.schedule(agentId, 'output', fullAssistantText ?? null);
        }

        // Notification on completion
        if (wasRunning && status === AGENT_STATUS_IDLE) {
          this.notifyCompletion(agentId, endTurnTimestamp! - promptTimestamp);
        }
      } catch (err) {
        logger.trace('updateAgent in processLines failed (likely removed)', { agentId, err: String(err) });
      }
    } else if (endTurnTimestamp !== null) {
      entry.isRunning = false;

      logger.trace('status → idle (end_turn only)', { agentId });
      try {
        await this.storage.updateAgent(agentId, {
          completedAt: endTurnTimestamp,
          status: AGENT_STATUS_IDLE,
          ...(lastAssistantText && { outputSummary: lastAssistantText }),
          ...(lastContextUsage && { contextUsage: lastContextUsage }),
        });
        this.summariser?.schedule(agentId, 'output', fullAssistantText ?? null);

        const approxDuration = Math.max(0, endTurnTimestamp - entry.startedAt);
        this.notifyCompletion(agentId, approxDuration);
      } catch (err) {
        logger.trace('updateAgent on end_turn failed (likely removed)', String(err));
      }
    } else if (hasAssistantActivity) {
      // Tool cycle activity (no new user text prompt, no end_turn).
      entry.isRunning = true;

      try {
        await this.storage.updateAgent(agentId, {
          status: AGENT_STATUS_RUNNING,
          ...(lastContextUsage && { contextUsage: lastContextUsage }),
        });
      } catch (err) {
        logger.trace('updateAgent (running) failed (likely removed)', { agentId, err: String(err) });
      }
    } else if (lastContextUsage) {
      // Update context usage even when no status change
      try {
        await this.storage.updateAgent(agentId, { contextUsage: lastContextUsage });
      } catch (err) {
        logger.trace('updateAgent (context) failed (likely removed)', { agentId, err: String(err) });
      }
    }
  };
}
