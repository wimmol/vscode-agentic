import { readdir } from 'fs/promises';
import { basename, join } from 'path';
import { homedir } from 'os';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { Agent } from '../db/models';
import {
  terminalName,
  tmuxSessionName,
  AGENTIC_TERMINAL_NAME_RE,
  TERMINAL_MODE_DEFAULT,
  TERMINAL_MODE_TMUX,
  type TerminalMode,
} from '../constants/terminal';
import { CLAUDE_DIR, CLAUDE_PROJECTS_DIR, UUID_RE } from '../constants/paths';
import {
  AGENT_STATUS_ERROR,
  AGENT_STATUS_RUNNING,
  DEFAULT_AGENT_COMMAND,
  CLI_FLAG_BYPASS_PERMISSIONS,
  CLI_FLAG_APPEND_SYSTEM_PROMPT,
  TMUX_TERMINAL_ENV,
} from '../constants/agent';
import {
  CONFIG_SECTION,
  CONFIG_BYPASS_PERMISSIONS,
  CONFIG_TERMINAL_MODE,
} from '../constants/views';
import {
  SESSION_POLL_INTERVAL_MS,
  SESSION_POLL_MAX_ATTEMPTS,
  SLOW_SESSION_POLL_INTERVAL_MS,
  HEALTH_CHECK_INTERVAL_MS,
} from '../constants/timing';
import {
  dialogTerminalClosed,
  DIALOG_UNCOMMITTED_TERMINAL,
  BTN_REMOVE,
  BTN_REMOVE_DELETE_WORKTREE,
  BTN_REMOVE_KEEP_WORKTREE,
  BTN_REOPEN_TERMINAL,
} from '../constants/messages';
import { removeWorktree, deleteBranch, hasUncommittedChanges } from './GitService';
import { SessionWatcher } from './SessionWatcher';
import { logger } from './Logger';
import * as tmux from './TmuxSession';

/**
 * Compute the Claude project directory for a given working directory.
 * Claude stores sessions at ~/.claude/projects/<encoded-path>/<sessionId>.jsonl
 * where the encoded path replaces `/` and `.` with `-`.
 */
export const claudeProjectDir = (cwd: string): string =>
  join(homedir(), CLAUDE_DIR, CLAUDE_PROJECTS_DIR, cwd.replace(/[/.]/g, '-'));

/**
 * Wrap a string for safe shell interpolation. Uses single quotes on
 * POSIX shells and double quotes with backtick-escaping on cmd.exe /
 * PowerShell. We don't know which shell VS Code will spawn, so default
 * to the platform's typical shell behavior.
 */
export const shellQuote = (s: string): string => {
  if (process.platform === 'win32') {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return `'${s.replace(/'/g, "'\\''")}'`;
};

/** Read the current terminal-mode setting for a given workspace scope. */
export const readTerminalMode = (cwd?: string): TerminalMode => {
  const scope = cwd ? vscode.Uri.file(cwd) : undefined;
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION, scope)
    .get<TerminalMode>(CONFIG_TERMINAL_MODE, TERMINAL_MODE_DEFAULT);
};

/**
 * Manages agent↔terminal mappings and lifecycle.
 *
 * Tracks which terminal belongs to which agent, listens for terminal
 * close events, and handles terminal restoration on startup.
 * Exists as a class because it owns the terminal tracking map and
 * the onDidCloseTerminal listener, both sharing a lifetime.
 */
export class TerminalService implements vscode.Disposable {
  /** agentId → Terminal */
  private readonly terminals = new Map<string, vscode.Terminal>();
  /** agentId → tmux session name. Mirrors `terminals` and is populated
   *  whenever a terminal is created or adopted. Used so close / kill /
   *  silent-re-attach paths don't need to refetch the agent from storage. */
  private readonly sessionNames = new Map<string, string>();
  private readonly disposables: vscode.Disposable[] = [];

  /** Active session-detection polling intervals, keyed by agentId. */
  private readonly detectors = new Map<string, NodeJS.Timeout>();

  /** Watches session JSONL files for prompt/timing data. */
  private readonly sessionWatcher: SessionWatcher;

  /**
   * agentIds currently being removed programmatically.
   * When closeTerminal is called, the id is added here so that the
   * onDidCloseTerminal handler (fired async by VS Code) skips the
   * user-facing dialog and just cleans up the map entry.
   */
  private readonly removing = new Set<string>();

  /** Periodic timer that verifies tracked terminals still exist. */
  private readonly healthTimer: NodeJS.Timeout;

  /** Set to true after restoreAll completes. Health checks are skipped until then. */
  private restored = false;

  constructor(
    private readonly storage: StateStorage,
    private readonly tmuxConfPath: string,
    summariser?: {
      schedule: (agentId: string, kind: 'prompt' | 'output', text: string | null) => void;
      cancel: (agentId: string) => void;
    },
  ) {
    this.sessionWatcher = new SessionWatcher(
      storage,
      (agentId, prompt) => {
        const terminal = this.terminals.get(agentId);
        if (terminal) {
          terminal.sendText(prompt, true);
          terminal.show(true);
          this.storage.updateAgent(agentId, { status: AGENT_STATUS_RUNNING }).catch(() => {});
        }
      },
      summariser,
    );
    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        this.onTerminalClosed(terminal).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('TerminalService onTerminalClosed', err);
          vscode.window.showErrorMessage(msg);
        });
      }),
    );

    this.healthTimer = setInterval(() => {
      this.checkTerminalHealth().catch((err) => {
        logger.error('TerminalService health check', err);
      });
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Verify the current terminal-mode setting can actually run. Surfaces a
   * user-facing error if tmux mode is selected but `tmux` is missing.
   * Features call this BEFORE creating any agent records.
   */
  checkAvailable = async (): Promise<boolean> => {
    if (readTerminalMode() !== TERMINAL_MODE_TMUX) return true;
    if (await tmux.isInstalled()) return true;
    await tmux.showMissingDialog(
      'Agentic: tmux is required for terminal mode "tmux" but was not found on PATH. Install tmux or switch terminal mode back to "default".',
      { offerSettings: true },
    );
    return false;
  };

  /**
   * Create a terminal for an agent and start the agent command.
   * Pass a sessionId to resume that exact Claude session.
   * When no sessionId is given, a new session starts and we detect its id.
   *
   * In tmux mode, the shell IS tmux: `new-session -A` attaches to an
   * existing session of the same name or creates one and runs the
   * claude command. The same shellArgs work for both fresh launch and
   * post-reload restore — tmux handles the attach-vs-create branch.
   */
  createTerminal = (opts: {
    agentId: string;
    agentName: string;
    branch: string;
    repoName: string;
    cwd: string;
    sessionId?: string | null;
    initialPrompt?: string;
    isRunning?: boolean;
    systemPrompt?: string | null;
  }): vscode.Terminal => {
    const { agentId, agentName, branch, repoName, cwd, sessionId, initialPrompt, isRunning, systemPrompt } = opts;
    const name = terminalName(agentName, branch, repoName);
    const tmuxName = tmuxSessionName(agentName, branch, repoName);
    const mode = readTerminalMode(cwd);
    const claudeCmd = this.buildCommand(sessionId, initialPrompt, cwd, systemPrompt);

    this.disposeTerminalRef(agentId);

    let terminal: vscode.Terminal;
    if (mode === TERMINAL_MODE_TMUX) {
      const shellArgs = tmux.newSessionShellArgs({
        sessionName: tmuxName,
        cwd,
        claudeCmd,
        confPath: this.tmuxConfPath,
      });
      terminal = vscode.window.createTerminal({
        name,
        shellPath: 'tmux',
        shellArgs,
        location: { viewColumn: vscode.ViewColumn.Two },
        env: TMUX_TERMINAL_ENV,
      });
    } else {
      terminal = vscode.window.createTerminal({
        name,
        cwd,
        location: { viewColumn: vscode.ViewColumn.Two },
      });
      terminal.sendText(claudeCmd);
    }

    this.terminals.set(agentId, terminal);
    this.sessionNames.set(agentId, tmuxName);

    if (sessionId) {
      logger.trace('TerminalService startWatching existing session', { agentId, sessionId, cwd, mode });
      this.sessionWatcher.startWatching(agentId, sessionId, cwd, isRunning);
    } else {
      logger.trace('TerminalService detecting new session', { agentId, cwd, mode, dir: claudeProjectDir(cwd) });
      this.detectSessionId(agentId, cwd);
    }

    return terminal;
  };

  /** Recreate a terminal from an existing Agent record — used by `restoreAll`
   *  on activation and by the close-dialog "Reopen Terminal" path. */
  private recreateFromAgent = (
    agent: Agent,
    repoName: string,
    cwd: string,
    isRunning: boolean,
  ): vscode.Terminal =>
    this.createTerminal({
      agentId: agent.agentId,
      agentName: agent.name,
      branch: agent.branch,
      repoName,
      cwd,
      sessionId: agent.sessionId,
      isRunning,
      systemPrompt: agent.systemPrompt,
    });

  /** Get the tracked terminal for an agent. */
  getTerminal = (agentId: string): vscode.Terminal | undefined => {
    return this.terminals.get(agentId);
  };

  /**
   * Public teardown — fully ends the agent's terminal lifecycle.
   *
   * Disposes the VS Code attach client AND kills the tmux session. Both
   * are safe to call when no session exists (killSession swallows "not
   * found"), so no mode gate is needed. For the internal
   * "close-previous-before-create" use case, prefer `disposeTerminalRef`
   * so the tmux session survives.
   */
  closeTerminal = (agentId: string): void => {
    const tmuxName = this.sessionNames.get(agentId);
    this.disposeTerminalRef(agentId);
    // Fire-and-forget — names include the agent's tile descriptor which is
    // unique per repo, and the kill is idempotent if the session is gone.
    if (tmuxName) void tmux.killSession(tmuxName);
  };

  /** Dispose only the VS Code terminal reference. tmux session, if any,
   *  survives. Used internally when refreshing a terminal for the same
   *  agent (e.g. closing one attach client to open another). */
  private disposeTerminalRef = (agentId: string): void => {
    this.stopDetecting(agentId);
    this.sessionWatcher.stopWatching(agentId);
    const terminal = this.terminals.get(agentId);
    if (terminal) {
      // Add to `removing` BEFORE dispose so the close handler skips its dialog.
      // try/finally guarantees the marker survives even if dispose throws (#42).
      this.removing.add(agentId);
      try {
        terminal.dispose();
      } catch (err) {
        logger.warn('TerminalService dispose threw', { agentId, err: String(err) });
      }
      // Don't delete from this.terminals here — let onTerminalClosed do it
      // so the handler can find the entry and clean up the removing Set.
    }
  };

  /** Restore terminals for every agent in the database. Called once during
   *  activation. Also disposes "empty" Agentic-named terminals that VS Code
   *  restored from a prior session but no longer correspond to any agent
   *  (agent removed) or whose shell process exited while VS Code was closed. */
  restoreAll = async (): Promise<void> => {
    const [repos, allAgents, allWorktrees] = await Promise.all([
      this.storage.getAllRepositories(),
      this.storage.getAllAgents(),
      this.storage.getAllWorktrees(),
    ]);

    const worktreeByKey = new Map(allWorktrees.map((wt) => [`${wt.repoId}::${wt.branch}`, wt]));
    const reposById = new Map(repos.map((r) => [r.repositoryId, r]));

    const expectedNames = new Set<string>();
    for (const agent of allAgents) {
      const repo = reposById.get(agent.repoId);
      if (!repo) continue;
      expectedNames.add(terminalName(agent.name, agent.branch, repo.name));
    }

    // Dispose orphan / exited Agentic terminals before we adopt anything,
    // so adopt-by-name in the loop below never picks up a dead shell.
    for (const t of vscode.window.terminals) {
      if (!AGENTIC_TERMINAL_NAME_RE.test(t.name)) continue;
      if (!expectedNames.has(t.name) || t.exitStatus !== undefined) {
        logger.trace('TerminalService disposing stale terminal on restore', { name: t.name });
        t.dispose();
      }
    }

    const existingByName = new Map(vscode.window.terminals.map((t) => [t.name, t]));

    for (const agent of allAgents) {
      const repo = reposById.get(agent.repoId);
      if (!repo) continue;

      const worktree = worktreeByKey.get(`${agent.repoId}::${agent.branch}`);
      const cwd = worktree?.path ?? repo.localPath;

      const name = terminalName(agent.name, agent.branch, repo.name);
      const wasRunning = agent.status === AGENT_STATUS_RUNNING;

      // Adopt an existing terminal if one already matches by name.
      // Don't send any command — the terminal is already running.
      const existing = existingByName.get(name);
      if (existing && existing.exitStatus === undefined) {
        this.terminals.set(agent.agentId, existing);
        this.sessionNames.set(agent.agentId, tmuxSessionName(agent.name, agent.branch, repo.name));
        if (agent.sessionId) {
          this.sessionWatcher.startWatching(agent.agentId, agent.sessionId, cwd, wasRunning);
        }
        continue;
      }

      this.recreateFromAgent(agent, repo.name, cwd, wasRunning);
    }

    this.restored = true;
  };

  // ── Private ───────────────────────────────────────────────────────

  /**
   * Build the shell command. Resolves the bypass-permissions config against
   * the agent's cwd so per-folder overrides apply (#69).
   */
  private buildCommand = (
    sessionId?: string | null,
    initialPrompt?: string,
    cwd?: string,
    systemPrompt?: string | null,
  ): string => {
    const scope = cwd ? vscode.Uri.file(cwd) : undefined;
    const bypass = vscode.workspace
      .getConfiguration(CONFIG_SECTION, scope)
      .get<boolean>(CONFIG_BYPASS_PERMISSIONS, false);
    let cmd = DEFAULT_AGENT_COMMAND;
    if (bypass) cmd += ` ${CLI_FLAG_BYPASS_PERMISSIONS}`;
    if (systemPrompt) cmd += ` ${CLI_FLAG_APPEND_SYSTEM_PROMPT} ${shellQuote(systemPrompt)}`;
    if (sessionId && UUID_RE.test(sessionId)) cmd += ` --resume ${sessionId}`;
    if (initialPrompt) cmd += ` ${shellQuote(initialPrompt)}`;
    return cmd;
  };

  /**
   * Poll the Claude project directory for a new session file and save
   * its id to the agent record. Polls every 2s for up to 30s.
   * Uses recursive setTimeout so each poll waits for the previous to finish.
   */
  private detectSessionId = async (agentId: string, cwd: string): Promise<void> => {
    this.stopDetecting(agentId);
    const dir = claudeProjectDir(cwd);

    // Snapshot existing .jsonl files so we can spot the new one.
    let existing: Set<string>;
    try {
      const files = await readdir(dir);
      existing = new Set(files.filter((f) => f.endsWith('.jsonl')));
    } catch {
      existing = new Set();
    }

    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const files = await readdir(dir);
        let claimedId: string | undefined;
        for (const f of files) {
          if (!f.endsWith('.jsonl') || existing.has(f)) continue;
          const id = basename(f, '.jsonl');
          if (!UUID_RE.test(id)) continue;
          // Atomically claim before any await to prevent another agent's poll
          // from taking the same session during the async gap.
          if (this.sessionWatcher.claimSession(id)) {
            claimedId = id;
            break;
          }
        }
        if (claimedId) {
          logger.info('TerminalService session detected', { agentId, sessionId: claimedId, attempt: attempts });
          this.detectors.delete(agentId);
          try {
            await this.storage.updateAgent(agentId, { sessionId: claimedId });
            this.sessionWatcher.startWatching(agentId, claimedId, cwd);
          } catch {
            // Agent may have been removed — release the claim so the session
            // is not permanently blocked from detection.
            this.sessionWatcher.releaseSession(claimedId);
          }
          return;
        }
      } catch {
        // Directory may not exist yet — keep trying.
      }
      if (attempts < SESSION_POLL_MAX_ATTEMPTS) {
        this.detectors.set(agentId, setTimeout(poll, SESSION_POLL_INTERVAL_MS));
      } else {
        // Switch to slow polling instead of giving up — session may still appear.
        if (attempts === SESSION_POLL_MAX_ATTEMPTS) {
          logger.trace('TerminalService session detection switching to slow poll', { agentId, dir });
        }
        this.detectors.set(agentId, setTimeout(poll, SLOW_SESSION_POLL_INTERVAL_MS));
      }
    };

    this.detectors.set(agentId, setTimeout(poll, SESSION_POLL_INTERVAL_MS));
  };

  /** Stop session-detection polling for an agent. */
  private stopDetecting = (agentId: string): void => {
    const timeout = this.detectors.get(agentId);
    if (timeout) {
      clearTimeout(timeout);
      this.detectors.delete(agentId);
    }
  };

  /** Drop all in-memory state for an agent: terminal map entry, session
   *  detection poll, and session-file watcher. Used by every teardown path. */
  private clearAgentState = (agentId: string): void => {
    this.terminals.delete(agentId);
    this.sessionNames.delete(agentId);
    this.stopDetecting(agentId);
    this.sessionWatcher.stopWatching(agentId);
  };

  /**
   * Periodic check that cross-references tracked terminals with VS Code's
   * live terminal list. Cleans up orphaned references where onDidCloseTerminal
   * was somehow missed (e.g. extension reload edge cases).
   */
  private checkTerminalHealth = async (): Promise<void> => {
    if (!this.restored) return;

    const liveTerminals = new Set(vscode.window.terminals);

    for (const [agentId, terminal] of this.terminals) {
      if (!liveTerminals.has(terminal)) {
        logger.warn('TerminalService orphaned terminal reference', { agentId });
        this.clearAgentState(agentId);
        try {
          await this.storage.updateAgent(agentId, { status: AGENT_STATUS_ERROR });
        } catch {
          // Agent may have been removed.
        }
      }
    }
  };

  private onTerminalClosed = async (terminal: vscode.Terminal): Promise<void> => {
    // Find which agent owns this terminal.
    let agentId: string | undefined;
    for (const [id, t] of this.terminals) {
      if (t === terminal) {
        agentId = id;
        break;
      }
    }

    if (!agentId) {
      return;
    }

    // Programmatic removal — another code path already handles cleanup.
    if (this.removing.has(agentId)) {
      this.clearAgentState(agentId);
      this.removing.delete(agentId);
      return;
    }

    // Capture the tmux session name before clearAgentState wipes it; the
    // later teardown paths (remove / delete-worktree) still need it.
    const tmuxName = this.sessionNames.get(agentId);

    // tmux mode: VS Code attach client closed but the tmux session may
    // still be alive (user just closed the panel, didn't end the agent).
    // Silently re-create the attach client so the agent stays reachable.
    if (
      readTerminalMode() === TERMINAL_MODE_TMUX &&
      tmuxName &&
      (await tmux.hasSession(tmuxName))
    ) {
      const agent = await this.storage.getAgent(agentId);
      const repo = agent ? await this.storage.getRepository(agent.repoId) : undefined;
      if (agent && repo) {
        const reattached = vscode.window.createTerminal({
          name: terminalName(agent.name, agent.branch, repo.name),
          shellPath: 'tmux',
          shellArgs: tmux.attachShellArgs(tmuxName),
          location: { viewColumn: vscode.ViewColumn.Two },
          env: TMUX_TERMINAL_ENV,
        });
        // Replace the stale entry; keep session-watcher running.
        // No .show() — agent stays backgrounded until the user clicks its tile.
        this.terminals.set(agentId, reattached);
        logger.trace('TerminalService silent re-attach', { agentId, branch: agent.branch });
        return;
      }
      logger.warn('TerminalService silent re-attach skipped: agent or repo row missing', { agentId });
    }

    this.clearAgentState(agentId);

    // Agent finished normally — silently remove without prompting.
    if (terminal.exitStatus?.code === 0) {
      await this.storage.removeAgent(agentId);
      return;
    }

    // Terminal was closed by the user or errored — mark as error.
    let agent;
    try {
      agent = await this.storage.updateAgent(agentId, { status: AGENT_STATUS_ERROR });
    } catch {
      return;
    }

    const [repo, worktree] = await Promise.all([
      this.storage.getRepository(agent.repoId),
      this.storage.getWorktreeByBranch(agent.repoId, agent.branch),
    ]);
    if (!repo) {
      return;
    }
    const isCurrent = agent.branch === repo.currentBranch;
    const cwd = worktree?.path ?? repo.localPath;

    let detail = dialogTerminalClosed(agent.name);

    if (worktree) {
      const dirty = await hasUncommittedChanges(worktree.path);
      if (dirty) {
        detail += DIALOG_UNCOMMITTED_TERMINAL;
      }
    }

    const branchAgents = isCurrent ? [] : await this.storage.getAgentsByRepoBranch(agent.repoId, agent.branch);
    const isLastOnWorktreeBranch = !isCurrent && branchAgents.length <= 1;

    const wasRunning = agent.status === AGENT_STATUS_RUNNING;

    // Current branch or shared worktree — simple remove/reopen dialog
    if (!isLastOnWorktreeBranch) {
      const choice = await vscode.window.showWarningMessage(
        detail,
        { modal: true },
        BTN_REMOVE,
        BTN_REOPEN_TERMINAL,
      );
      if (choice === BTN_REMOVE) {
        // Full teardown — kill tmux session too if present.
        if (tmuxName) void tmux.killSession(tmuxName);
        await this.storage.removeAgent(agentId);
        return;
      }
      this.recreateFromAgent(agent, repo.name, cwd, wasRunning).show(false);
      return;
    }

    // Last agent on worktree branch — offer worktree deletion
    const choice = await vscode.window.showWarningMessage(
      detail,
      { modal: true },
      BTN_REMOVE_DELETE_WORKTREE,
      BTN_REMOVE_KEEP_WORKTREE,
      BTN_REOPEN_TERMINAL,
    );

    if (choice === BTN_REMOVE_DELETE_WORKTREE) {
      if (worktree) {
        await removeWorktree(repo.localPath, worktree.path);
        await deleteBranch(repo.localPath, agent.branch);
        await this.storage.removeWorktreeByBranch(agent.repoId, agent.branch);
      }
      void tmux.killSession(agentId);
      await this.storage.removeAgent(agentId);
      return;
    }

    if (choice === BTN_REMOVE_KEEP_WORKTREE) {
      void tmux.killSession(agentId);
      await this.storage.removeAgent(agentId);
      return;
    }

    // "Reopen Terminal" or dialog dismissed — resume the exact session.
    this.recreateFromAgent(agent, repo.name, cwd, wasRunning).show(false);
  };

  dispose(): void {
    clearInterval(this.healthTimer);
    for (const d of this.disposables) {
      d.dispose();
    }
    for (const timeout of this.detectors.values()) {
      clearTimeout(timeout);
    }
    this.detectors.clear();
    this.terminals.clear();
    this.sessionNames.clear();
    this.removing.clear();
    this.sessionWatcher.dispose();
  }
}
