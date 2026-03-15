import { readdir } from 'fs/promises';
import { basename, join } from 'path';
import { homedir } from 'os';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { terminalName } from '../constants/terminal';
import { CLAUDE_DIR, CLAUDE_PROJECTS_DIR, UUID_RE } from '../constants/paths';
import { AGENT_STATUS_ERROR, DEFAULT_AGENT_COMMAND, CLI_FLAG_BYPASS_PERMISSIONS } from '../constants/agent';
import { CONFIG_SECTION, CONFIG_BYPASS_PERMISSIONS } from '../constants/views';
import { SESSION_POLL_INTERVAL_MS, SESSION_POLL_MAX_ATTEMPTS } from '../constants/timing';
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

/**
 * Compute the Claude project directory for a given working directory.
 * Claude stores sessions at ~/.claude/projects/<encoded-path>/<sessionId>.jsonl
 * where the encoded path replaces `/` and `.` with `-`.
 */
export const claudeProjectDir = (cwd: string): string =>
  join(homedir(), CLAUDE_DIR, CLAUDE_PROJECTS_DIR, cwd.replace(/[/.]/g, '-'));

/** Wrap a string in single quotes for safe shell interpolation. */
export const shellQuote = (s: string): string => `'${s.replace(/'/g, "'\\''")}'`;

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

  constructor(private readonly storage: StateStorage) {
    this.sessionWatcher = new SessionWatcher(storage);
    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        this.onTerminalClosed(terminal).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[TerminalService] onTerminalClosed error:', msg);
          vscode.window.showErrorMessage(msg);
        });
      }),
    );
  }

  /**
   * Create a terminal for an agent and start the agent command.
   * Pass a sessionId to resume that exact Claude session.
   * When no sessionId is given, a new session starts and we detect its id.
   */
  createTerminal = (
    agentId: string,
    agentName: string,
    branch: string,
    repoName: string,
    cwd: string,
    sessionId?: string | null,
    initialPrompt?: string,
  ): vscode.Terminal => {
    const name = terminalName(agentName, branch, repoName);

    const terminal = vscode.window.createTerminal({
      name,
      cwd,
      location: { viewColumn: vscode.ViewColumn.Two },
    });
    terminal.sendText(this.buildCommand(sessionId, initialPrompt));
    this.terminals.set(agentId, terminal);

    if (sessionId) {
      console.log('[TerminalService] startWatching existing session:', { agentId, sessionId, cwd });
      this.sessionWatcher.startWatching(agentId, sessionId, cwd);
    } else {
      console.log('[TerminalService] detecting new session:', { agentId, cwd, dir: claudeProjectDir(cwd) });
      this.detectSessionId(agentId, cwd);
    }

    return terminal;
  };

  /** Get the tracked terminal for an agent. */
  getTerminal = (agentId: string): vscode.Terminal | undefined => {
    return this.terminals.get(agentId);
  };

  /** Mark an agent as being removed programmatically, then dispose its terminal. */
  closeTerminal = (agentId: string): void => {
    this.stopDetecting(agentId);
    this.sessionWatcher.stopWatching(agentId);
    const terminal = this.terminals.get(agentId);
    if (terminal) {
      this.removing.add(agentId);
      terminal.dispose();
      // Don't delete from this.terminals here — let onTerminalClosed do it
      // so the handler can find the entry and clean up the removing Set.
    }
  };

  /** Restore terminals for every agent in the database. Called once during activation. */
  restoreAll = async (): Promise<void> => {
    const [repos, allWorktrees] = await Promise.all([
      this.storage.getAllReposWithZones(),
      this.storage.getAllWorktrees(),
    ]);

    const worktreeByKey = new Map(allWorktrees.map((wt) => [`${wt.repoId}::${wt.branch}`, wt]));
    const existingByName = new Map(vscode.window.terminals.map((t) => [t.name, t]));

    // Collect agent terminal names so we can close unrelated terminals after restore.
    const agentTerminalNames = new Set<string>();

    for (const repo of repos) {
      for (const zone of repo.zones) {
        for (const agent of zone.agents) {
          const worktree = worktreeByKey.get(`${agent.repoId}::${agent.branch}`);
          const cwd = worktree?.path ?? repo.localPath;

          const name = terminalName(agent.name, agent.branch, repo.name);
          agentTerminalNames.add(name);

          // Adopt an existing terminal if one already matches by name.
          // Don't send any command — the terminal is already running.
          const existing = existingByName.get(name);
          if (existing) {
            this.terminals.set(agent.agentId, existing);
            if (agent.sessionId) {
              this.sessionWatcher.startWatching(agent.agentId, agent.sessionId, cwd);
            }
            continue;
          }

          this.createTerminal(agent.agentId, agent.name, agent.branch, repo.name, cwd, agent.sessionId);
        }
      }
    }

    // Close all pre-existing terminals that don't belong to any agent.
    for (const [name, terminal] of existingByName) {
      if (!agentTerminalNames.has(name)) {
        terminal.dispose();
      }
    }
  };

  // ── Private ───────────────────────────────────────────────────────

  /**
   * Build the shell command.
   * When a sessionId is provided, appends `--resume <id>` to resume that exact session.
   * When an initialPrompt is provided, appends it as a positional argument so
   * Claude starts the interactive session with that prompt already submitted.
   */
  private buildCommand = (sessionId?: string | null, initialPrompt?: string): string => {
    const bypass = vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .get<boolean>(CONFIG_BYPASS_PERMISSIONS, false);
    let cmd = DEFAULT_AGENT_COMMAND;
    if (bypass) cmd += ` ${CLI_FLAG_BYPASS_PERMISSIONS}`;
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
        const newFile = files.find(
          (f) => f.endsWith('.jsonl') && !existing.has(f) && UUID_RE.test(basename(f, '.jsonl')),
        );
        if (newFile) {
          const sessionId = basename(newFile, '.jsonl');
          console.log('[TerminalService] session detected:', { agentId, sessionId, attempt: attempts });
          this.detectors.delete(agentId);
          try {
            await this.storage.updateAgent(agentId, { sessionId });
            this.sessionWatcher.startWatching(agentId, sessionId, cwd);
          } catch {
            // Agent may have been removed — detection result is no longer needed.
          }
          return;
        }
      } catch {
        // Directory may not exist yet — keep trying.
      }
      if (attempts < SESSION_POLL_MAX_ATTEMPTS) {
        this.detectors.set(agentId, setTimeout(poll, SESSION_POLL_INTERVAL_MS));
      } else {
        console.warn('[TerminalService] session detection gave up after', attempts, 'attempts:', { agentId, dir });
        this.detectors.delete(agentId);
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

    this.terminals.delete(agentId);
    this.stopDetecting(agentId);
    this.sessionWatcher.stopWatching(agentId);

    // Programmatic removal — another code path already handles cleanup.
    if (this.removing.has(agentId)) {
      this.removing.delete(agentId);
      return;
    }

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

    // Current branch or shared worktree — simple remove/reopen dialog
    if (!isLastOnWorktreeBranch) {
      const choice = await vscode.window.showWarningMessage(
        detail,
        { modal: true },
        BTN_REMOVE,
        BTN_REOPEN_TERMINAL,
      );
      if (choice === BTN_REMOVE) {
        await this.storage.removeAgent(agentId);
        return;
      }
      const reopened = this.createTerminal(agentId, agent.name, agent.branch, repo.name, cwd, agent.sessionId);
      reopened.show(false);
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
      await this.storage.removeAgent(agentId);
      return;
    }

    if (choice === BTN_REMOVE_KEEP_WORKTREE) {
      await this.storage.removeAgent(agentId);
      return;
    }

    // "Reopen Terminal" or dialog dismissed — resume the exact session.
    const reopened = this.createTerminal(agentId, agent.name, agent.branch, repo.name, cwd, agent.sessionId);
    reopened.show(false);
  };

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    for (const timeout of this.detectors.values()) {
      clearTimeout(timeout);
    }
    this.detectors.clear();
    this.terminals.clear();
    this.removing.clear();
    this.sessionWatcher.dispose();
  }
}
